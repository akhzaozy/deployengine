import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { CONFIG } from './config.js';

export class NginxManager {
  static generateConfig(options) {
    const { repo, framework, domain, docRoot, port = 3000 } = options;
    const sub = domain || `${repo}.${CONFIG.domainBase}`;

    let vhostContent = `# AutoDeploy Engine v4.0 -- ${repo} (${framework})\n`;
    vhostContent += `# Generated automatically, do not edit manually.\n\n`;
    vhostContent += `server {\n`;
    vhostContent += `    listen 80;\n`;
    vhostContent += `    server_name ${sub};\n`;
    vhostContent += `    charset utf-8;\n\n`;
    vhostContent += `    access_log ${CONFIG.logDir}/${repo}-access.log;\n`;
    vhostContent += `    error_log  ${CONFIG.logDir}/${repo}-error.log warn;\n\n`;

    // Cloudflare Real IP directives
    vhostContent += `    # Cloudflare Real IP\n`;
    vhostContent += `    set_real_ip_from 103.21.244.0/22;\n`;
    vhostContent += `    set_real_ip_from 103.22.200.0/22;\n`;
    vhostContent += `    set_real_ip_from 103.31.4.0/22;\n`;
    vhostContent += `    set_real_ip_from 104.16.0.0/13;\n`;
    vhostContent += `    set_real_ip_from 104.24.0.0/14;\n`;
    vhostContent += `    set_real_ip_from 162.158.0.0/15;\n`;
    vhostContent += `    set_real_ip_from 172.64.0.0/13;\n`;
    vhostContent += `    set_real_ip_from 173.245.48.0/20;\n`;
    vhostContent += `    set_real_ip_from 198.41.128.0/17;\n`;
    vhostContent += `    set_real_ip_from 2400:cb00::/32;\n`;
    vhostContent += `    real_ip_header CF-Connecting-IP;\n\n`;
    vhostContent += `    client_max_body_size 128M;\n\n`;

    // Security blocks
    vhostContent += `    # Security blocks\n`;
    vhostContent += `    location ~ /\\.(env|git|htaccess|json)$ { deny all; return 404; }\n`;
    vhostContent += `    location ~ /(vendor|node_modules)/      { deny all; return 404; }\n`;
    vhostContent += `    location ~ /\\.(?!well-known).*          { deny all; }\n\n`;

    if (framework === 'nextjs') {
      // Next.js reverse proxy block with WebSocket upgrade
      vhostContent += `    # Next.js Node Runner (Port: ${port})\n`;
      vhostContent += `    location /_next/static/ {\n`;
      vhostContent += `        alias ${docRoot}/.next/static/;\n`;
      vhostContent += `        expires 365d;\n`;
      vhostContent += `        access_log off;\n`;
      vhostContent += `    }\n\n`;
      vhostContent += `    location / {\n`;
      vhostContent += `        proxy_pass http://127.0.0.1:${port};\n`;
      vhostContent += `        proxy_http_version 1.1;\n`;
      vhostContent += `        proxy_set_header Upgrade $http_upgrade;\n`;
      vhostContent += `        proxy_set_header Connection 'upgrade';\n`;
      vhostContent += `        proxy_set_header Host $host;\n`;
      vhostContent += `        proxy_cache_bypass $http_upgrade;\n`;
      vhostContent += `        proxy_set_header X-Real-IP $remote_addr;\n`;
      vhostContent += `        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n`;
      vhostContent += `        proxy_set_header X-Forwarded-Proto $scheme;\n`;
      vhostContent += `    }\n`;
    } else {
      // PHP-FPM for Laravel & PHP Native
      vhostContent += `    root ${docRoot};\n`;
      vhostContent += `    index index.php index.html;\n\n`;
      vhostContent += `    location / {\n`;
      vhostContent += `        try_files $uri $uri/ /index.php?$query_string;\n`;
      vhostContent += `    }\n\n`;
      vhostContent += `    location ~ \\.php$ {\n`;
      vhostContent += `        include fastcgi_params;\n`;
      vhostContent += `        fastcgi_pass unix:${CONFIG.phpFpmSocket};\n`;
      vhostContent += `        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;\n`;
      vhostContent += `        fastcgi_param DOCUMENT_ROOT $realpath_root;\n`;
      vhostContent += `        fastcgi_intercept_errors on;\n`;
      vhostContent += `    }\n`;
    }

    vhostContent += `}\n`;
    return vhostContent;
  }

  static applyConfig(options) {
    const { repo } = options;
    const vhostContent = this.generateConfig(options);
    const availPath = path.join(CONFIG.nginxAvail, `${repo}.conf`);
    const enabledPath = path.join(CONFIG.nginxEnabled, `${repo}.conf`);

    const logs = [];

    // Cek jika konfigurasi sudah ada dan identik
    let isIdentical = false;
    try {
      if (fs.existsSync(availPath) && fs.existsSync(enabledPath)) {
        const existingContent = fs.readFileSync(availPath, 'utf8');
        if (existingContent === vhostContent) {
          isIdentical = true;
        }
      }
    } catch {}

    if (isIdentical) {
      logs.push(`[Nginx] Konfigurasi virtual host untuk '${repo}' sudah ada dan identik.`);
      logs.push(`[Nginx] Melewati reload daemon untuk menjaga koneksi tetap stabil.`);
      return { success: true, availPath, enabledPath, logs, alreadyConfigured: true };
    }

    logs.push(`[Nginx] Menulis konfigurasi virtual host: ${availPath}`);

    try {
      fs.mkdirSync(path.dirname(availPath), { recursive: true });
      fs.writeFileSync(availPath, vhostContent);

      // Create symlink
      if (!fs.existsSync(enabledPath)) {
        try {
          fs.symlinkSync(availPath, enabledPath);
          logs.push(`[Nginx] Symlink dibuat: ${enabledPath}`);
        } catch (e) {
          // In windows/mock environments symlinks might require elevation
          fs.writeFileSync(enabledPath, vhostContent);
        }
      }

      // Test & Reload Nginx if running in Linux
      if (CONFIG.isProduction) {
        try {
          const testRes = execSync('nginx -t 2>&1').toString();
          if (testRes.includes('successful') || testRes.includes('ok')) {
            execSync('nginx -s reload 2>&1 || systemctl reload nginx 2>&1');
            logs.push(`[Nginx] Validasi & reload Nginx sukses.`);
          } else {
            logs.push(`[Nginx WARN] Nginx test gagal: ${testRes.trim()}`);
          }
        } catch (err) {
          logs.push(`[Nginx WARN] Gagal reload Nginx: ${err.message}`);
        }
      } else {
        logs.push(`[Nginx] Config tersimpan (mode lokal/dev).`);
      }

      return { success: true, availPath, enabledPath, logs };
    } catch (err) {
      logs.push(`[Nginx ERROR] Gagal menulis konfigurasi: ${err.message}`);
      return { success: false, error: err.message, logs };
    }
  }
}

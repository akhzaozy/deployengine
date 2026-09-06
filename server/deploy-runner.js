import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import { CONFIG } from './config.js';
import { NginxManager } from './nginx-manager.js';
import { CloudflareManager } from './cloudflare.js';
import { DatabaseProvisioner } from './db-provisioner.js';

export class DeployRunner {
  static execCommand(cmd, cwd, onLog) {
    return new Promise((resolve) => {
      onLog(`$ ${cmd}`);
      try {
        const proc = exec(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 });

        proc.stdout?.on('data', (data) => {
          data.toString().split('\n').filter(Boolean).forEach(line => onLog(line));
        });

        proc.stderr?.on('data', (data) => {
          data.toString().split('\n').filter(Boolean).forEach(line => onLog(`[stderr] ${line}`));
        });

        proc.on('close', (code) => {
          resolve({ success: code === 0, code });
        });

        proc.on('error', (err) => {
          onLog(`[error] ${err.message}`);
          resolve({ success: false, error: err.message });
        });
      } catch (err) {
        onLog(`[exec exception] ${err.message}`);
        resolve({ success: false, error: err.message });
      }
    });
  }

  static async runPipeline(project, context) {
    const { updateStep, log } = context;
    const { repo, framework, branch = 'main', gitUrl, dbEngine = 'mariadb', port = 3000 } = project;
    const projectDir = path.join(CONFIG.baseDir, repo);
    const domain = `${repo}.${CONFIG.domainBase}`;

    log(`================================================================`);
    log(`  AUTODEPLOY ENGINE v4.0`);
    log(`  Repo: ${repo} | Framework: ${framework.toUpperCase()} | DB: ${dbEngine.toUpperCase()}`);
    log(`  Target Directory: ${projectDir}`);
    log(`  Public Domain   : https://${domain}`);
    log(`================================================================`);

    // Ensure target folder
    fs.mkdirSync(projectDir, { recursive: true });

    // Step 1: Git Source Synchronization
    updateStep(1, 'Sinkronisasi Source Code (Git Pull / Clone)', 6);
    log(`[STEP 1/6] Mengunduh kode sumber git untuk branch: ${branch}...`);
    
    if (fs.existsSync(path.join(projectDir, '.git'))) {
      await this.execCommand(`git fetch origin ${branch} && git reset --hard origin/${branch}`, projectDir, log);
    } else if (gitUrl) {
      log(`Cloning repository ${gitUrl}...`);
      await this.execCommand(`git clone --depth 1 -b ${branch} ${gitUrl} .`, projectDir, log);
    } else {
      log(`Direktori lokal siap.`);
    }

    // Step 2: Database Provisioning & .env Injection
    updateStep(2, `Provisioning Database (${dbEngine.toUpperCase()}) & .env`, 6);
    log(`[STEP 2/6] Menyiapkan database ${dbEngine.toUpperCase()} & kredensial...`);
    const dbResult = await DatabaseProvisioner.provision(repo, dbEngine);
    dbResult.logs.forEach(l => log(l));

    // Handle .env creation if missing
    const envPath = path.join(projectDir, '.env');
    const envExamplePath = path.join(projectDir, '.env.example');

    if (!fs.existsSync(envPath)) {
      let envContent = fs.existsSync(envExamplePath)
        ? fs.readFileSync(envExamplePath, 'utf8')
        : '';

      log(`Membuat file .env baru berdasarkan template & kredensial database...`);
      // Inject DB credentials
      Object.entries(dbResult.envSnippet).forEach(([k, v]) => {
        const regex = new RegExp(`^#?\\s*${k}=.*`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${k}=${v}`);
        } else {
          envContent += `\n${k}=${v}`;
        }
      });

      // Inject APP_URL
      if (/^APP_URL=/m.test(envContent)) {
        envContent = envContent.replace(/^APP_URL=.*/m, `APP_URL=https://${domain}`);
      } else {
        envContent += `\nAPP_URL=https://${domain}`;
      }

      fs.writeFileSync(envPath, envContent.trim() + '\n');
      log(`[ENV] File .env berhasil di-generate.`);
    }

    // Step 3: Install Dependencies
    updateStep(3, 'Install Dependencies (Composer / NPM)', 6);
    log(`[STEP 3/6] Menginstal package dependencies...`);

    if (framework === 'laravel') {
      log(`Menjalankan composer install...`);
      await this.execCommand(`${CONFIG.composer} install --no-dev --optimize-autoloader --no-interaction || true`, projectDir, log);
    } else if (framework === 'nextjs') {
      log(`Menjalankan npm install...`);
      await this.execCommand(`${CONFIG.npmBin} install --prefer-offline || npm install`, projectDir, log);
    } else if (fs.existsSync(path.join(projectDir, 'composer.json'))) {
      log(`Mendeteksi composer.json pada PHP Native...`);
      await this.execCommand(`${CONFIG.composer} install --no-dev --optimize-autoloader || true`, projectDir, log);
    }

    // Step 4: Build / Compile / Migration
    updateStep(4, framework === 'nextjs' ? 'Building Next.js Application' : 'Database Migrations & Artisan Setup', 6);
    log(`[STEP 4/6] Menjalankan build pipeline framework: ${framework}...`);

    let docRoot = projectDir;

    if (framework === 'laravel') {
      docRoot = path.join(projectDir, 'public');
      fs.mkdirSync(docRoot, { recursive: true });

      // Generate app key if not set
      log(`Memeriksa APP_KEY Laravel...`);
      await this.execCommand(`${CONFIG.php} artisan key:generate --force || true`, projectDir, log);

      // Run database migrations
      log(`Menjalankan migrasi database...`);
      await this.execCommand(`${CONFIG.php} artisan migrate --force || true`, projectDir, log);

      // Create storage symlink
      await this.execCommand(`${CONFIG.php} artisan storage:link || true`, projectDir, log);

      // Clear caches
      await this.execCommand(`${CONFIG.php} artisan config:clear && ${CONFIG.php} artisan route:clear && ${CONFIG.php} artisan view:clear || true`, projectDir, log);
    } else if (framework === 'nextjs') {
      log(`Menjalankan next build...`);
      await this.execCommand(`${CONFIG.npmBin} run build`, projectDir, log);

      // Start/restart Next.js process on allocated port
      log(`Mengelola proses Next.js runner pada port ${port}...`);
      await this.execCommand(`${CONFIG.pm2Bin} restart next-${repo} || ${CONFIG.pm2Bin} start npm --name "next-${repo}" -- start -- -p ${port} || true`, projectDir, log);
    } else {
      // PHP Native
      docRoot = fs.existsSync(path.join(projectDir, 'public', 'index.php'))
        ? path.join(projectDir, 'public')
        : projectDir;
    }

    // Step 5: Permissions & Security Hardening
    updateStep(5, 'Mengatur Hak Akses & File Permissions', 6);
    log(`[STEP 5/6] Menerapkan hak akses Linux 3-Layer...`);
    if (CONFIG.isProduction) {
      try {
        execSync(`chmod 755 "${projectDir}"`);
        execSync(`chown -R ${CONFIG.webUser}:${CONFIG.webGroup} "${projectDir}" 2>/dev/null || true`);
        if (framework === 'laravel') {
          execSync(`chmod -R 775 "${projectDir}/storage" "${projectDir}/bootstrap/cache" 2>/dev/null || true`);
        }
        if (fs.existsSync(envPath)) {
          execSync(`chmod 640 "${envPath}" 2>/dev/null || true`);
        }
        log(`[PERM] Izin file selesai diatur.`);
      } catch (e) {
        log(`[PERM WARN] Izin file diterapkan sebagian.`);
      }
    } else {
      log(`[PERM] Izin lokal dev OK.`);
    }

    // Step 6: Virtual Host Nginx & Cloudflare Tunnel
    updateStep(6, 'Konfigurasi Nginx & Cloudflare Tunnel', 6);
    log(`[STEP 6/6] Menerapkan konfigurasi Web Server Nginx & DNS...`);

    const nginxResult = NginxManager.applyConfig({
      repo,
      framework,
      domain,
      docRoot,
      port
    });
    nginxResult.logs.forEach(l => log(l));

    const cfResult = await CloudflareManager.syncSubdomain(
      repo,
      CONFIG.domainBase,
      framework === 'nextjs' ? `http://localhost:${port}` : 'http://localhost:80'
    );
    cfResult.logs.forEach(l => log(l));

    log(`================================================================`);
    log(`  DEPLOYMENT BERHASIL! (STATUS: LIVE)`);
    log(`  URL: https://${domain}`);
    log(`  Framework: ${framework} | Port: ${framework === 'nextjs' ? port : 'PHP-FPM Socket'}`);
    log(`================================================================`);

    return {
      success: true,
      repo,
      framework,
      domain: `https://${domain}`,
      deployedAt: new Date().toISOString()
    };
  }
}

import path from 'path';
import os from 'os';
import fs from 'fs';

const isProduction = process.platform === 'linux' && fs.existsSync('/www/server');

export const CONFIG = {
  isProduction,
  port: process.env.PORT || 4000,
  apiKey: process.env.DEPLOY_API_KEY || 'RAHASIA123',
  domainBase: process.env.DOMAIN_BASE || 'akhzafachrozy.my.id',
  
  // Paths
  baseDir: isProduction ? '/www/wwwroot/hosting' : path.resolve(os.homedir(), '.autodeploy/projects'),
  logDir: isProduction ? '/var/log/autodeploy' : path.resolve(os.homedir(), '.autodeploy/logs'),
  metaDir: isProduction ? '/var/lib/autodeploy' : path.resolve(os.homedir(), '.autodeploy/metadata'),
  nginxAvail: isProduction ? '/etc/nginx/sites-available' : path.resolve(os.homedir(), '.autodeploy/nginx/sites-available'),
  nginxEnabled: isProduction ? '/etc/nginx/sites-enabled' : path.resolve(os.homedir(), '.autodeploy/nginx/sites-enabled'),
  
  // Binaries
  php: process.env.PHP_BIN || (isProduction ? '/www/server/php/83/bin/php' : 'php'),
  composer: process.env.COMPOSER_BIN || (isProduction ? '/usr/local/bin/composer' : 'composer'),
  phpFpmSocket: process.env.PHP_FPM_SOCKET || (isProduction ? '/tmp/php-cgi-83.sock' : '/tmp/php-fpm.sock'),
  nodeBin: process.env.NODE_BIN || 'node',
  npmBin: process.env.NPM_BIN || 'npm',
  pm2Bin: process.env.PM2_BIN || 'pm2',

  // Cloudflare API Defaults (set via environment variable on server)
  cfApiToken: process.env.CF_API_TOKEN || '',
  cfZoneId: process.env.CF_ZONE_ID || '',
  cfAccount: process.env.CF_ACCOUNT || '',
  cfTunnelId: process.env.CF_TUNNEL_ID || '',

  // Database Default Credentials
  db: {
    mariadb: {
      host: process.env.MARIADB_HOST || '127.0.0.1',
      port: process.env.MARIADB_PORT || 3306,
      rootUser: process.env.MARIADB_ROOT_USER || 'root',
      rootPassword: process.env.MARIADB_ROOT_PASSWORD || '',
      defaultUser: process.env.AUTODEPLOY_DB_USER || 'deploysiitk',
      defaultPass: process.env.AUTODEPLOY_DB_PASS || 'deploysiitk2026'
    },
    postgres: {
      host: process.env.PG_HOST || '127.0.0.1',
      port: process.env.PG_PORT || 5432,
      superUser: process.env.PG_SUPERUSER || 'postgres',
      superPassword: process.env.PG_PASSWORD || '',
      defaultUser: process.env.AUTODEPLOY_PG_USER || 'deploysiitk',
      defaultPass: process.env.AUTODEPLOY_PG_PASS || 'deploysiitk2026'
    }
  },

  // Linux permissions
  webUser: 'www',
  webGroup: 'www'
};

// Bootstrap runtime directories safely
[CONFIG.baseDir, CONFIG.logDir, CONFIG.metaDir, CONFIG.nginxAvail, CONFIG.nginxEnabled].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }
  } catch (err) {
    // Suppress permission errors in non-root dev environments
  }
});

import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import { CONFIG } from './config.js';
import { NginxManager } from './nginx-manager.js';
import { CloudflareManager } from './cloudflare.js';
import { DatabaseProvisioner } from './db-provisioner.js';

export class DeployRunner {
  /**
   * Universal Git Repository Input Parser
   * Mendukung format:
   * - https://github.com/username/repository.git
   * - https://github.com/username/repository
   * - git@github.com:username/repository.git
   * - username/repository
   * - repository
   */
  static normalizeGitInput(input) {
    if (!input) return { repo: '', gitUrl: '' };
    const raw = input.trim();

    // SSH format: git@github.com:user/repo.git
    if (raw.startsWith('git@')) {
      const match = raw.match(/[:/]([^/:]+)\/([^/:]+?)(?:\.git)?$/);
      const repoName = match ? match[2] : path.basename(raw, '.git');
      return {
        repo: repoName.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        gitUrl: raw.endsWith('.git') ? raw : `${raw}.git`,
        raw
      };
    }

    // HTTPS / HTTP format
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const urlClean = raw.replace(/\/+$/, '');
      const parts = urlClean.split('/');
      const last = parts[parts.length - 1].replace(/\.git$/, '');
      return {
        repo: last.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        gitUrl: urlClean.endsWith('.git') ? urlClean : `${urlClean}.git`,
        raw
      };
    }

    // Short format: username/repository
    if (raw.includes('/')) {
      const parts = raw.split('/');
      const repoName = parts[parts.length - 1].replace(/\.git$/, '');
      return {
        repo: repoName.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        gitUrl: `https://github.com/${raw.replace(/\.git$/, '')}.git`,
        raw
      };
    }

    // Plain slug / name
    return {
      repo: raw.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      gitUrl: '',
      raw
    };
  }

  static execCommand(cmd, cwd, onLog) {
    return new Promise((resolve) => {
      onLog(`➜ ${cmd}`);
      try {
        const proc = exec(cmd, { 
          cwd, 
          maxBuffer: 10 * 1024 * 1024,
          env: { 
            ...process.env, 
            COMPOSER_ALLOW_SUPERUSER: '1',
            GIT_TERMINAL_PROMPT: '0',
            GIT_SSH_COMMAND: 'ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes'
          }
        });

        proc.stdout?.on('data', (data) => {
          data.toString().split('\n').filter(Boolean).forEach(line => onLog(line));
        });

        proc.stderr?.on('data', (data) => {
          data.toString().split('\n').filter(Boolean).forEach(line => {
            const trimmed = line.trim();
            // Git & Composer progress/informational messages sent to stderr by design
            const isInfo = /^(From | \* |Installing |Downloading |Generating |Package operations|Verifying |\d+\/\d+|Extracting |Nothing to |Use the |> |@php |[0-9]+ package)/i.test(trimmed);
            const isActualError = /^(error|fatal|exception|failed|parse error)/i.test(trimmed);

            if (isActualError) {
              onLog(`✖ [stderr error] ${line}`);
            } else if (isInfo) {
              onLog(line);
            } else {
              onLog(line);
            }
          });
        });

        proc.on('close', (code) => {
          resolve({ success: code === 0, code });
        });

        proc.on('error', (err) => {
          onLog(`✖ [error] ${err.message}`);
          resolve({ success: false, error: err.message, code: 1 });
        });
      } catch (err) {
        onLog(`✖ [exec exception] ${err.message}`);
        resolve({ success: false, error: err.message, code: 1 });
      }
    });
  }

  static async runPipeline(project, context) {
    const { updateStep, log } = context;
    let { repo, framework, branch = 'main', gitUrl, dbEngine = 'mariadb', port = 3000 } = project;

    // Normalize gitUrl and repo name if needed
    if (!gitUrl && repo.includes('/')) {
      const parsed = this.normalizeGitInput(repo);
      repo = parsed.repo;
      gitUrl = parsed.gitUrl;
    } else if (gitUrl) {
      const parsed = this.normalizeGitInput(gitUrl);
      gitUrl = parsed.gitUrl || gitUrl;
      if (!repo) repo = parsed.repo;
    }

    const projectDir = path.join(CONFIG.baseDir, repo);
    const domain = `${repo}.${CONFIG.domainBase}`;

    log(`================================================================`);
    log(`  AUTODEPLOY ENGINE v4.1 (PHP 8.4 Locked & Universal CI/CD)`);
    log(`  Repo: ${repo} | Runtime: PHP 8.4 | DB: ${dbEngine.toUpperCase()}`);
    log(`  Target Directory: ${projectDir}`);
    log(`  Public Domain   : https://${domain}`);
    log(`================================================================`);

    // Ensure target base folder
    fs.mkdirSync(projectDir, { recursive: true });

    // ================================================================
    // STEP 1: Git Safe Directory & Universal Sync / Clone
    // ================================================================
    updateStep(1, 'Sinkronisasi Git & Repository Input', 6);
    log(`[STEP 1/6] Menginisialisasi Git & sinkronisasi repository...`);

    // 1. Eksekusi git safe.directory secara global untuk mencegah error "dubious ownership"
    await this.execCommand(`git config --global --add safe.directory "*"`, projectDir, log);

    // 2. Deteksi default branch remote dinamis (main vs master)
    let targetBranch = branch || 'main';
    if (gitUrl) {
      try {
        const lsCheck = execSync(`git ls-remote --symref "${gitUrl}" HEAD 2>/dev/null`, { 
          timeout: 5000, 
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } 
        }).toString();
        const branchMatch = lsCheck.match(/ref:\s+refs\/heads\/([^\s]+)\s+HEAD/);
        if (branchMatch && branchMatch[1]) {
          targetBranch = branchMatch[1];
          log(`[GIT] Terdeteksi default branch remote repositori: '${targetBranch}'`);
        }
      } catch {
        // Fallback ke branch yang ditentukan jika ls-remote timeout/unreachable
      }
    }

    // 3. Sinkronisasi atau Clone
    if (fs.existsSync(path.join(projectDir, '.git'))) {
      log(`[GIT] Direktori sudah memiliki .git. Melakukan sinkronisasi branch '${targetBranch}'...`);
      let syncRes = await this.execCommand(`git fetch origin ${targetBranch} && git reset --hard origin/${targetBranch} && git clean -df`, projectDir, log);
      if (!syncRes.success) {
        const fallbackBranch = targetBranch === 'main' ? 'master' : 'main';
        log(`[GIT WARN] Fetch branch '${targetBranch}' gagal. Mencoba fallback ke branch '${fallbackBranch}'...`);
        syncRes = await this.execCommand(`git fetch origin ${fallbackBranch} && git reset --hard origin/${fallbackBranch} && git clean -df`, projectDir, log);
        if (!syncRes.success) {
          throw new Error(`Git fetch & reset gagal untuk branch '${targetBranch}' maupun fallback '${fallbackBranch}'.`);
        }
        targetBranch = fallbackBranch;
      }
      log(`[GIT SUCCESS] Berhasil menyinkronkan branch '${targetBranch}'.`);
    } else if (gitUrl) {
      const existingFiles = fs.existsSync(projectDir) ? fs.readdirSync(projectDir).filter(f => f !== '.' && f !== '..') : [];
      if (existingFiles.length === 0) {
        log(`[GIT] Meng-clone repository dari: ${gitUrl} (Branch: ${targetBranch})...`);
        let cloneRes = await this.execCommand(`git clone --depth 1 -b ${targetBranch} "${gitUrl}" .`, projectDir, log);
        if (!cloneRes.success) {
          const fallbackBranch = targetBranch === 'main' ? 'master' : 'main';
          log(`[GIT WARN] Clone branch '${targetBranch}' gagal. Mencoba fallback ke branch '${fallbackBranch}'...`);
          cloneRes = await this.execCommand(`git clone --depth 1 -b ${fallbackBranch} "${gitUrl}" .`, projectDir, log);
          if (!cloneRes.success) {
            throw new Error(`Git clone gagal untuk repository ${gitUrl}. Periksa URL atau autentikasi repositori.`);
          }
          targetBranch = fallbackBranch;
        }
        log(`[GIT SUCCESS] Repository berhasil di-clone (Branch: ${targetBranch}).`);
      } else {
        log(`[GIT] Direktori berisi ${existingFiles.length} item. Menginisialisasi git dan mengaitkan origin...`);
        const syncCmd = `git init && (git remote add origin "${gitUrl}" 2>/dev/null || git remote set-url origin "${gitUrl}") && git fetch --depth 1 origin ${targetBranch} && git checkout -f -B ${targetBranch} origin/${targetBranch}`;
        let initRes = await this.execCommand(syncCmd, projectDir, log);
        if (!initRes.success) {
          const fallbackBranch = targetBranch === 'main' ? 'master' : 'main';
          log(`[GIT WARN] Checkout branch '${targetBranch}' gagal. Mencoba fallback ke branch '${fallbackBranch}'...`);
          const retryCmd = `git init && (git remote add origin "${gitUrl}" 2>/dev/null || git remote set-url origin "${gitUrl}") && git fetch --depth 1 origin ${fallbackBranch} && git checkout -f -B ${fallbackBranch} origin/${fallbackBranch}`;
          initRes = await this.execCommand(retryCmd, projectDir, log);
          if (!initRes.success) {
            throw new Error(`Git checkout gagal untuk repository ${gitUrl}.`);
          }
          targetBranch = fallbackBranch;
        }
        log(`[GIT SUCCESS] Repository berhasil diinisialisasi dan di-checkout.`);
      }
    } else {
      log(`[GIT] Menggunakan kode sumber lokal yang sudah ada.`);
    }

    // Deteksi framework otomatis berdasarkan struktur file repositori
    let effectiveFramework = framework;
    if (fs.existsSync(path.join(projectDir, 'artisan'))) {
      effectiveFramework = 'laravel';
    } else if (
      fs.existsSync(path.join(projectDir, 'next.config.js')) || 
      fs.existsSync(path.join(projectDir, 'next.config.mjs')) || 
      fs.existsSync(path.join(projectDir, 'next.config.ts'))
    ) {
      effectiveFramework = 'nextjs';
    } else if (
      fs.existsSync(path.join(projectDir, 'composer.json')) || 
      fs.existsSync(path.join(projectDir, 'index.php'))
    ) {
      effectiveFramework = 'php-native';
    }
    log(`[FRAMEWORK DETECTED] Framework terdeteksi: ${effectiveFramework.toUpperCase()}`);

    // ================================================================
    // STEP 2: Database Provisioning & .env Configuration
    // ================================================================
    updateStep(2, `Setup Environment (.env) & Database Provisioning`, 6);
    log(`[STEP 2/6] Menyiapkan database ${dbEngine.toUpperCase()} & konfigurasi environment (.env)...`);

    const dbResult = await DatabaseProvisioner.provision(repo, dbEngine);
    dbResult.logs.forEach(l => log(l));

    const envPath = path.join(projectDir, '.env');
    const envExamplePath = path.join(projectDir, '.env.example');

    // Jika file .env belum ada, salin dari .env.example
    if (!fs.existsSync(envPath)) {
      if (fs.existsSync(envExamplePath)) {
        log(`[ENV] Menyalin template dari .env.example ke .env...`);
        fs.copyFileSync(envExamplePath, envPath);
      } else {
        log(`[ENV] .env.example tidak ditemukan. Membuat file .env baru...`);
        fs.writeFileSync(envPath, '');
      }

      let envContent = fs.readFileSync(envPath, 'utf8');

      // Inject kredensial database
      Object.entries(dbResult.envSnippet).forEach(([k, v]) => {
        const regex = new RegExp(`^#?\\s*${k}=.*`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${k}=${v}`);
        } else {
          envContent += `\n${k}=${v}`;
        }
      });

      // Inject APP_URL jika belum ada
      if (/^APP_URL=/m.test(envContent)) {
        envContent = envContent.replace(/^APP_URL=.*/m, `APP_URL=https://${domain}`);
      } else {
        envContent += `\nAPP_URL=https://${domain}`;
      }

      fs.writeFileSync(envPath, envContent.trim() + '\n');
      log(`[ENV] File .env berhasil dibuat dan dikonfigurasi.`);
    } else {
      log(`[ENV] File .env sudah ada, mempertahankan konfigurasi yang tersimpan.`);
    }

    // ================================================================
    // STEP 3: Install Dependencies (PHP 8.4 Locked & Composer)
    // ================================================================
    updateStep(3, 'Instalasi Dependensi (PHP 8.4 & Composer)', 6);
    log(`[STEP 3/6] Menginstal dependensi runtime menggunakan PHP 8.4...`);

    if (effectiveFramework === 'laravel') {
      log(`[COMPOSER] Menjalankan Composer install dengan binary: ${CONFIG.php}...`);
      // Wajib inject export COMPOSER_ALLOW_SUPERUSER=1 dan jalankan dengan PHP 8.4
      const composerCmd = `export COMPOSER_ALLOW_SUPERUSER=1 && ${CONFIG.php} ${CONFIG.composer} install --no-dev --optimize-autoloader --no-interaction`;
      const compRes = await this.execCommand(composerCmd, projectDir, log);

      if (!compRes.success) {
        log(`[COMPOSER WARN] 'composer install' gagal. Mencoba fallback dengan flag '--ignore-platform-req=php+'...`);
        const fallbackCmd = `export COMPOSER_ALLOW_SUPERUSER=1 && ${CONFIG.php} ${CONFIG.composer} install --no-dev --optimize-autoloader --no-interaction --ignore-platform-req=php+`;
        const fbRes = await this.execCommand(fallbackCmd, projectDir, log);
        if (!fbRes.success) {
          log(`[COMPOSER WARN] Fallback install gagal. Mencoba 'composer update --no-dev'...`);
          await this.execCommand(`export COMPOSER_ALLOW_SUPERUSER=1 && ${CONFIG.php} ${CONFIG.composer} update --no-dev --optimize-autoloader --no-interaction --ignore-platform-req=php+ || true`, projectDir, log);
        }
      }

      if (!fs.existsSync(path.join(projectDir, 'vendor', 'autoload.php'))) {
        throw new Error(`File 'vendor/autoload.php' tidak ditemukan setelah eksekusi composer! Instalasi dependensi gagal.`);
      }
      log(`[COMPOSER SUCCESS] Dependensi vendor Laravel berhasil terpasang.`);
    } else if (effectiveFramework === 'nextjs') {
      log(`[NPM] Menginstal dependensi Node.js...`);
      await this.execCommand(`${CONFIG.npmBin} install --prefer-offline || ${CONFIG.npmBin} install`, projectDir, log);
    } else if (fs.existsSync(path.join(projectDir, 'composer.json'))) {
      log(`[COMPOSER] Mendeteksi composer.json pada PHP Native. Menjalankan instalasi...`);
      await this.execCommand(`export COMPOSER_ALLOW_SUPERUSER=1 && ${CONFIG.php} ${CONFIG.composer} install --no-dev --optimize-autoloader --no-interaction || true`, projectDir, log);
    }

    // ================================================================
    // STEP 4: Build / Framework Pipeline (Laravel Artisan Setup)
    // ================================================================
    updateStep(4, effectiveFramework === 'nextjs' ? 'Building Next.js Application' : 'Eksekusi Build & Pipeline Framework', 6);
    log(`[STEP 4/6] Menjalankan pipeline framework: ${effectiveFramework}...`);

    let docRoot = projectDir;

    if (effectiveFramework === 'laravel') {
      docRoot = path.join(projectDir, 'public');
      fs.mkdirSync(docRoot, { recursive: true });

      if (!fs.existsSync(path.join(projectDir, 'artisan'))) {
        throw new Error(`File 'artisan' tidak ditemukan di ${projectDir}. Pastikan repositori adalah project Laravel.`);
      }

      // 1. Generate APP_KEY hanya jika APP_KEY di .env masih kosong
      const currentEnvContent = fs.readFileSync(envPath, 'utf8');
      const appKeyMatch = currentEnvContent.match(/^APP_KEY=(.*)$/m);
      const isAppKeyEmpty = !appKeyMatch || !appKeyMatch[1] || appKeyMatch[1].trim() === '';

      if (isAppKeyEmpty) {
        log(`[ARTISAN] APP_KEY belum ada atau kosong di .env. Membuat key baru...`);
        await this.execCommand(`${CONFIG.php} artisan key:generate --force`, projectDir, log);
      } else {
        log(`[ARTISAN] APP_KEY sudah terpasang. Melewati key:generate agar session/enkripsi tetap utuh.`);
      }

      // 2. Storage symlink
      log(`[ARTISAN] Menautkan storage public link...`);
      await this.execCommand(`${CONFIG.php} artisan storage:link --force || true`, projectDir, log);

      // 3. Database Migration dengan error handling anggun (graceful)
      log(`[ARTISAN] Menjalankan database migration...`);
      const migRes = await this.execCommand(`${CONFIG.php} artisan migrate --force`, projectDir, log);
      if (!migRes.success) {
        log(`[ARTISAN WARN] 'php artisan migrate --force' gagal atau database belum terhubung. Deployment tetap dilanjutkan.`);
      } else {
        log(`[ARTISAN SUCCESS] Migrasi database berhasil diterapkan.`);
      }

      // 4. Cache Clearing
      log(`[ARTISAN] Membersihkan application cache (optimize:clear)...`);
      await this.execCommand(`${CONFIG.php} artisan optimize:clear`, projectDir, log);
    } else if (effectiveFramework === 'nextjs') {
      log(`[NEXTJS] Menjalankan 'next build'...`);
      await this.execCommand(`${CONFIG.npmBin} run build`, projectDir, log);

      log(`[PM2] Memulai/merestart runner Next.js pada port ${port}...`);
      await this.execCommand(`${CONFIG.pm2Bin} restart next-${repo} || ${CONFIG.pm2Bin} start npm --name "next-${repo}" -- start -- -p ${port} || true`, projectDir, log);
    } else {
      // PHP Native
      docRoot = fs.existsSync(path.join(projectDir, 'public', 'index.php'))
        ? path.join(projectDir, 'public')
        : projectDir;
    }

    // ================================================================
    // STEP 5: Permissions & Ownership Hardening (www:www & 755/644/775)
    // ================================================================
    updateStep(5, 'Konfigurasi Izin Akses File & Keamanan (www:www)', 6);
    log(`[STEP 5/6] Menerapkan hak akses file standar Linux/aaPanel (www:www)...`);

    if (CONFIG.isProduction) {
      try {
        // chown -R www:www
        execSync(`chown -R ${CONFIG.webUser}:${CONFIG.webGroup} "${projectDir}" 2>/dev/null || true`);
        // find directories: 755
        execSync(`find "${projectDir}" -type d -exec chmod 755 {} + 2>/dev/null || true`);
        // find files: 644
        execSync(`find "${projectDir}" -type f -exec chmod 644 {} + 2>/dev/null || true`);

        // Khusus folder writable pada Laravel
        if (effectiveFramework === 'laravel') {
          execSync(`mkdir -p "${projectDir}/storage" "${projectDir}/bootstrap/cache" 2>/dev/null || true`);
          execSync(`chmod -R 775 "${projectDir}/storage" "${projectDir}/bootstrap/cache" 2>/dev/null || true`);
          execSync(`chown -R ${CONFIG.webUser}:${CONFIG.webGroup} "${projectDir}/storage" "${projectDir}/bootstrap/cache" 2>/dev/null || true`);
        }

        // File .env: 640
        if (fs.existsSync(envPath)) {
          execSync(`chmod 640 "${envPath}" 2>/dev/null || true`);
          execSync(`chown ${CONFIG.webUser}:${CONFIG.webGroup} "${envPath}" 2>/dev/null || true`);
        }

        log(`[PERM SUCCESS] Kepemilikan www:www dan izin 755 (dir), 644 (file), 775 (storage/cache) berhasil diterapkan.`);
      } catch (err) {
        log(`[PERM WARN] Sebagian izin file tidak dapat diterapkan: ${err.message}`);
      }
    } else {
      // Dev / Non-Linux Mock Mode
      try {
        if (effectiveFramework === 'laravel') {
          fs.mkdirSync(path.join(projectDir, 'storage'), { recursive: true });
          fs.mkdirSync(path.join(projectDir, 'bootstrap/cache'), { recursive: true });
        }
      } catch {}
      log(`[PERM] Lingkungan development/lokal - izin file disesuaikan.`);
    }

    // ================================================================
    // STEP 6: Virtual Host Nginx & Cloudflare Tunnel
    // ================================================================
    updateStep(6, 'Konfigurasi Nginx Virtual Host & Cloudflare', 6);
    log(`[STEP 6/6] Menerapkan konfigurasi Web Server Nginx & DNS...`);

    const nginxResult = NginxManager.applyConfig({
      repo,
      framework: effectiveFramework,
      domain,
      docRoot,
      port
    });
    nginxResult.logs.forEach(l => log(l));

    const cfResult = await CloudflareManager.syncSubdomain(
      repo,
      CONFIG.domainBase,
      effectiveFramework === 'nextjs' ? `http://localhost:${port}` : 'http://localhost:80'
    );
    cfResult.logs.forEach(l => log(l));

    log(`================================================================`);
    log(`  DEPLOYMENT BERHASIL! (STATUS: LIVE)`);
    log(`  URL: https://${domain}`);
    log(`  Runtime: PHP 8.4 | Framework: ${effectiveFramework} | Port: ${effectiveFramework === 'nextjs' ? port : 'PHP-FPM Socket'}`);
    log(`================================================================`);

    return {
      success: true,
      repo,
      framework: effectiveFramework,
      domain: `https://${domain}`,
      deployedAt: new Date().toISOString()
    };
  }
}

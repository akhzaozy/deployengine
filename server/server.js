import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import os from 'os';
import { CONFIG } from './config.js';
import { globalQueue, queueEvents } from './queue.js';
import { DeployRunner } from './deploy-runner.js';
import { WebhookHandler } from './webhook.js';
import { DatabaseProvisioner } from './db-provisioner.js';
import { AuthManager } from './auth.js';

const app = express();
const upload = multer({ dest: path.join(os.tmpdir(), 'autodeploy_uploads') });

// Enable raw body capture for GitHub Webhook HMAC verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(cors());

// In-memory or file-backed project database
const PROJECTS_FILE = path.join(CONFIG.metaDir, 'projects.json');

function loadProjects() {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    }
  } catch {}
  
  // Default seeded projects for Laravel, Next.js, and PHP Native (assigned only to demo user)
  return [
    {
      id: 'proj_laravel_app',
      ownerId: 'usr_default',
      repo: 'ecommerce-api',
      framework: 'laravel',
      branch: 'main',
      gitUrl: 'https://github.com/example/ecommerce-api.git',
      webhookSecret: 'secret_laravel_token_2026',
      dbEngine: 'mariadb',
      dbName: 'ecommerce_api',
      port: 8000,
      status: 'live',
      lastDeploy: new Date(Date.now() - 3600000).toISOString(),
      lastCommit: '7b2a91f: Add payment gateway callback handler'
    },
    {
      id: 'proj_nextjs_web',
      ownerId: 'usr_default',
      repo: 'frontend-portal',
      framework: 'nextjs',
      branch: 'main',
      gitUrl: 'https://github.com/example/frontend-portal.git',
      webhookSecret: 'secret_next_token_2026',
      dbEngine: 'postgres',
      dbName: 'frontend_portal_db',
      port: 3001,
      status: 'live',
      lastDeploy: new Date(Date.now() - 7200000).toISOString(),
      lastCommit: '3f901c8: Optimize server component hydration'
    },
    {
      id: 'proj_php_native',
      ownerId: 'usr_default',
      repo: 'inventory-system',
      framework: 'php-native',
      branch: 'master',
      gitUrl: 'https://github.com/example/inventory-system.git',
      webhookSecret: 'secret_native_token_2026',
      dbEngine: 'mariadb',
      dbName: 'inventory_db',
      port: 80,
      status: 'live',
      lastDeploy: new Date(Date.now() - 86400000).toISOString(),
      lastCommit: 'a12d904: Update stock reporting query'
    }
  ];
}

let projects = loadProjects();

function saveProjects() {
  try {
    fs.mkdirSync(path.dirname(PROJECTS_FILE), { recursive: true });
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
  } catch (e) {
    console.error('Error saving projects:', e.message);
  }
}

// Global SSE clients list
let sseClients = [];

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = Date.now() + Math.random().toString(36).slice(2);
  const client = { id: clientId, res };
  sseClients.push(client);

  // Send initial queue status immediately
  res.write(`data: ${JSON.stringify({ type: 'queue_status', status: globalQueue.getStatus() })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

function broadcastSSE(type, payload) {
  const data = JSON.stringify({ type, ...payload });
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch {}
  });
}

// Forward queue and log events to SSE clients
queueEvents.on('queue_update', (event) => {
  broadcastSSE('queue_update', event);
});

queueEvents.on('log', (event) => {
  broadcastSSE('terminal_log', event);
});

// ─────────────────────────────────────────────
// AUTHENTICATION ROUTES
// ─────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const result = AuthManager.login(username, password);
  if (!result.success) {
    return res.status(401).json(result);
  }
  res.json(result);
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, fullName, role } = req.body;
  const result = AuthManager.register(username, password, fullName, role);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const user = AuthManager.verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir' });
  }
  res.json({ success: true, user });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  AuthManager.logout(token);
  res.json({ success: true, message: 'Berhasil logout' });
});

// System Health & Statistics
app.get('/api/status', (req, res) => {
  res.json({
    uptime: os.uptime(),
    platform: os.platform(),
    arch: os.arch(),
    memory: {
      free: os.freemem(),
      total: os.totalmem()
    },
    cpus: os.cpus().length,
    config: {
      isProduction: CONFIG.isProduction,
      domainBase: CONFIG.domainBase,
      phpSocket: CONFIG.phpFpmSocket,
      baseDir: CONFIG.baseDir
    },
    queue: globalQueue.getStatus()
  });
});

// Projects Listing - Scoped to Authenticated User
app.get('/api/projects', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const user = AuthManager.verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Filter projects owned by this user. For new accounts, this will be empty ([])!
  const userProjects = projects.filter(p => p.ownerId === user.id);

  res.json(userProjects.map(p => ({
    ...p,
    domain: `https://${p.repo}.${CONFIG.domainBase}`,
    webhookUrl: `${req.protocol}://${req.get('host')}/api/webhook/github`
  })));
});

// Create / Update Project
app.post('/api/projects', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const user = AuthManager.verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { repo, framework, branch, gitUrl, webhookSecret, dbEngine, port } = req.body;
  if (!repo) {
    return res.status(400).json({ error: 'Nama repo wajib diisi' });
  }

  const cleanRepo = repo.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const existingIdx = projects.findIndex(p => p.repo === cleanRepo && p.ownerId === user.id);

  const projectData = {
    id: existingIdx >= 0 ? projects[existingIdx].id : 'proj_' + cleanRepo + '_' + Date.now().toString(36),
    ownerId: user.id,
    repo: cleanRepo,
    framework: framework || 'laravel',
    branch: branch || 'main',
    gitUrl: gitUrl || '',
    webhookSecret: webhookSecret || 'secret_' + Math.random().toString(36).slice(2, 10),
    dbEngine: dbEngine || 'mariadb',
    dbName: cleanRepo.replace(/-/g, '_'),
    port: port ? parseInt(port) : (framework === 'nextjs' ? 3000 + projects.length + 1 : 80),
    status: 'idle',
    lastDeploy: existingIdx >= 0 ? projects[existingIdx].lastDeploy : null,
    lastCommit: existingIdx >= 0 ? projects[existingIdx].lastCommit : 'Belum pernah di-deploy'
  };

  if (existingIdx >= 0) {
    projects[existingIdx] = { ...projects[existingIdx], ...projectData };
  } else {
    projects.push(projectData);
  }

  saveProjects();
  res.json({ success: true, project: projectData });
});

// Delete Project
app.delete('/api/projects/:repo', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const user = AuthManager.verifyToken(token);

  const { repo } = req.params;
  projects = projects.filter(p => !(p.repo === repo && (!user || p.ownerId === user.id)));
  saveProjects();
  res.json({ success: true, message: `Project ${repo} dihapus.` });
});

// Manual Deploy Trigger (passes into Queue Mutex with ETA calculation)
app.post('/api/projects/:repo/deploy', async (req, res) => {
  const { repo } = req.params;
  const project = projects.find(p => p.repo === repo);
  if (!project) {
    return res.status(404).json({ error: 'Project tidak ditemukan' });
  }

  // Extract authenticated user
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const user = AuthManager.verifyToken(token);

  const defaultTrigger = user ? `@${user.username} (${user.fullName})` : 'Web Dashboard';
  const triggerBy = req.body.triggerBy || defaultTrigger;
  const commitMsg = req.body.commitMsg || `Manual deployment triggered by ${triggerBy}`;

  // Queue the build with deployer user details
  const queuePromise = globalQueue.enqueue({
    repo: project.repo,
    framework: project.framework,
    triggerBy,
    userId: user?.id || null,
    username: user?.username || 'anonymous',
    commit: commitMsg,
    branch: project.branch
  }, async (context) => {
    project.status = 'building';
    saveProjects();

    try {
      const result = await DeployRunner.runPipeline(project, context);
      project.status = 'live';
      project.lastDeploy = new Date().toISOString();
      project.lastCommit = commitMsg;
      saveProjects();
      return result;
    } catch (err) {
      project.status = 'failed';
      saveProjects();
      throw err;
    }
  });

  const status = globalQueue.getStatus();
  res.json({
    success: true,
    message: status.isLocked && status.queueLength > 0
      ? 'Deploy sedang berlangsung. Job Anda dimasukkan ke dalam antrian.'
      : 'Deployment dimulai.',
    queueStatus: status
  });
});

// Get Queue & Countdown Status
app.get('/api/queue/status', (req, res) => {
  res.json(globalQueue.getStatus());
});

// Get .env content
app.get('/api/projects/:repo/env', (req, res) => {
  const { repo } = req.params;
  const envPath = path.join(CONFIG.baseDir, repo, '.env');
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    return res.json({ success: true, content, exists: true });
  }

  // Fallback template
  const p = projects.find(x => x.repo === repo);
  const sampleEnv = p?.framework === 'nextjs'
    ? `NEXT_PUBLIC_APP_NAME="My Next.js Portal"\nDATABASE_URL="${p.dbEngine === 'postgres' ? 'postgresql://deploysiitk:deploysiitk2026@127.0.0.1:5432/' + p.dbName : 'mysql://deploysiitk:deploysiitk2026@127.0.0.1:3306/' + p.dbName}"\nPORT=${p.port || 3001}\n`
    : `APP_NAME="${repo}"\nAPP_ENV=production\nAPP_KEY=\nAPP_DEBUG=false\nAPP_URL=https://${repo}.${CONFIG.domainBase}\n\nDB_CONNECTION=${p?.dbEngine === 'postgres' ? 'pgsql' : 'mysql'}\nDB_HOST=127.0.0.1\nDB_PORT=${p?.dbEngine === 'postgres' ? '5432' : '3306'}\nDB_DATABASE=${p?.dbName || repo}\nDB_USERNAME=deploysiitk\nDB_PASSWORD=deploysiitk2026\n`;

  res.json({ success: true, content: sampleEnv, exists: false });
});

// Save .env content directly
app.post('/api/projects/:repo/env', (req, res) => {
  const { repo } = req.params;
  const { content } = req.body;
  if (content === undefined) {
    return res.status(400).json({ error: 'Konten .env tidak boleh kosong' });
  }

  const projectDir = path.join(CONFIG.baseDir, repo);
  fs.mkdirSync(projectDir, { recursive: true });
  const envPath = path.join(projectDir, '.env');

  // Backup existing .env if present
  if (fs.existsSync(envPath)) {
    const backupPath = path.join(projectDir, `.env.backup.${Date.now()}`);
    fs.copyFileSync(envPath, backupPath);
  }

  fs.writeFileSync(envPath, content);
  res.json({ success: true, message: 'File .env berhasil disimpan!' });
});

// Upload .env file
app.post('/api/projects/:repo/env/upload', upload.single('file'), (req, res) => {
  const { repo } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'File tidak ditemukan' });
  }

  const projectDir = path.join(CONFIG.baseDir, repo);
  fs.mkdirSync(projectDir, { recursive: true });
  const envPath = path.join(projectDir, '.env');

  try {
    const uploadedContent = fs.readFileSync(req.file.path, 'utf8');
    // Backup existing
    if (fs.existsSync(envPath)) {
      const backupPath = path.join(projectDir, `.env.backup.${Date.now()}`);
      fs.copyFileSync(envPath, backupPath);
    }

    fs.writeFileSync(envPath, uploadedContent);
    try { fs.unlinkSync(req.file.path); } catch {}

    res.json({ success: true, message: 'File .env berhasil diupload dan disimpan!' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memproses upload: ' + err.message });
  }
});

// Database Provisioning on Demand
app.post('/api/projects/:repo/db-provision', async (req, res) => {
  const { repo } = req.params;
  const { engine } = req.body;
  const result = await DatabaseProvisioner.provision(repo, engine || 'mariadb');
  res.json(result);
});

// GitHub Webhook Endpoint
app.post('/api/webhook/github', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'] || 'push';

  if (event === 'ping') {
    return res.json({ message: 'Pong! Webhook terhubung dengan AutoDeploy.' });
  }

  const repoName = req.body?.repository?.name;
  const project = projects.find(p => p.repo.toLowerCase() === (repoName || '').toLowerCase());

  // Check signature if secret configured
  if (project?.webhookSecret && signature) {
    const valid = WebhookHandler.verifySignature(project.webhookSecret, signature, req.rawBody);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }
  }

  const result = await WebhookHandler.handleGitHubPush(req.body, projects);
  res.json(result);
});

// Test Webhook Simulation endpoint (for user to easily test git push trigger from web UI)
app.post('/api/webhook/test-trigger', async (req, res) => {
  const { repo, commitMsg, author } = req.body;
  const project = projects.find(p => p.repo === repo);
  if (!project) {
    return res.status(404).json({ error: 'Project tidak ditemukan' });
  }

  const dummyPayload = {
    ref: `refs/heads/${project.branch || 'main'}`,
    repository: { name: project.repo },
    pusher: { name: author || 'developer-git' },
    head_commit: {
      id: Math.random().toString(16).slice(2, 10) + 'ab91',
      message: commitMsg || 'Feat: automatic pipeline deployment triggered'
    }
  };

  const result = await WebhookHandler.handleGitHubPush(dummyPayload, projects);
  res.json({ success: true, result });
});

// Serve built frontend assets if dist folder exists
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Start Server
const PORT = CONFIG.port;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[AutoDeploy Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[AutoDeploy Server] Mode: ${CONFIG.isProduction ? 'Linux Production' : 'Development/Mock'}`);
});

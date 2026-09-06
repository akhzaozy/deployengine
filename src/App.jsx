import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from './components/Navbar';
import { ProjectCard } from './components/ProjectCard';
import { FreezeCountdown } from './components/FreezeCountdown';
import { EnvManagerModal } from './components/EnvManagerModal';
import { DatabaseModal } from './components/DatabaseModal';
import { WebhookModal } from './components/WebhookModal';
import { NewProjectModal } from './components/NewProjectModal';
import { TerminalLogs } from './components/TerminalLogs';
import { LoginModal } from './components/LoginModal';
import { api } from './lib/api';
import { Server, Database, Layers, Search, Plus, Play, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';

export function App() {
  // Theme state: 'dark' | 'light'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('autodeploy_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('autodeploy_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Auth state
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('autodeploy_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [status, setStatus] = useState(null);
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [queueStatus, setQueueStatus] = useState({ isLocked: false, currentJob: null, queuedJobs: [], queueLength: 0 });

  // Filter & Search state
  const [filterFramework, setFilterFramework] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedProjectForEnv, setSelectedProjectForEnv] = useState(null);
  const [selectedProjectForDb, setSelectedProjectForDb] = useState(null);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('autodeploy_token')) {
      api.getMe().then(res => {
        if (res.success && res.user) {
          setCurrentUser(res.user);
        } else {
          setCurrentUser(null);
        }
      }).catch(() => {});
    }

    fetchInitialData();
    const cleanupSSE = setupSSE();
    return () => cleanupSSE?.();
  }, [currentUser?.id]);

  async function fetchInitialData() {
    try {
      const [statusRes, projectsRes] = await Promise.all([
        api.getStatus(),
        api.getProjects()
      ]);
      setStatus(statusRes);
      setProjects(Array.isArray(projectsRes) ? projectsRes : []);
      if (statusRes.queue) {
        setQueueStatus(statusRes.queue);
      }
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  }

  function setupSSE() {
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'queue_status' || payload.type === 'queue_update') {
          const newQueue = payload.status || payload.data?.status;
          if (newQueue) {
            setQueueStatus(newQueue);
            // Refresh projects if a job completed so live status updates
            if (payload.type === 'job_completed') {
              fetchInitialData();
            }
          }
        } else if (payload.type === 'terminal_log') {
          setLogs(prev => [...prev.slice(-400), payload]);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    return () => eventSource.close();
  }

  async function handleDeploy(repo) {
    try {
      const authorText = currentUser ? `@${currentUser.username}` : 'Web Dashboard';
      const res = await api.triggerDeploy(repo, authorText, `Manual deployment by ${authorText}`);
      if (res.queueStatus) {
        setQueueStatus(res.queueStatus);
      }
      fetchInitialData();
    } catch (err) {
      alert('Gagal memicu deployment: ' + err.message);
    }
  }

  async function handleDeleteProject(repo) {
    if (!confirm(`Hapus konfigurasi project '${repo}'?`)) return;
    try {
      await api.deleteProject(repo);
      fetchInitialData();
    } catch (err) {
      alert('Gagal menghapus project: ' + err.message);
    }
  }

  async function handleLogout() {
    await api.logout();
    setCurrentUser(null);
    setProjects([]);
  }

  // Determine if the currently logged in user is the deployer
  const isLocked = queueStatus?.isLocked;
  const isDeployer = isLocked && (
    (queueStatus.currentJob?.userId && queueStatus.currentJob.userId === currentUser?.id) ||
    (queueStatus.currentJob?.username && queueStatus.currentJob.username === currentUser?.username)
  );

  const filteredProjects = projects.filter(p => {
    const matchFw = filterFramework === 'all' || p.framework === filterFramework;
    const matchSearch = p.repo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFw && matchSearch;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', paddingBottom: 60, transition: 'background-color 0.25s ease' }}>
      {/* If not logged in, display Login Screen with Mascot & Light/Dark Switcher */}
      {!currentUser ? (
        <LoginModal
          onLoginSuccess={(u) => {
            setCurrentUser(u);
            fetchInitialData();
          }}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <>
          {/* Navbar with Theme Switcher, Metrics, and User Profile */}
          <Navbar
            status={status}
            currentUser={currentUser}
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
            onNewProject={() => setShowNewProjectModal(true)}
            onOpenWebhookTest={() => setShowWebhookModal(true)}
            onRefresh={fetchInitialData}
          />

          {/* Main Container */}
          <main style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 28px 0 28px' }}>
            
            {/* Deployer Active Build Banner (Shown ONLY to the deployer so they can see logs) */}
            {isDeployer && (
              <div style={{
                background: 'linear-gradient(90deg, rgba(14, 165, 233, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
                border: '1px solid #0ea5e9',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="pulse-dot building" style={{ width: 10, height: 10 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                      Deployment Anda Sedang Berjalan: <strong style={{ color: 'var(--accent-cyan)' }}>{queueStatus.currentJob?.repo}</strong> ({queueStatus.currentJob?.framework})
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Tahap {queueStatus.currentJob?.step} dari {queueStatus.currentJob?.totalSteps}: <strong>{queueStatus.currentJob?.stepName}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    background: 'var(--bg-surface)',
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)',
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)'
                  }}>
                    Estimasi Sisa: <strong style={{ color: '#0ea5e9' }}>{queueStatus.currentJob?.remainingSeconds}s</strong>
                  </div>
                  <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                    👀 Live Log Streaming Aktif
                  </span>
                </div>
              </div>
            )}

            {/* Top Summary Info Banner */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginBottom: 28
            }}>
              {/* Engine Card */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14
              }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  background: 'rgba(14, 165, 233, 0.12)',
                  color: 'var(--accent-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Server size={20} />
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    Server Host & Domain Base
                  </span>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    *.{status?.config?.domainBase || 'akhzafachrozy.my.id'}
                  </h4>
                  <p style={{ fontSize: 11, color: '#10b981' }}>
                    Nginx FastCGI + Cloudflare Tunnel Active
                  </p>
                </div>
              </div>

              {/* Database Support Card */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14
              }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Database size={20} />
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    Database Servers
                  </span>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    MariaDB 3306 · PostgreSQL 5432
                  </h4>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Auto-provision user & schema per-repo
                  </p>
                </div>
              </div>

              {/* Framework Matrix Card */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14
              }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: 'var(--accent-indigo)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Layers size={20} />
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    Supported Frameworks
                  </span>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Laravel · Next.js · PHP Native
                  </h4>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Composer, Artisan & Node runner enabled
                  </p>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
              marginBottom: 20
            }}>
              {/* Framework tabs */}
              <div style={{ display: 'flex', gap: 6, background: 'var(--bg-surface)', padding: 4, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                {[
                  { id: 'all', label: 'Semua Project' },
                  { id: 'laravel', label: 'Laravel' },
                  { id: 'nextjs', label: 'Next.js' },
                  { id: 'php-native', label: 'PHP Native' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterFramework(tab.id)}
                    style={{
                      background: filterFramework === tab.id ? 'var(--bg-surface-hover)' : 'transparent',
                      color: filterFramework === tab.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative', width: 280 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Cari repositori..."
                  className="form-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 32, fontSize: 12.5 }}
                />
              </div>
            </div>

            {/* Projects Grid */}
            {filteredProjects.length > 0 ? (
              <div className="projects-grid">
                {filteredProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDeploy={handleDeploy}
                    onOpenEnv={(p) => setSelectedProjectForEnv(p)}
                    onOpenDb={(p) => setSelectedProjectForDb(p)}
                    onDelete={handleDeleteProject}
                  />
                ))}
              </div>
            ) : (
              /* Empty state for fresh accounts */
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '60px 20px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(14, 165, 233, 0.1)',
                  color: 'var(--accent-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}>
                  <Plus size={24} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Belum Ada Project
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 420, margin: '0 auto 18px auto' }}>
                  Akun Anda belum memiliki project deployment. Daftarkan repositori pertama Anda (Laravel, Next.js, atau PHP Native) sekarang.
                </p>
                <button
                  onClick={() => setShowNewProjectModal(true)}
                  className="btn btn-primary"
                  style={{ fontSize: 13, padding: '9px 18px' }}
                >
                  <Plus size={15} />
                  Tambah Project Pertama
                </button>
              </div>
            )}

            {/* Real-time Terminal Log Viewer (Deployer sees live logs in real time!) */}
            <TerminalLogs
              logs={logs}
              activeRepo={queueStatus?.currentJob?.repo}
              onClear={() => setLogs([])}
            />
          </main>

          {/* Freeze Screen Overlay: Shown ONLY to OTHER users while a build is in progress! */}
          <AnimatePresence>
            {isLocked && !isDeployer && (
              <FreezeCountdown queueStatus={queueStatus} />
            )}
          </AnimatePresence>

          {/* .env Manager Modal */}
          {selectedProjectForEnv && (
            <EnvManagerModal
              project={selectedProjectForEnv}
              onClose={() => setSelectedProjectForEnv(null)}
              onSaved={fetchInitialData}
            />
          )}

          {/* Database Provisioning Modal */}
          {selectedProjectForDb && (
            <DatabaseModal
              project={selectedProjectForDb}
              onClose={() => setSelectedProjectForDb(null)}
              onUpdated={fetchInitialData}
            />
          )}

          {/* Webhook Settings & Simulator Modal */}
          {showWebhookModal && (
            <WebhookModal
              projects={projects}
              onClose={() => setShowWebhookModal(false)}
              onTriggered={fetchInitialData}
            />
          )}

          {/* New Project Registration Modal */}
          {showNewProjectModal && (
            <NewProjectModal
              onClose={() => setShowNewProjectModal(false)}
              onCreated={fetchInitialData}
            />
          )}
        </>
      )}
    </div>
  );
}

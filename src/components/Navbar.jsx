import React from 'react';
import { Server, Plus, RefreshCw, GitPullRequest, LogOut, Sun, Moon } from 'lucide-react';

export function Navbar({ status, currentUser, theme, onToggleTheme, onLogout, onNewProject, onOpenWebhookTest, onRefresh }) {
  const isLocked = status?.queue?.isLocked;
  const queueLength = status?.queue?.queueLength || 0;

  const userInitials = currentUser?.fullName
    ? currentUser.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : (currentUser?.username?.slice(0, 2).toUpperCase() || 'US');

  return (
    <header style={{
      background: theme === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(10, 15, 24, 0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '14px 28px'
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        {/* Brand & Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 38,
            height: 38,
            background: 'linear-gradient(135deg, #0ea5e9 0%, #1e293b 100%)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid #38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 16px rgba(14, 165, 233, 0.3)'
          }}>
            <Server size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                AUTODEPLOY
              </span>
              <span style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: '#0284c7',
                background: 'rgba(14, 165, 233, 0.12)',
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid rgba(14, 165, 233, 0.3)'
              }}>
                v4.0 CLOUD
              </span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Multi-Framework CI/CD Engine (Laravel · Next.js · PHP Native)
            </p>
          </div>
        </div>

        {/* Center System Metrics */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'var(--bg-surface)',
          padding: '6px 14px',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span className={`pulse-dot ${isLocked ? 'building' : 'live'}`} />
            <span style={{ color: 'var(--text-secondary)' }}>
              Engine: <strong style={{ color: isLocked ? '#0ea5e9' : '#10b981' }}>{isLocked ? 'BUSY / BUILDING' : 'IDLE / READY'}</strong>
            </span>
          </div>

          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />

          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Antrian: <strong style={{ color: queueLength > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{queueLength} job</strong>
          </div>

          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />

          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            DB Engines: <span className="mono" style={{ color: 'var(--accent-cyan)', fontSize: 11 }}>MariaDB + Postgres</span>
          </div>
        </div>

        {/* Right Actions & User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={onToggleTheme}
            className="btn btn-secondary"
            title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            style={{ padding: '8px 10px', borderRadius: 8 }}
          >
            {theme === 'dark' ? <Sun size={15} style={{ color: '#f59e0b' }} /> : <Moon size={15} style={{ color: '#0284c7' }} />}
          </button>

          <button
            onClick={onRefresh}
            className="btn btn-secondary"
            title="Refresh Status"
            style={{ padding: '8px 10px' }}
          >
            <RefreshCw size={14} />
          </button>

          <button
            onClick={onOpenWebhookTest}
            className="btn btn-secondary"
            style={{ fontSize: 12.5 }}
          >
            <GitPullRequest size={14} style={{ color: 'var(--accent-cyan)' }} />
            Simulasi Git Push
          </button>

          <button
            onClick={onNewProject}
            className="btn btn-primary"
            style={{ fontSize: 12.5 }}
          >
            <Plus size={15} />
            Tambah Project
          </button>

          {/* User Profile Widget (Single role) */}
          {currentUser && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-prominent)',
              padding: '4px 10px 4px 6px',
              borderRadius: 8
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 800,
                color: '#fff'
              }}>
                {userInitials}
              </div>
              <div style={{ lineHeight: 1.2, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {currentUser.username}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {currentUser.fullName || 'User'}
                </div>
              </div>
              <button
                onClick={onLogout}
                className="btn btn-secondary"
                style={{ padding: '4px 6px', marginLeft: 4, border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
                title="Logout"
              >
                <LogOut size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

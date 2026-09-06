import React, { useState } from 'react';
import { Play, ExternalLink, Shield, Database, GitBranch, GitCommit, Trash2, Clock } from 'lucide-react';

export function ProjectCard({ project, onDeploy, onOpenEnv, onOpenDb, onDelete }) {
  const [deploying, setDeploying] = useState(false);

  async function handleDeploy() {
    setDeploying(true);
    try {
      await onDeploy(project.repo);
    } finally {
      setTimeout(() => setDeploying(false), 800);
    }
  }

  const frameworkColor = {
    'laravel': '#f43f5e',
    'nextjs': '#0ea5e9',
    'php-native': '#8b5cf6'
  }[project.framework] || '#64748b';

  return (
    <div style={{
      background: '#0d131f',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Top Bar: Framework & Status */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: frameworkColor,
              boxShadow: `0 0 8px ${frameworkColor}`
            }} />
            <span className="mono" style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#f8fafc',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              {project.framework}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {project.framework === 'nextjs' ? `Port :${project.port || 3001}` : 'PHP-FPM'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`badge ${
              project.status === 'live' ? 'badge-live' :
              project.status === 'building' ? 'badge-building' :
              project.status === 'failed' ? 'badge-failed' : 'badge-neutral'
            }`}>
              <span className={`pulse-dot ${project.status === 'live' ? 'live' : project.status === 'building' ? 'building' : ''}`} />
              {project.status || 'idle'}
            </span>
          </div>
        </div>

        {/* Project Name & Domain */}
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: 4 }}>
            {project.repo}
          </h3>
          <a
            href={project.domain}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 12,
              color: '#38bdf8',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'var(--font-mono)'
            }}
          >
            <span>{project.domain?.replace('https://', '')}</span>
            <ExternalLink size={11} />
          </a>
        </div>

        {/* Git & Branch Details */}
        <div style={{
          background: '#070b12',
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid #162030',
          marginBottom: 16,
          fontSize: 11.5
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', marginBottom: 6 }}>
            <GitBranch size={13} style={{ color: '#0ea5e9' }} />
            <span className="mono" style={{ color: '#e2e8f0', fontWeight: 600 }}>{project.branch || 'main'}</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <Database size={12} style={{ color: '#10b981' }} />
            <span className="mono" style={{ color: '#34d399' }}>{project.dbEngine || 'mariadb'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: 'var(--text-muted)' }}>
            <GitCommit size={13} style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontFamily: 'var(--font-mono)',
              fontSize: 11
            }}>
              {project.lastCommit || 'Siap untuk deployment pertama'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
          <button
            onClick={() => onOpenEnv(project)}
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '6px 4px' }}
            title="Kelola Environment .env"
          >
            <Shield size={12} />
            .env
          </button>
          <button
            onClick={() => onOpenDb(project)}
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '6px 4px' }}
            title="Pengaturan Database"
          >
            <Database size={12} />
            Database
          </button>
          <button
            onClick={() => onDelete(project.repo)}
            className="btn btn-danger"
            style={{ fontSize: 11, padding: '6px 4px' }}
            title="Hapus Project"
          >
            <Trash2 size={12} />
            Hapus
          </button>
        </div>

        <button
          onClick={handleDeploy}
          disabled={deploying}
          className="btn btn-primary"
          style={{ width: '100%', padding: '9px 12px' }}
        >
          <Play size={14} />
          {deploying ? 'Mengirim ke Antrian...' : 'Deploy & Build Sekarang'}
        </button>
      </div>
    </div>
  );
}

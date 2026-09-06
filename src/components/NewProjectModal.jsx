import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Server, GitBranch, Database, Shield } from 'lucide-react';
import { api } from '../lib/api';

export function NewProjectModal({ onClose, onCreated }) {
  const [repo, setRepo] = useState('');
  const [framework, setFramework] = useState('laravel');
  const [branch, setBranch] = useState('main');
  const [gitUrl, setGitUrl] = useState('');
  const [dbEngine, setDbEngine] = useState('mariadb');
  const [port, setPort] = useState('3000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!repo) {
      setError('Nama repositori wajib diisi');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.createOrUpdateProject({
        repo,
        framework,
        branch,
        gitUrl,
        dbEngine,
        port
      });
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-card"
        style={{ maxWidth: 580 }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'rgba(14, 165, 233, 0.15)',
              padding: 8,
              borderRadius: 6,
              color: '#38bdf8'
            }}>
              <Plus size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                Tambah Project Baru
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Dukungan Framework: Laravel, Next.js, & PHP Native
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: 6 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#f87171',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 12,
                marginBottom: 14
              }}>
                {error}
              </div>
            )}

            {/* Repo Name */}
            <div className="form-group">
              <label className="form-label">Nama Repositori / Slug Project *</label>
              <input
                className="form-input mono"
                placeholder="contoh: portal-akademik"
                value={repo}
                onChange={(e) => setRepo(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Subdomain: https://{repo || 'nama-repo'}.akhzafachrozy.my.id
              </span>
            </div>

            {/* Framework Selection */}
            <div className="form-group">
              <label className="form-label">Tipe Framework / Runtime</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { id: 'laravel', name: 'Laravel', desc: 'PHP 8.3 + FPM' },
                  { id: 'nextjs', name: 'Next.js', desc: 'Node.js + PM2' },
                  { id: 'php-native', name: 'PHP Native', desc: 'FastCGI Docroot' }
                ].map((fw) => (
                  <div
                    key={fw.id}
                    onClick={() => setFramework(fw.id)}
                    style={{
                      border: `1px solid ${framework === fw.id ? '#0ea5e9' : 'var(--border-subtle)'}`,
                      background: framework === fw.id ? 'rgba(14, 165, 233, 0.08)' : '#070b12',
                      borderRadius: 8,
                      padding: 10,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: framework === fw.id ? '#38bdf8' : '#f1f5f9' }}>
                      {fw.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {fw.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Database Selection */}
            <div className="form-group">
              <label className="form-label">Server Database</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { id: 'mariadb', name: 'MariaDB / MySQL', port: '3306' },
                  { id: 'postgres', name: 'PostgreSQL', port: '5432' }
                ].map((db) => (
                  <div
                    key={db.id}
                    onClick={() => setDbEngine(db.id)}
                    style={{
                      border: `1px solid ${dbEngine === db.id ? '#0ea5e9' : 'var(--border-subtle)'}`,
                      background: dbEngine === db.id ? 'rgba(14, 165, 233, 0.08)' : '#070b12',
                      borderRadius: 8,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <Database size={15} style={{ color: dbEngine === db.id ? '#38bdf8' : '#64748b' }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{db.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Port {db.port}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Branch & Port */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Target Git Branch</label>
                <input
                  className="form-input mono"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>

              {framework === 'nextjs' && (
                <div className="form-group">
                  <label className="form-label">Node Runner Port</label>
                  <input
                    className="form-input mono"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Git URL */}
            <div className="form-group">
              <label className="form-label">GitHub Repository URL (Opsional)</label>
              <input
                className="form-input mono"
                placeholder="https://github.com/username/repository.git"
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              <Plus size={14} />
              {loading ? 'Menyimpan...' : 'Daftarkan Project'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

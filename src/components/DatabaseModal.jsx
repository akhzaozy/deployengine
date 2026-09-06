import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Database, Check, Copy, RefreshCw, Server, Shield } from 'lucide-react';
import { api } from '../lib/api';

export function DatabaseModal({ project, onClose, onUpdated }) {
  const [engine, setEngine] = useState(project.dbEngine || 'mariadb');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(null);

  const dbName = project.dbName || project.repo.replace(/-/g, '_');
  const dbUser = 'deploysiitk';
  const dbPass = 'deploysiitk2026';
  const host = '127.0.0.1';
  const port = engine === 'postgres' ? 5432 : 3306;
  const connUrl = engine === 'postgres'
    ? `postgresql://${dbUser}:${dbPass}@${host}:${port}/${dbName}?schema=public`
    : `mysql://${dbUser}:${dbPass}@${host}:${port}/${dbName}`;

  async function handleProvision() {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.provisionDb(project.repo, engine);
      setResult(res);
      if (onUpdated) onUpdated();
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  function copyText(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-card"
        style={{ maxWidth: 640 }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              padding: 8,
              borderRadius: 6,
              color: '#34d399'
            }}>
              <Database size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                Server Database Engine · {project.repo}
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Dukungan Native: MariaDB (MySQL Compatible) & PostgreSQL
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: 6 }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Engine Selector */}
          <div className="form-group">
            <label className="form-label">Pilih Engine Database Server</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div
                onClick={() => setEngine('mariadb')}
                style={{
                  border: `1px solid ${engine === 'mariadb' ? '#0ea5e9' : 'var(--border-subtle)'}`,
                  background: engine === 'mariadb' ? 'rgba(14, 165, 233, 0.08)' : '#070b12',
                  borderRadius: 'var(--radius-md)',
                  padding: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: '#132034',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Database size={16} />
                </div>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>MariaDB / MySQL</h4>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Port 3306 · Default Laravel/PHP</p>
                </div>
              </div>

              <div
                onClick={() => setEngine('postgres')}
                style={{
                  border: `1px solid ${engine === 'postgres' ? '#0ea5e9' : 'var(--border-subtle)'}`,
                  background: engine === 'postgres' ? 'rgba(14, 165, 233, 0.08)' : '#070b12',
                  borderRadius: 'var(--radius-md)',
                  padding: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: '#132034',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Server size={16} />
                </div>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>PostgreSQL</h4>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Port 5432 · Ideal Next.js/Prisma</p>
                </div>
              </div>
            </div>
          </div>

          {/* Credentials Info Grid */}
          <div style={{
            background: '#070c14',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            marginBottom: 20
          }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Kredensial Server Database Terisolasi:
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, marginBottom: 12 }}>
              <div style={{ background: '#0e1522', padding: '8px 12px', borderRadius: 6, border: '1px solid #1a2538' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>DATABASE NAME</span>
                <strong className="mono" style={{ color: '#f1f5f9' }}>{dbName}</strong>
              </div>
              <div style={{ background: '#0e1522', padding: '8px 12px', borderRadius: 6, border: '1px solid #1a2538' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>USERNAME</span>
                <strong className="mono" style={{ color: '#f1f5f9' }}>{dbUser}</strong>
              </div>
              <div style={{ background: '#0e1522', padding: '8px 12px', borderRadius: 6, border: '1px solid #1a2538' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>PASSWORD</span>
                <strong className="mono" style={{ color: '#38bdf8' }}>{dbPass}</strong>
              </div>
              <div style={{ background: '#0e1522', padding: '8px 12px', borderRadius: 6, border: '1px solid #1a2538' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>HOST & PORT</span>
                <strong className="mono" style={{ color: '#f1f5f9' }}>{host}:{port}</strong>
              </div>
            </div>

            {/* Connection String */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Connection URL (DATABASE_URL):
                </span>
                <button
                  onClick={() => copyText(connUrl, 'url')}
                  className="btn btn-secondary"
                  style={{ padding: '3px 8px', fontSize: 10 }}
                >
                  {copied === 'url' ? <Check size={11} style={{ color: '#34d399' }} /> : <Copy size={11} />}
                  {copied === 'url' ? 'Tersalin' : 'Salin URL'}
                </button>
              </div>
              <div className="mono" style={{
                background: '#05070c',
                padding: '8px 10px',
                borderRadius: 6,
                fontSize: 11,
                color: '#38bdf8',
                border: '1px solid var(--border-subtle)',
                wordBreak: 'break-all'
              }}>
                {connUrl}
              </div>
            </div>
          </div>

          {/* Provisioning Logs Output */}
          {result && (
            <div style={{
              background: '#05070c',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: 12,
              marginBottom: 16
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: result.error ? '#f87171' : '#34d399', marginBottom: 6 }}>
                {result.error ? 'Provisioning Gagal' : 'Database & User Berhasil Dikonfigurasi!'}
              </div>
              {result.logs?.map((l, i) => (
                <div key={i} className="mono" style={{ fontSize: 11, color: '#94a3b8' }}>
                  {l}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Tutup
          </button>
          <button
            onClick={handleProvision}
            disabled={loading}
            className="btn btn-primary"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Memproses Database...' : `Provision Database ${engine.toUpperCase()}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

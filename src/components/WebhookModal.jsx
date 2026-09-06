import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, GitPullRequest, Copy, Check, Play, Shield, Terminal, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';

export function WebhookModal({ project, projects, onClose, onTriggered }) {
  const [selectedRepo, setSelectedRepo] = useState(project ? project.repo : (projects[0]?.repo || ''));
  const [commitMsg, setCommitMsg] = useState('feat: update core API logic & database migrations');
  const [author, setAuthor] = useState('developer-github');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(null);

  const activeProject = projects.find(p => p.repo === selectedRepo) || projects[0];
  const webhookUrl = `${window.location.origin}/api/webhook/github`;
  const secret = activeProject?.webhookSecret || 'secret_autodeploy_2026';

  function copyText(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleSimulatePush() {
    setSending(true);
    setResult(null);
    try {
      const res = await api.testWebhook(selectedRepo, commitMsg, author);
      setResult(res);
      if (onTriggered) onTriggered();
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-card"
        style={{ maxWidth: 700 }}
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
              <GitPullRequest size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                GitHub Webhook & AutoBuild Engine
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Koneksi otomatis GitHub ke server AutoDeploy (HMAC-SHA256)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: 6 }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Webhook Configuration Box */}
          <div style={{
            background: '#070c14',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            marginBottom: 20
          }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pengaturan Webhook di GitHub Repository:
            </h4>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Payload URL:</span>
                <button
                  onClick={() => copyText(webhookUrl, 'url')}
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: 10 }}
                >
                  {copied === 'url' ? <Check size={11} style={{ color: '#34d399' }} /> : <Copy size={11} />}
                  {copied === 'url' ? 'Tersalin' : 'Salin URL'}
                </button>
              </div>
              <div className="mono" style={{ background: '#0d131f', padding: '8px 10px', borderRadius: 6, fontSize: 11, color: '#38bdf8' }}>
                {webhookUrl}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Content Type:</span>
                <div className="mono" style={{ background: '#0d131f', padding: '6px 10px', borderRadius: 6, fontSize: 11, color: '#f1f5f9' }}>
                  application/json
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Secret Token:</span>
                  <button
                    onClick={() => copyText(secret, 'secret')}
                    className="btn btn-secondary"
                    style={{ padding: '2px 6px', fontSize: 10 }}
                  >
                    {copied === 'secret' ? <Check size={10} style={{ color: '#34d399' }} /> : <Copy size={10} />}
                  </button>
                </div>
                <div className="mono" style={{ background: '#0d131f', padding: '6px 10px', borderRadius: 6, fontSize: 11, color: '#38bdf8' }}>
                  {secret}
                </div>
              </div>
            </div>
          </div>

          {/* Live Git Push Simulator */}
          <div style={{
            background: 'rgba(14, 165, 233, 0.04)',
            border: '1px solid rgba(14, 165, 233, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Terminal size={15} style={{ color: '#0ea5e9' }} />
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
                Simulasi Git Push (Uji Autobuild & Layar Freeze)
              </h4>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              Kirimkan simulasi event <code>push</code> seperti saat developer mengetik <code>git push origin main</code> di terminal. Jika ada build yang sedang berjalan, sistem antrian akan mengunci layar dengan perhitungan countdown.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Repository</label>
                <select
                  className="form-select mono"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                >
                  {projects.map(p => (
                    <option key={p.repo} value={p.repo}>
                      {p.repo} ({p.framework})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Pusher / Author</label>
                <input
                  className="form-input mono"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Commit Message</label>
              <input
                className="form-input mono"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
              />
            </div>

            <button
              onClick={handleSimulatePush}
              disabled={sending}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px 16px' }}
            >
              <Play size={14} />
              {sending ? 'Mengirim Webhook...' : 'Kirim Simulasi GitHub Push Event'}
            </button>
          </div>

          {result && (
            <div style={{
              marginTop: 14,
              padding: 12,
              background: '#05070c',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              fontSize: 12
            }}>
              <span className="mono" style={{ color: result.error ? '#f87171' : '#34d399' }}>
                {result.error ? `Error: ${result.error}` : 'Payload webhook diterima! Pipeline autobuild telah dipicu.'}
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
}

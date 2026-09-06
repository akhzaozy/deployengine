import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Upload, FileText, Check, Database, Eye, EyeOff, Plus, Trash2, Shield } from 'lucide-react';
import { api } from '../lib/api';

export function EnvManagerModal({ project, onClose, onSaved }) {
  const [activeTab, setActiveTab] = useState('raw'); // 'raw' | 'table' | 'upload'
  const [envContent, setEnvContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showValues, setShowValues] = useState({});
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  useEffect(() => {
    fetchEnv();
  }, [project.repo]);

  async function fetchEnv() {
    setLoading(true);
    try {
      const data = await api.getEnv(project.repo);
      setEnvContent(data.content || '');
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal memuat .env: ' + err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRaw() {
    setSaving(true);
    setMsg(null);
    try {
      await api.saveEnv(project.repo, envContent);
      setMsg({ type: 'success', text: 'File .env berhasil disimpan & dibackup di server!' });
      if (onSaved) onSaved();
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal menyimpan: ' + err.message });
    } finally {
      setSaving(false);
    }
  }

  // Parse raw .env into key-value pairs
  const kvPairs = React.useMemo(() => {
    return envContent.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return { isComment: true, raw: line, id: idx };
      }
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) {
        return { isComment: true, raw: line, id: idx };
      }
      const key = line.slice(0, eqIdx).trim();
      const value = line.slice(eqIdx + 1).trim().replace(/^["'](.*)["']$/, '$1');
      return { isComment: false, key, value, id: idx };
    });
  }, [envContent]);

  function handleKvChange(index, newKey, newValue) {
    const updated = [...kvPairs];
    updated[index] = { ...updated[index], key: newKey, value: newValue };

    const newRaw = updated.map(item => {
      if (item.isComment) return item.raw;
      return `${item.key}=${item.value}`;
    }).join('\n');

    setEnvContent(newRaw);
  }

  function handleAddRow() {
    setEnvContent(prev => prev + '\nNEW_VARIABLE=""');
  }

  function handleDeleteRow(index) {
    const updated = kvPairs.filter((_, idx) => idx !== index);
    const newRaw = updated.map(item => {
      if (item.isComment) return item.raw;
      return `${item.key}=${item.value}`;
    }).join('\n');
    setEnvContent(newRaw);
  }

  async function handleFileUpload(file) {
    if (!file) return;
    setUploadedFile(file);
    const text = await file.text();
    setEnvContent(text);
    setActiveTab('raw');
    setMsg({ type: 'success', text: `File '${file.name}' dimuat. Klik "Simpan .env" untuk menerapkan ke server.` });
  }

  function injectDbSnippet(engine) {
    const dbName = project.dbName || project.repo.replace(/-/g, '_');
    let snippet = '';

    if (engine === 'mariadb') {
      snippet = `\n# --- MariaDB Config Auto-Injected ---\nDB_CONNECTION=mysql\nDB_HOST=127.0.0.1\nDB_PORT=3306\nDB_DATABASE=${dbName}\nDB_USERNAME=deploysiitk\nDB_PASSWORD=deploysiitk2026\nDATABASE_URL="mysql://deploysiitk:deploysiitk2026@127.0.0.1:3306/${dbName}"\n`;
    } else {
      snippet = `\n# --- PostgreSQL Config Auto-Injected ---\nDB_CONNECTION=pgsql\nDB_HOST=127.0.0.1\nDB_PORT=5432\nDB_DATABASE=${dbName}\nDB_USERNAME=deploysiitk\nDB_PASSWORD=deploysiitk2026\nDATABASE_URL="postgresql://deploysiitk:deploysiitk2026@127.0.0.1:5432/${dbName}?schema=public"\n`;
    }

    setEnvContent(prev => prev.trim() + '\n' + snippet);
    setMsg({ type: 'success', text: `Snippet konfigurasi ${engine.toUpperCase()} berhasil ditambahkan!` });
  }

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-card"
        style={{ maxWidth: 840 }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'rgba(14, 165, 233, 0.15)',
              padding: 8,
              borderRadius: 6,
              color: '#38bdf8'
            }}>
              <Shield size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                Environment Variables (.env) · {project.repo}
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Target: /www/wwwroot/hosting/{project.repo}/.env (Linux 640 web user)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: 6 }}>
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher & DB Injectors */}
        <div style={{
          padding: '12px 24px',
          background: '#090e17',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setActiveTab('raw')}
              className={`btn ${activeTab === 'raw' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              <FileText size={13} />
              Editor Teks Raw
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`btn ${activeTab === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              Key-Value Form
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`btn ${activeTab === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              <Upload size={13} />
              Upload File .env
            </button>
          </div>

          {/* Quick DB Snippet Injectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              Auto Inject:
            </span>
            <button
              onClick={() => injectDbSnippet('mariadb')}
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '4px 8px' }}
              title="Tambahkan variabel DB MariaDB/MySQL"
            >
              <Database size={11} style={{ color: '#0ea5e9' }} />
              + MariaDB
            </button>
            <button
              onClick={() => injectDbSnippet('postgres')}
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '4px 8px' }}
              title="Tambahkan variabel DB PostgreSQL"
            >
              <Database size={11} style={{ color: '#38bdf8' }} />
              + PostgreSQL
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {msg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: msg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
              color: msg.type === 'success' ? '#34d399' : '#f87171',
              border: `1px solid ${msg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
            }}>
              {msg.type === 'success' ? <Check size={14} /> : <X size={14} />}
              <span>{msg.text}</span>
            </div>
          )}

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Memuat konfigurasi .env...
            </div>
          ) : activeTab === 'raw' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>Editor Teks (Format KEY=VALUE, # untuk komentar)</span>
                <span className="mono">{envContent.split('\n').length} baris</span>
              </div>
              <textarea
                className="form-textarea code-editor"
                value={envContent}
                onChange={(e) => setEnvContent(e.target.value)}
                placeholder="APP_NAME=Laravel&#10;APP_ENV=production&#10;DB_CONNECTION=mysql&#10;..."
                spellCheck={false}
                style={{ height: 320 }}
              />
            </div>
          ) : activeTab === 'table' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Daftar variabel lingkungan:
                </span>
                <button
                  onClick={handleAddRow}
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  <Plus size={12} /> Tambah Variabel
                </button>
              </div>

              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 6px', width: '38%' }}>KEY</th>
                      <th style={{ padding: '8px 6px', width: '50%' }}>VALUE</th>
                      <th style={{ padding: '8px 6px', width: '12%', textAlign: 'right' }}>AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kvPairs.map((item, idx) => {
                      if (item.isComment) {
                        return (
                          <tr key={idx} style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <td colSpan={3} style={{ padding: '6px 8px', color: '#64748b', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                              {item.raw}
                            </td>
                          </tr>
                        );
                      }

                      const isHidden = !showValues[idx];

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              className="form-input mono"
                              style={{ padding: '6px 8px', fontSize: 11 }}
                              value={item.key}
                              onChange={(e) => handleKvChange(idx, e.target.value, item.value)}
                            />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                              <input
                                type={isHidden ? 'password' : 'text'}
                                className="form-input mono"
                                style={{ padding: '6px 30px 6px 8px', fontSize: 11 }}
                                value={item.value}
                                onChange={(e) => handleKvChange(idx, item.key, e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => setShowValues(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                style={{
                                  position: 'absolute',
                                  right: 6,
                                  background: 'none',
                                  border: 'none',
                                  color: '#64748b',
                                  cursor: 'pointer',
                                  padding: 2
                                }}
                              >
                                {isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(idx)}
                              className="btn btn-danger"
                              style={{ padding: 4 }}
                              title="Hapus variabel"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Upload File Tab */
            <div style={{ padding: 10 }}>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#0ea5e9' : 'var(--border-prominent)'}`,
                  background: dragOver ? 'rgba(14, 165, 233, 0.05)' : '#070b12',
                  borderRadius: 'var(--radius-md)',
                  padding: '40px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".env,text/plain"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                  }}
                />
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(14, 165, 233, 0.1)',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}>
                  <Upload size={22} />
                </div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                  Drag and drop file .env ke sini
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  atau klik untuk memilih file dari komputer Anda
                </p>
                <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                  Format: .env / text file (.env.production, .env.local)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Batal
          </button>
          <button
            onClick={handleSaveRaw}
            disabled={saving}
            className="btn btn-primary"
          >
            <Save size={14} />
            {saving ? 'Menyimpan...' : 'Simpan & Terapkan .env'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

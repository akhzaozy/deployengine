import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Copy, Trash2, ArrowDown, Check, Filter } from 'lucide-react';

export function TerminalLogs({ logs, activeRepo, onClear }) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [logFilter, setLogFilter] = useState('all'); // 'all' | 'steps' | 'db' | 'cmd' | 'errors'
  const bodyRef = useRef(null);

  useEffect(() => {
    if (autoScroll && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs, autoScroll, logFilter]);

  function handleCopy() {
    const text = logs.map(l => typeof l === 'string' ? l : l.msg).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // High-fidelity syntax colorizer
  function renderColoredLine(text, index) {
    // 1. Separators
    if (text.startsWith('====') || text.startsWith('----')) {
      return (
        <div key={index} style={{ color: '#0284c7', opacity: 0.6, letterSpacing: '0.05em' }}>
          {text}
        </div>
      );
    }

    // 2. Success Banner
    if (text.includes('DEPLOYMENT BERHASIL') || text.includes('STATUS: LIVE')) {
      return (
        <div key={index} style={{
          color: '#34d399',
          fontWeight: 800,
          background: 'rgba(16, 185, 129, 0.15)',
          borderLeft: '3px solid #10b981',
          padding: '4px 8px',
          margin: '4px 0',
          borderRadius: 4
        }}>
          ✨ {text}
        </div>
      );
    }

    // 3. Engine Title
    if (text.includes('AUTODEPLOY ENGINE')) {
      return (
        <div key={index} style={{ color: '#38bdf8', fontWeight: 800, fontSize: 13, letterSpacing: '0.03em' }}>
          {text}
        </div>
      );
    }

    // 4. Executed Commands ($ ...)
    if (text.startsWith('$')) {
      return (
        <div key={index} style={{
          color: '#38bdf8',
          fontWeight: 700,
          background: 'rgba(14, 165, 233, 0.1)',
          padding: '2px 8px',
          borderRadius: 4,
          margin: '3px 0',
          borderLeft: '2px solid #0ea5e9'
        }}>
          <span style={{ color: '#0ea5e9', marginRight: 6 }}>➜</span>
          {text.slice(1).trim()}
        </div>
      );
    }

    // 5. Steps Tags: [STEP 1/6]
    if (text.includes('[STEP')) {
      const match = text.match(/\[STEP \d+\/\d+\]/);
      if (match) {
        const stepTag = match[0];
        const rest = text.replace(stepTag, '');
        return (
          <div key={index} style={{ margin: '4px 0', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              background: 'rgba(14, 165, 233, 0.25)',
              color: '#38bdf8',
              border: '1px solid #0ea5e9',
              borderRadius: 4,
              padding: '1px 6px',
              fontSize: 11,
              fontWeight: 800,
              fontFamily: 'var(--font-mono)'
            }}>
              {stepTag}
            </span>
            <span style={{ color: '#f1f5f9', fontWeight: 700 }}>
              {rest}
            </span>
          </div>
        );
      }
    }

    // 6. Database Tags: [DB] or [DB WARN] or [DB ERROR]
    if (text.includes('[DB]')) {
      return (
        <div key={index} style={{ margin: '2px 0', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            background: 'rgba(16, 185, 129, 0.2)',
            color: '#34d399',
            border: '1px solid #10b981',
            borderRadius: 4,
            padding: '1px 6px',
            fontSize: 10.5,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)'
          }}>
            [DB]
          </span>
          <span style={{ color: '#a7f3d0' }}>
            {text.replace('[DB]', '').trim()}
          </span>
        </div>
      );
    }

    // 7. Nginx Tags: [Nginx]
    if (text.includes('[Nginx]')) {
      return (
        <div key={index} style={{ margin: '2px 0', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            background: 'rgba(192, 132, 252, 0.2)',
            color: '#c084fc',
            border: '1px solid #a855f7',
            borderRadius: 4,
            padding: '1px 6px',
            fontSize: 10.5,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)'
          }}>
            [Nginx]
          </span>
          <span style={{ color: '#e9d5ff' }}>
            {text.replace('[Nginx]', '').trim()}
          </span>
        </div>
      );
    }

    // 8. Cloudflare Tags: [Cloudflare]
    if (text.includes('[Cloudflare]')) {
      return (
        <div key={index} style={{ margin: '2px 0', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            background: 'rgba(245, 158, 11, 0.2)',
            color: '#fbbf24',
            border: '1px solid #f59e0b',
            borderRadius: 4,
            padding: '1px 6px',
            fontSize: 10.5,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)'
          }}>
            [Cloudflare]
          </span>
          <span style={{ color: '#fde68a' }}>
            {text.replace('[Cloudflare]', '').trim()}
          </span>
        </div>
      );
    }

    // 9. Permissions & ENV: [PERM], [ENV], [CLEAR]
    if (text.includes('[PERM]') || text.includes('[ENV]') || text.includes('[CLEAR]')) {
      const match = text.match(/\[(PERM|ENV|CLEAR)\]/);
      const tag = match ? match[0] : '';
      return (
        <div key={index} style={{ margin: '2px 0', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            background: 'rgba(99, 102, 241, 0.2)',
            color: '#818cf8',
            border: '1px solid #6366f1',
            borderRadius: 4,
            padding: '1px 6px',
            fontSize: 10.5,
            fontWeight: 700
          }}>
            {tag}
          </span>
          <span style={{ color: '#c7d2fe' }}>
            {text.replace(tag, '').trim()}
          </span>
        </div>
      );
    }

    // 10. Warnings: WARN
    if (text.includes('WARN') || text.includes('warning') || text.includes('menunggu')) {
      return (
        <div key={index} style={{
          color: '#fbbf24',
          background: 'rgba(245, 158, 11, 0.08)',
          borderLeft: '2px solid #f59e0b',
          padding: '2px 8px',
          margin: '2px 0'
        }}>
          ⚠️ {text}
        </div>
      );
    }

    // 11. Errors: ERROR or actual error text
    if (text.includes('ERROR') || text.includes('[stderr error]') || text.includes('failed') || text.includes('Gagal')) {
      return (
        <div key={index} style={{
          color: '#f87171',
          background: 'rgba(244, 63, 94, 0.1)',
          borderLeft: '2px solid #ef4444',
          padding: '2px 8px',
          margin: '2px 0'
        }}>
          {text.startsWith('✖') ? text : `✖ ${text}`}
        </div>
      );
    }

    // 12. Standard Output / Info
    return (
      <div key={index} style={{ color: '#cbd5e1', padding: '1px 0' }}>
        {text}
      </div>
    );
  }

  // Filter logs according to active tab
  const filteredLogs = logs.filter(line => {
    const text = typeof line === 'string' ? line : line.msg;
    if (logFilter === 'steps') return text.includes('[STEP') || text.includes('AUTODEPLOY') || text.includes('BERHASIL');
    if (logFilter === 'db') return text.includes('[DB');
    if (logFilter === 'cmd') return text.startsWith('$');
    if (logFilter === 'errors') return text.includes('ERROR') || text.includes('[stderr]') || text.includes('failed') || text.includes('WARN');
    return true;
  });

  return (
    <div className="terminal-window" style={{ marginTop: 24 }}>
      <div className="terminal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Terminal size={15} style={{ color: '#0ea5e9' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.02em' }}>
            LIVE DEPLOYMENT LOGS · {activeRepo ? activeRepo.toUpperCase() : 'STREAM PIPELINE'}
          </span>

          {/* Log Filter Pills */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {[
              { id: 'all', label: 'Semua' },
              { id: 'steps', label: 'Tahapan' },
              { id: 'cmd', label: 'Commands ($)' },
              { id: 'db', label: 'Database' },
              { id: 'errors', label: 'Warnings/Errors' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setLogFilter(f.id)}
                style={{
                  background: logFilter === f.id ? '#0ea5e9' : '#1e293b',
                  color: logFilter === f.id ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 10.5,
                  padding: '2px 8px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '3px 8px', color: autoScroll ? '#38bdf8' : '#94a3b8' }}
            title="Toggle Auto-scroll"
          >
            <ArrowDown size={12} />
            {autoScroll ? 'Auto-scroll On' : 'Auto-scroll Off'}
          </button>
          <button
            onClick={handleCopy}
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '3px 8px' }}
            title="Salin Log"
          >
            {copied ? <Check size={12} style={{ color: '#34d399' }} /> : <Copy size={12} />}
            {copied ? 'Tersalin' : 'Salin'}
          </button>
          <button
            onClick={onClear}
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '3px 8px' }}
            title="Bersihkan Log"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div ref={bodyRef} className="terminal-body" style={{ background: '#070b14', minHeight: 340 }}>
        {filteredLogs.length === 0 ? (
          <div style={{ color: '#64748b', fontStyle: 'italic', padding: 24, textAlign: 'center' }}>
            Menunggu pipeline deployment... Klik "Deploy & Build Sekarang" atau jalankan simulasi git push untuk melihat output log warna-warni secara real-time.
          </div>
        ) : (
          filteredLogs.map((line, idx) => {
            const text = typeof line === 'string' ? line : line.msg;
            return (
              <div key={idx} style={{ display: 'flex', gap: 12, lineHeight: 1.6 }}>
                {/* Line number */}
                <span style={{ color: '#334155', minWidth: 26, textAlign: 'right', userSelect: 'none', fontSize: 11 }}>
                  {idx + 1}
                </span>
                {/* Colored content */}
                <div style={{ flex: 1, wordBreak: 'break-all' }}>
                  {renderColoredLine(text, idx)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

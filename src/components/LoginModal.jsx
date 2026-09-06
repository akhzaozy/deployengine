import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, User, Eye, EyeOff, ArrowRight, Sun, Moon, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

export function LoginModal({ onLoginSuccess, theme, onToggleTheme }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Animation states: password focus (gajah lari sembunyi di balik batu), shake (geleng-geleng)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [shake, setShake] = useState(false);

  // Smooth cursor trailing delay (lerp / inertia physics)
  const targetPos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [smoothPos, setSmoothPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    let animId;
    const lerpSpeed = 0.08; // smooth trailing inertia factor

    const loop = () => {
      setSmoothPos(prev => {
        const dx = targetPos.current.x - prev.x;
        const dy = targetPos.current.y - prev.y;
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return prev;
        return {
          x: prev.x + dx * lerpSpeed,
          y: prev.y + dy * lerpSpeed,
        };
      });
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleMouseMove = (e) => {
    targetPos.current = { x: e.clientX, y: e.clientY };
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register(username, password, fullName);
        if (res.success) {
          onLoginSuccess(res.user);
        } else {
          triggerShake(res.error || 'Gagal mendaftar');
        }
      } else {
        const res = await api.login(username, password);
        if (res.success) {
          onLoginSuccess(res.user);
        } else {
          triggerShake(res.error || 'Username atau password salah');
        }
      }
    } catch (err) {
      triggerShake(err.message || 'Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  }

  function triggerShake(errorMessage) {
    setError(errorMessage);
    setShake(true);
    setTimeout(() => setShake(false), 700);
  }

  function quickDemoLogin() {
    setUsername('developer');
    setPassword('dev123');
    setIsRegister(false);
    setError(null);
    setLoading(true);
    api.login('developer', 'dev123')
      .then(res => {
        if (res.success) onLoginSuccess(res.user);
        else triggerShake(res.error);
      })
      .catch(err => triggerShake(err.message))
      .finally(() => setLoading(false));
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      className="modal-overlay"
      style={{
        background: theme === 'light'
          ? `radial-gradient(850px at ${smoothPos.x}px ${smoothPos.y}px, rgba(2, 132, 199, 0.12), #f4f6fb 75%)`
          : `radial-gradient(850px at ${smoothPos.x}px ${smoothPos.y}px, rgba(14, 165, 233, 0.16), #05080e 75%)`,
        cursor: 'default'
      }}
    >
      {/* Light / Dark Mode Toggle */}
      <div style={{ position: 'absolute', top: 24, right: 28, zIndex: 10 }}>
        <button
          type="button"
          onClick={onToggleTheme}
          className="btn btn-secondary"
          style={{ padding: '8px 12px', borderRadius: 9999, fontSize: 12 }}
          title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
        >
          {theme === 'dark' ? <Sun size={15} style={{ color: '#f59e0b' }} /> : <Moon size={15} style={{ color: '#0ea5e9' }} />}
          <span>{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
        </button>
      </div>

      <motion.div
        className="modal-card"
        style={{
          maxWidth: 440,
          border: '1px solid var(--border-prominent)',
          background: 'var(--card-bg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          overflow: 'visible'
        }}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={shake ? {
          x: [-20, 20, -15, 15, -8, 8, -4, 4, 0],
          rotate: [-4, 4, -3, 3, -1.5, 1.5, 0],
          transition: { duration: 0.65, ease: 'easeInOut' }
        } : { opacity: 1, scale: 1, y: 0, rotate: 0 }}
      >
        <div style={{ padding: '24px 28px 8px 28px', textAlign: 'center' }}>

          {/* Adorable Animated Elephant & Rock Stage (Gajah ngelirik & lari sembunyi di balik batu) */}
          <div style={{ position: 'relative', width: 170, height: 110, margin: '0 auto 6px auto' }}>
            <svg width="170" height="110" viewBox="0 0 170 110" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="elephantBody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#64748b" />
                </linearGradient>
                <linearGradient id="elephantEarInner" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fbcfe8" />
                  <stop offset="100%" stopColor="#f472b6" />
                </linearGradient>
                <linearGradient id="rockGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#475569" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
                <filter id="sceneShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.3" />
                </filter>
              </defs>

              {/* Ground Shadow Base */}
              <ellipse cx="85" cy="102" rx="68" ry="6" fill="#000000" opacity="0.25" />

              {/* ANIMATED ELEPHANT (GAJAH) */}
              <motion.g
                initial={false}
                animate={isPasswordFocused ? {
                  // Sembunyi lari ke balik batu di sebelah kanan!
                  x: 48,
                  y: 10,
                  scale: 0.88,
                  rotate: -6,
                  transition: { type: 'spring', stiffness: 220, damping: 20 }
                } : {
                  // Normal: Berdiri ramah di tengah sambil ngelirik
                  x: 0,
                  y: 0,
                  scale: 1,
                  rotate: 0,
                  transition: { type: 'spring', stiffness: 240, damping: 22 }
                }}
                style={{ transformOrigin: '65px 75px' }}
                filter="url(#sceneShadow)"
              >
                {/* Fluffy Tail */}
                <path d="M 32 75 Q 26 78 28 84" fill="transparent" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="28" cy="85" r="2.5" fill="#475569" />

                {/* Left Big Floppy Ear */}
                <ellipse cx="44" cy="52" rx="17" ry="22" fill="#94a3b8" stroke="#475569" strokeWidth="1.8" transform="rotate(-15 44 52)" />
                <ellipse cx="44" cy="53" rx="10" ry="14" fill="url(#elephantEarInner)" opacity="0.65" transform="rotate(-15 44 53)" />

                {/* Elephant Body & Legs */}
                <rect x="42" y="44" width="52" height="46" rx="23" fill="url(#elephantBody)" stroke="#475569" strokeWidth="2" />
                {/* Little Feet with white toenails */}
                <rect x="46" y="82" width="13" height="15" rx="5" fill="#64748b" />
                <circle cx="49" cy="94" r="1.5" fill="#ffffff" />
                <circle cx="53" cy="94" r="1.5" fill="#ffffff" />
                <circle cx="57" cy="94" r="1.5" fill="#ffffff" />

                <rect x="73" y="82" width="13" height="15" rx="5" fill="#64748b" />
                <circle cx="76" cy="94" r="1.5" fill="#ffffff" />
                <circle cx="80" cy="94" r="1.5" fill="#ffffff" />
                <circle cx="84" cy="94" r="1.5" fill="#ffffff" />

                {/* Elephant Head */}
                <circle cx="68" cy="52" r="23" fill="url(#elephantBody)" stroke="#475569" strokeWidth="2" />

                {/* Right Big Floppy Ear */}
                <ellipse cx="90" cy="50" rx="16" ry="21" fill="#94a3b8" stroke="#475569" strokeWidth="1.8" transform="rotate(15 90 50)" />
                <ellipse cx="89" cy="51" rx="9" ry="13" fill="url(#elephantEarInner)" opacity="0.65" transform="rotate(15 89 51)" />

                {/* Pink Cheeks */}
                <circle cx="55" cy="62" r="5" fill="#f472b6" opacity="0.6" />
                <circle cx="81" cy="62" r="5" fill="#f472b6" opacity="0.6" />

                {/* Little Cute Tusks */}
                <path d="M 60 67 Q 56 73 54 75 Q 59 72 63 68" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                <path d="M 76 67 Q 80 73 82 75 Q 77 72 73 68" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />

                {/* Elephant Trunk (Belalai yang lucu & lentur) */}
                <motion.path
                  d="M 64 63 C 63 74, 60 83, 68 86 C 75 87, 76 80, 72 78"
                  fill="transparent"
                  stroke="#94a3b8"
                  strokeWidth="8.5"
                  strokeLinecap="round"
                  animate={isPasswordFocused ? {
                    d: "M 65 63 C 64 72, 68 76, 73 75 C 77 74, 76 69, 70 68",
                    transition: { duration: 0.3 }
                  } : {
                    d: "M 64 63 C 63 74, 60 83, 68 86 C 75 87, 76 80, 72 78",
                    transition: { duration: 0.3 }
                  }}
                />

                {/* EXPRESSIVE EYES (Gajah Ngelirik!) */}
                {!isPasswordFocused ? (
                  /* Mata Ngelirik ke bawah / ke arah form input */
                  <g>
                    {/* Left Eye */}
                    <circle cx="58" cy="49" r="6.5" fill="#ffffff" stroke="#475569" strokeWidth="1.5" />
                    <circle cx="56" cy="51" r="3.6" fill="#0f172a" />
                    <circle cx="55" cy="50" r="1.3" fill="#ffffff" />

                    {/* Right Eye */}
                    <circle cx="78" cy="49" r="6.5" fill="#ffffff" stroke="#475569" strokeWidth="1.5" />
                    <circle cx="76" cy="51" r="3.6" fill="#0f172a" />
                    <circle cx="75" cy="50" r="1.3" fill="#ffffff" />
                  </g>
                ) : (
                  /* Saat sembunyi di balik batu: Mata ngintip kaget / malu-malu */
                  <g>
                    {/* Left Eye Peeking */}
                    <circle cx="58" cy="48" r="6" fill="#ffffff" stroke="#475569" strokeWidth="1.5" />
                    <circle cx="56" cy="47" r="3.5" fill="#0284c7" />
                    <circle cx="55" cy="46" r="1.4" fill="#ffffff" />

                    {/* Right Eye Peeking */}
                    <circle cx="78" cy="48" r="6" fill="#ffffff" stroke="#475569" strokeWidth="1.5" />
                    <circle cx="76" cy="47" r="3.5" fill="#0284c7" />
                    <circle cx="75" cy="46" r="1.4" fill="#ffffff" />
                  </g>
                )}
              </motion.g>

              {/* THE ROCK (BATU TEMPAT GAJAH SEMBUNYI DI SEBELAH KANAN) */}
              <g filter="url(#sceneShadow)">
                {/* Big Mossy Rock Foreground */}
                <path
                  d="M 115 102 C 108 85, 114 62, 126 50 C 138 38, 158 46, 164 65 C 168 78, 168 95, 160 102 Z"
                  fill="url(#rockGradient)"
                  stroke="#334155"
                  strokeWidth="2.5"
                />
                {/* Smaller Boulder Beside */}
                <path
                  d="M 98 102 C 94 90, 100 78, 112 74 C 122 70, 130 84, 126 102 Z"
                  fill="#334155"
                  stroke="#1e293b"
                  strokeWidth="2"
                />
                {/* Cute Green Moss on Rock */}
                <path
                  d="M 126 51 Q 138 43 150 48 Q 146 54 136 53 Z"
                  fill="#10b981"
                  opacity="0.8"
                />
                <path
                  d="M 104 77 Q 112 73 118 76 Q 114 80 108 80 Z"
                  fill="#10b981"
                  opacity="0.8"
                />
                {/* Little Grass Sprout on ground */}
                <path d="M 92 101 Q 88 93 92 88 M 92 101 Q 95 91 100 89" fill="transparent" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
              </g>
            </svg>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            AutoDeploy Platform
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {isRegister ? 'Daftar akun baru untuk mulai deploy' : 'Masuk untuk mengelola repositori & deployment'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '0 28px 28px 28px' }}>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#f87171',
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </motion.div>
          )}

          {isRegister && (
            <div className="form-group">
              <label className="form-label">Nama Lengkap</label>
              <input
                className="form-input"
                placeholder="misal: Muhammad Akhzaf"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Username</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input mono"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ paddingLeft: 34 }}
              />
              <User size={14} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input mono"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                required
                style={{ paddingLeft: 34, paddingRight: 34 }}
              />
              <Lock size={14} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--text-muted)' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 9,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px 16px', fontSize: 13, marginTop: 8 }}
          >
            {loading ? 'Memproses...' : (isRegister ? 'Daftar Akun Baru' : 'Masuk ke Platform')}
            <ArrowRight size={14} />
          </button>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(null); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: 12,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isRegister ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Daftar sekarang'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

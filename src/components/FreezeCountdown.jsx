import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import anime from 'animejs';
import { Lock, Timer, GitBranch, GitCommit, Layers, Clock, ShieldAlert } from 'lucide-react';

export function FreezeCountdown({ queueStatus }) {
  const circleRef = useRef(null);
  const numberRef = useRef(null);

  const activeJob = queueStatus?.currentJob;
  const queuedJobs = queueStatus?.queuedJobs || [];
  const isLocked = queueStatus?.isLocked;

  const remainingSeconds = activeJob ? activeJob.remainingSeconds : 0;
  const totalEst = activeJob ? activeJob.estimatedSeconds : 45;
  const elapsed = activeJob ? activeJob.elapsedSeconds : 0;
  const percentage = activeJob ? activeJob.percentage : 0;

  // Anime.js SVG Countdown Ring and Number Counter
  useEffect(() => {
    if (!isLocked) return;

    // Animate circular SVG stroke
    const circle = circleRef.current;
    if (circle) {
      const radius = 68;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (percentage / 100) * circumference;

      anime({
        targets: circle,
        strokeDashoffset: [circumference, offset],
        easing: 'easeInOutQuad',
        duration: 800,
      });
    }

    // Animate number count smoothly
    if (numberRef.current) {
      anime({
        targets: numberRef.current,
        innerHTML: [Math.max(0, remainingSeconds + 2), remainingSeconds],
        round: 1,
        easing: 'easeOutExpo',
        duration: 600,
      });
    }
  }, [remainingSeconds, percentage, isLocked]);

  if (!isLocked && queuedJobs.length === 0) {
    return null;
  }

  const stepsList = [
    'Git Source Sync',
    'DB Provisioning & .env',
    'Dependencies (NPM/Composer)',
    'Build & Migration',
    'Permission Hardening',
    'Nginx & Cloudflare Sync'
  ];

  return (
    <div className="freeze-overlay" style={{ cursor: 'wait' }}>
      <motion.div
        className="freeze-card"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {/* Top Header Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 9999,
            padding: '5px 16px',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-mono)'
          }}>
            <Lock size={13} />
            BUILD ENGINE BUSY · ANTRIAN TERKUNCI
          </span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>
          Deployment & AutoBuild Sedang Berjalan
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 490, margin: '0 auto 20px auto', lineHeight: 1.6 }}>
          Sistem sedang memproses pipeline build secara eksklusif untuk mencegah konflik resource server. Layar dibekukan sementara sampai proses selesai.
        </p>

        {/* Strict Lock Notice Banner */}
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 8,
          padding: '8px 14px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11.5,
          color: '#fca5a5',
          marginBottom: 20
        }}>
          <ShieldAlert size={14} style={{ color: '#f87171', flexShrink: 0 }} />
          <span>Layar otomatis terbuka kembali begitu seluruh proses deployment selesai.</span>
        </div>

        {/* Circular Countdown Gauge (Anime.js Powered) */}
        <div style={{ position: 'relative', width: 170, height: 170, margin: '0 auto 24px auto' }}>
          <svg width="170" height="170" viewBox="0 0 170 170" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background Track */}
            <circle
              cx="85"
              cy="85"
              r="68"
              fill="transparent"
              stroke="#172234"
              strokeWidth="10"
            />
            {/* Animated Progress Arc */}
            <circle
              ref={circleRef}
              cx="85"
              cy="85"
              r="68"
              fill="transparent"
              stroke="url(#countdownGradient)"
              strokeWidth="10"
              strokeDasharray={2 * Math.PI * 68}
              strokeDashoffset={2 * Math.PI * 68}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="countdownGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>

          {/* Centered Countdown Digits */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span
                ref={numberRef}
                style={{
                  fontSize: 38,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: '#ffffff',
                  lineHeight: 1
                }}
              >
                {remainingSeconds}
              </span>
              <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 600 }}>s</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4, fontWeight: 600 }}>
              ESTIMASI SISA
            </span>
          </div>
        </div>

        {/* Active Job Metadata Box */}
        {activeJob && (
          <div style={{
            background: '#070c14',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            textAlign: 'left',
            marginBottom: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
                  {activeJob.repo}
                </span>
                <span className="badge badge-building">
                  {activeJob.framework}
                </span>
              </div>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                Stage {activeJob.step} of {activeJob.totalSteps}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <GitBranch size={13} style={{ color: '#0ea5e9' }} />
                <span>{activeJob.branch}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <GitCommit size={13} style={{ color: '#10b981' }} />
                <span className="mono" style={{ fontSize: 11 }}>{activeJob.commit || 'Automated Build'}</span>
              </div>
            </div>

            {/* Current Step Description */}
            <div style={{
              background: '#0d1522',
              padding: '10px 14px',
              borderRadius: 6,
              border: '1px solid #1e2d42',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: 12, color: '#93c5fd', fontWeight: 500 }}>
                {activeJob.stepName}
              </span>
              <span className="mono" style={{ fontSize: 11, color: '#64748b' }}>
                Elapsed: {elapsed}s
              </span>
            </div>

            {/* Progress Step Nodes */}
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              {stepsList.map((stName, idx) => {
                const stepNum = idx + 1;
                const isPassed = stepNum < (activeJob.step || 1);
                const isCurrent = stepNum === (activeJob.step || 1);

                return (
                  <div
                    key={stName}
                    title={`${stepNum}. ${stName}`}
                    style={{
                      flex: 1,
                      height: 5,
                      borderRadius: 3,
                      background: isPassed ? '#10b981' : isCurrent ? '#0ea5e9' : '#1e293b',
                      boxShadow: isCurrent ? '0 0 8px #0ea5e9' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Queued Jobs List if any */}
        {queuedJobs.length > 0 && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.06)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            textAlign: 'left',
            marginBottom: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>
              <Clock size={13} />
              <span>Job Menunggu di Antrian ({queuedJobs.length}):</span>
            </div>
            {queuedJobs.map((qJob) => (
              <div
                key={qJob.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  padding: '6px 0',
                  borderTop: '1px solid rgba(245, 158, 11, 0.12)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    background: '#2c1e0a',
                    color: '#f59e0b',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 4
                  }}>
                    #{qJob.queuePosition}
                  </span>
                  <strong style={{ color: '#f1f5f9' }}>{qJob.repo}</strong>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>({qJob.triggerBy})</span>
                </div>
                <span className="mono" style={{ color: '#fbbf24', fontSize: 11 }}>
                  Tunggu ~{qJob.estimatedWaitSeconds}s
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

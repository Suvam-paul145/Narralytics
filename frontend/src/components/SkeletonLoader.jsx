import React from 'react';

export default function SkeletonLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px 0', animation: 'pulse 1.5s infinite' }}>
      <div style={{ display: 'flex', gap: '20px' }}>
        <div className="glass" style={{ flex: 1, height: '400px', borderRadius: '1.5rem', background: 'rgba(255,255,255,0.02)' }} />
        <div className="glass" style={{ flex: 1, height: '400px', borderRadius: '1.5rem', background: 'rgba(255,255,255,0.02)' }} />
      </div>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 0.8; }
          100% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

import React from 'react';
import InsightCard from './InsightCard';

export default function DashboardCanvas({ confirmed, onAskAbout }) {
  if (!confirmed || confirmed.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📈</p>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem' }}>Empty Dashboard</p>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Ask a data question to see insights appear here.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem', paddingBottom: '2rem' }}>
      {confirmed.map((item, index) => (
        <InsightCard key={index} item={item} onAskAbout={onAskAbout} />
      ))}
    </div>
  );
}

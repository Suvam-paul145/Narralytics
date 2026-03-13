import React from 'react';
import ChartRenderer from './ChartRenderer';

export default function ChartSelector({ pending, onSelect, onDismiss }) {
  if (!pending) return null;

  return (
    <div style={{ marginBottom: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Select a Visualization</h2>
        <button onClick={onDismiss} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Dismiss</button>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {['option_a', 'option_b'].map((key) => {
          const option = pending[key];
          if (!option) return null;
          return (
            <div key={key} className="glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{option.spec.label}</span>
                <h3 style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>{option.spec.title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.4 }}>{option.spec.approach}</p>
              </div>
              
              <div style={{ flex: 1, minHeight: '200px', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', padding: '1rem', marginBottom: '1.5rem' }}>
                <ChartRenderer spec={option.spec} data={option.data} compact />
              </div>
              
              <button 
                onClick={() => onSelect(option)}
                style={{
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  padding: '0.8rem',
                  borderRadius: '1rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Select This Chart →
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

import React, { useState } from 'react';
import ChartRenderer from './ChartRenderer';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

export default function InsightCard({ item, onAskAbout }) {
  const [showSql, setShowSql] = useState(false);

  return (
    <div className="glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{item.spec.title}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: 1.5 }}>{item.spec.insight}</p>
        </div>
        <button 
          onClick={() => onAskAbout(item)}
          style={{ background: 'rgba(99, 102, 241, 0.1)', border: 'none', color: 'var(--accent)', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Ask about this chart"
        >
          <MessageSquare size={18} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: '300px', margin: '1rem 0' }}>
        <ChartRenderer spec={item.spec} data={item.data} />
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: 'auto' }}>
        <button 
          onClick={() => setShowSql(!showSql)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
        >
          {showSql ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showSql ? 'Hide SQL' : 'Show SQL Query'}
        </button>
        
        {showSql && (
          <div style={{ marginTop: '0.8rem', padding: '1rem', background: '#000', borderRadius: '10px', overflowX: 'auto' }}>
            <code style={{ fontSize: '0.7rem', color: '#10b981', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>
              {item.raw_sql}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

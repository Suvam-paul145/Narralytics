import React from 'react';

export default function ModeToggle({ mode, onChange }) {
  const btn = (label, value, icon) => (
    <button 
      onClick={() => onChange(value)} 
      style={{
        padding: "10px 24px", 
        borderRadius: 12, 
        cursor: "pointer",
        fontFamily: "var(--font-heading)", 
        fontWeight: 700, 
        fontSize: 13,
        border: "none", 
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        background: mode === value
          ? (value === "chart" ? "var(--accent)" : "#f59e0b")
          : "transparent",
        color: mode === value ? "#fff" : "var(--text-muted)",
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: mode === value ? `0 4px 12px ${value === "chart" ? "var(--accent-glow)" : "rgba(245, 158, 11, 0.3)"}` : 'none'
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div style={{ 
      display: "inline-flex", 
      background: "var(--bg-card)",
      border: "1px solid var(--border)", 
      borderRadius: 16, 
      padding: 6, 
      gap: 6,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
    }}>
      {btn("Chart Mode",  "chart", "📊")}
      {btn("Chat Mode",   "chat",  "💬")}
    </div>
  );
}

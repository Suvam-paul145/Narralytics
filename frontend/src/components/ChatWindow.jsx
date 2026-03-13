import React from 'react';
import ChatMessage from './ChatMessage';

export default function ChatWindow({ messages, loading }) {
  return (
    <div style={{
      flex: 1, overflowY: "auto", padding: "24px 32px",
      display: "flex", flexDirection: "column", gap: 16,
      scrollbarWidth: 'thin',
      scrollbarColor: 'var(--border) transparent'
    }}>
      {messages.length === 0 && (
        <div style={{ textAlign: "center", marginTop: "10vh", color: "var(--text-muted)", animation: 'fadeIn 0.8s ease-out' }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>💬</p>
          <p style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 700, marginBottom: 12, color: '#fff' }}>
            Ask your Business Analyst
          </p>
          <p style={{ fontSize: 14, maxWidth: 460, margin: "0 auto", lineHeight: 1.7 }}>
            Ask anything about the sales data in plain English. Our AI analyst will provide narrative insights backed by real-time data.
          </p>
          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10, maxWidth: 420, margin: "32px auto 0" }}>
            {[
              "Why are Electronics performing better than Books?",
              "Is our discount strategy actually increasing revenue?",
              "Which region should we invest more marketing in?",
              "What factor most affects our total revenue?"
            ].map((q, i) => (
              <div key={i} className="glass" style={{
                padding: "10px 16px", borderRadius: 12, fontSize: 13,
                color: "var(--text-muted)", fontFamily: "var(--font-mono)",
                textAlign: "left", cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                "{q}"
              </div>
            ))}
          </div>
        </div>
      )}
      {messages.map((msg, i) => <ChatMessage key={i} message={msg} />)}
      {loading && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", color: "var(--text-muted)", fontSize: 13, padding: '8px 16px', borderRadius: '12px', background: 'var(--bg-card)', alignSelf: 'flex-start', border: '1px solid var(--border)' }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1.2s infinite" }} />
          Analyst is thinking...
        </div>
      )}
    </div>
  );
}

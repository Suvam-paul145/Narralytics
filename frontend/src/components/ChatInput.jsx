import React, { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

export default function ChatInput({ onSubmit, loading, mode, placeholder }) {
  const [text, setText] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim() && !loading) {
      onSubmit(text);
      setText("");
    }
  };

  return (
    <div style={{ padding: "20px 32px 32px" }}>
      <form 
        onSubmit={handleSubmit}
        className="glass"
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
          borderRadius: "1.2rem", boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
        }}
      >
        <div style={{ 
          width: 36, height: 36, borderRadius: 10, background: mode === 'chart' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: mode === 'chart' ? 'var(--accent)' : '#f59e0b'
        }}>
          {mode === 'chart' ? <Sparkles size={18} /> : <Send size={18} />}
        </div>
        
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          style={{
            flex: 1, background: "transparent", border: "none", color: "#fff",
            outline: "none", fontSize: 13.5, padding: "8px 0",
            fontFamily: "var(--font-body)"
          }}
        />
        
        <button
          type="submit"
          disabled={!text.trim() || loading}
          style={{
            background: text.trim() ? (mode === "chart" ? "var(--accent)" : "#f59e0b") : "rgba(255,255,255,0.05)",
            color: text.trim() ? "white" : "rgba(255,255,255,0.2)",
            border: "none", borderRadius: 10, height: 38, padding: "0 18px",
            fontSize: 13, fontWeight: 700, transition: "all 0.2s",
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          {loading ? 'Thinking...' : mode === 'chart' ? 'Generate' : 'Send'}
          {!loading && <Send size={14} />}
        </button>
      </form>
    </div>
  );
}

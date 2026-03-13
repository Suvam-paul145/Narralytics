import React from 'react';
import ReactMarkdown from 'react-markdown';

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";
  
  return (
    <div style={{
      display: "flex", 
      justifyContent: isUser ? "flex-end" : "flex-start",
      animation: 'slideIn 0.3s ease-out'
    }}>
      <div style={{
        maxWidth: "80%", 
        padding: "16px 20px", 
        borderRadius: isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
        background: isUser ? "var(--accent)" : "linear-gradient(135deg, var(--bg-card) 0%, #16162a 100%)",
        border: isUser ? "none" : "1px solid var(--border)",
        fontSize: 14, 
        lineHeight: 1.8,
        color: isUser ? "#fff" : "var(--text-primary)",
        fontFamily: isUser ? "var(--font-body)" : "var(--font-body)",
        boxShadow: isUser ? '0 4px 15px var(--accent-glow)' : '0 10px 30px rgba(0,0,0,0.5)',
      }}>
        {isUser
          ? <p style={{ margin: 0 }}>{message.content}</p>
          : <div className="markdown-content">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
        }
        
        {message.cannot_answer && (
          <div style={{ 
            marginTop: 12, padding: '10px', borderRadius: '8px', 
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '12px'
          }}>
            <span>⚠️ Outside available data scope</span>
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .markdown-content p { margin-bottom: 12px; }
        .markdown-content p:last-child { margin-bottom: 0; }
        .markdown-content strong { color: #fff; font-weight: 700; }
        .markdown-content ul { padding-left: 20px; margin-bottom: 12px; }
      `}</style>
    </div>
  );
}

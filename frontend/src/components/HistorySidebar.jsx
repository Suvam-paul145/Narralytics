import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Clock, BarChart2, MessageSquare } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function HistorySidebar() {
  const [items, setItems] = useState([]);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_BASE}/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setItems(res.data.history || []);
      } catch (err) {
        console.error("History fetch error:", err);
      }
    };
    fetchHistory();
    // Refresh every 30s
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div style={{ 
      width: 260, background: "var(--bg-sidebar)",
      borderRight: "1px solid var(--border)", display: "flex",
      flexDirection: "column", padding: "24px 16px",
      overflowY: "auto", flexShrink: 0 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 24 }}>
        <Clock size={16} color="var(--accent)" />
        <p style={{ fontSize: 11, color: "#fff", fontWeight: 800,
          letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Interaction History
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
              No history yet. Start a conversation or query!
            </p>
          </div>
        )}
        
        {items.map((item, i) => (
          <div key={i} className="glass" style={{ 
            padding: "12px", borderRadius: 12, border: "1px solid var(--border)",
            fontSize: 12, color: "var(--text-muted)", cursor: 'pointer',
            transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              {item.type === "chart_query" ? 
                <BarChart2 size={13} color="var(--accent)" /> : 
                <MessageSquare size={13} color="#f59e0b" />
              }
              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'capitalize', color: item.type === "chart_query" ? "var(--accent)" : "#f59e0b" }}>
                {item.type.split('_')[0]}
              </span>
            </div>
            <p style={{ 
              color: "#fff", 
              fontWeight: 500, 
              display: '-webkit-box', 
              WebkitLineClamp: 2, 
              WebkitBoxOrient: 'vertical', 
              overflow: 'hidden',
              lineHeight: 1.4
            }}>
              {item.payload?.prompt || item.payload?.message || "Inquiry"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

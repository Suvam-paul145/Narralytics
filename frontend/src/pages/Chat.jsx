import { useState, useEffect, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";



const SUGGESTIONS = [
  { icon: "📊", label: "Show monthly revenue by region" },
  { icon: "⚡", label: "Why are Electronics outperforming?" },
  { icon: "📈", label: "Compare Q3 vs Q4 performance" },
  { icon: "🔍", label: "Find anomalies in my sales data" },
  { icon: "🗓️", label: "Forecast next quarter's trends" },
  { icon: "🏆", label: "Top 10 products by profit margin" },
];

const AnimatedNetwork = memo(function AnimatedNetwork() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const COLORS = ["#6366f1", "#a78bfa", "#f59e0b", "#34d399", "#f472b6"];
    const nodes = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2.5 + 1.5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.6 + 0.4,
    }));

    let raf;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99,102,241,${0.18 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      nodes.forEach((n) => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color + Math.floor(n.alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }
    draw();
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 0,
      }}
    />
  );
});

export default function Chat() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [greeting, setGreeting] = useState("Good morning");
  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [selectedModel, setSelectedModel] = useState("Gemini");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const MODELS = ["Gemini", "Lama", "Nvidia"];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 12 && h < 17) setGreeting("Good afternoon");
    else if (h >= 17) setGreeting("Good evening");
    setTimeout(() => setMounted(true), 80);
  }, []);

  const handleSubmit = (val) => {
    const text = val || query;
    if (!text.trim()) return;
    alert(`Analyzing: "${text}"\n\n(Connect your backend here)`);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #07071a;
          --bg2: #0d0d2b;
          --surface: rgba(255,255,255,0.04);
          --surface-hover: rgba(255,255,255,0.07);
          --border: rgba(255,255,255,0.08);
          --border-focus: rgba(99,102,241,0.6);
          --accent: #6366f1;
          --accent2: #a78bfa;
          --gold: #f59e0b;
          --teal: #34d399;
          --pink: #f472b6;
          --text: #e8e8f0;
          --muted: rgba(232,232,240,0.5);
          --font-display: 'Instrument Serif', Georgia, serif;
          --font-body: 'DM Sans', sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
        }

        body { background: var(--bg); color: var(--text); font-family: var(--font-body); }

        .narr-page {
          min-height: 100vh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        /* ── Radial glow blobs ── */
        .narr-page::before {
          content: '';
          position: fixed;
          top: -20%;
          left: 50%;
          transform: translateX(-50%);
          width: 900px;
          height: 600px;
          background: radial-gradient(ellipse at center,
            rgba(99,102,241,0.12) 0%,
            rgba(167,139,250,0.06) 40%,
            transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .narr-page::after {
          content: '';
          position: fixed;
          bottom: -10%;
          left: 20%;
          width: 600px;
          height: 400px;
          background: radial-gradient(ellipse at center,
            rgba(52,211,153,0.07) 0%,
            transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        /* ── Layout ── */
        .narr-layout {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
        }

        /* ── Sidebar ── */
        .narr-sidebar {
          width: 260px;
          min-width: 260px;
          background: rgba(7, 7, 26, 0.4);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 16px 14px;
          z-index: 10;
          color: var(--text);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .narr-sidebar.closed {
          transform: translateX(-100%);
          margin-left: -260px;
        }

        .narr-sidebar-top-group {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .narr-sidebar-toggle-mobile {
          display: none;
        }

        /* Float Toggle Button (when sidebar is closed) */
        .narr-toggle-float {
          position: absolute;
          top: 20px;
          left: 20px;
          z-index: 20;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          cursor: pointer;
          padding: 8px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .narr-toggle-float.visible {
          opacity: 1;
          pointer-events: auto;
        }
        .narr-toggle-float:hover { 
          background: var(--surface-hover); 
          border-color: rgba(99,102,241,0.35);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.3);
        }

        .narr-sidebar-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 0.88rem;
          font-family: var(--font-body);
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          transition: all 0.2s;
          text-align: left;
          width: 100%;
        }
        .narr-sidebar-btn:hover { 
          background: var(--surface-hover); 
          border-color: rgba(99,102,241,0.35); 
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .narr-sidebar-btn.icon-only {
          padding: 10px;
          width: auto;
          background: transparent;
          border: 1px solid transparent;
          color: var(--muted);
          box-shadow: none;
        }
        .narr-sidebar-btn.icon-only:hover {
          color: var(--text);
          background: var(--surface);
          border-color: var(--border);
          transform: none;
        }
        
        .narr-sidebar-search {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          transition: border-color 0.25s, box-shadow 0.25s;
          margin-bottom: 16px;
        }
        .narr-sidebar-search:focus-within {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .narr-sidebar-search input {
          background: transparent;
          border: none;
          color: var(--text);
          outline: none;
          font-size: 0.88rem;
          width: 100%;
          font-family: var(--font-body);
        }
        .narr-sidebar-search input::placeholder {
          color: rgba(232,232,240,0.3);
        }
        
        .narr-sidebar-icon {
          width: 16px; height: 16px; opacity: 0.8;
          display: flex; align-items: center; justify-content: center;
        }

        .narr-sidebar-section {
          margin-top: 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow-y: auto;
        }
        
        /* ── Sidebar Scrollbar ── */
        .narr-sidebar-section::-webkit-scrollbar { width: 4px; }
        .narr-sidebar-section::-webkit-scrollbar-track { background: transparent; }
        .narr-sidebar-section::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        .narr-sidebar-label {
          font-size: 0.72rem;
          color: #888;
          padding: 12px 12px 8px;
          font-weight: 500;
        }

        .narr-history-item {
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
          color: #d1d5db;
          transition: background 0.2s;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .narr-history-item:hover { background: rgba(255,255,255,0.08); color: #fff; }

        .narr-sidebar-footer {
          margin-top: auto;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .narr-sidebar-footer:hover { background: rgba(255,255,255,0.08); }
        
        .narr-avatar {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: #444;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.8rem; font-weight: 500;
        }
        .narr-user-info { display: flex; flex-direction: column; }
        .narr-user-name { font-size: 0.85rem; font-weight: 500; }
        .narr-user-plan { font-size: 0.7rem; color: #888; }

        .narr-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2rem;
          height: 60px;
          border-bottom: 1px solid var(--border);
          background: rgba(7,7,26,0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        /* ── Main ── */
        .narr-main-wrapper {
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
          background: var(--bg);
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          width: 100%;
        }
        
        .narr-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 1.5rem 2rem;
          position: relative;
          z-index: 1;
          overflow-y: auto;
        }

        /* ── Greeting ── */
        .narr-greeting {
          font-family: var(--font-display);
          font-size: clamp(2.2rem, 5vw, 3.6rem);
          font-weight: 400;
          text-align: center;
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: var(--text);
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.7s ease, transform 0.7s ease;
          margin-bottom: 0.3rem;
        }
        .narr-greeting.show { opacity: 1; transform: translateY(0); }

        .narr-subtitle {
          font-family: var(--font-body);
          font-size: clamp(0.95rem, 2vw, 1.1rem);
          color: var(--muted);
          text-align: center;
          font-weight: 300;
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.7s ease 0.15s, transform 0.7s ease 0.15s;
          margin-bottom: 2.8rem;
          max-width: 460px;
          line-height: 1.6;
        }
        .narr-subtitle.show { opacity: 1; transform: translateY(0); }

        /* ── Input box ── */
        .narr-input-wrap {
          width: 100%;
          max-width: 720px;
          opacity: 0;
          transform: translateY(20px) scale(0.98);
          transition: opacity 0.7s ease 0.25s, transform 0.7s ease 0.25s;
          margin-bottom: 1.6rem;
        }
        .narr-input-wrap.show { opacity: 1; transform: translateY(0) scale(1); }

        .narr-input-box {
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: 20px;
          padding: 0;
          display: flex;
          flex-direction: column;
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .narr-input-box.focused {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1), 0 8px 40px rgba(0,0,0,0.4);
        }

        .narr-textarea {
          background: transparent;
          border: none;
          outline: none;
          color: var(--text);
          font-family: var(--font-body);
          font-size: 0.98rem;
          font-weight: 400;
          line-height: 1.6;
          padding: 18px 20px 12px;
          resize: none;
          width: 100%;
          min-height: 60px;
          max-height: 220px;
          caret-color: var(--accent2);
        }
        .narr-textarea::placeholder { color: rgba(232,232,240,0.3); }

        .narr-input-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px 10px 16px;
          border-top: 1px solid rgba(255,255,255,0.04);
        }

        .narr-input-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .narr-badge {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          color: var(--muted);
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border);
          padding: 3px 8px;
          border-radius: 6px;
          letter-spacing: 0.03em;
        }
        .narr-badge.active {
          color: var(--teal);
          border-color: rgba(52,211,153,0.2);
          background: rgba(52,211,153,0.06);
          animation: badge-pulse 2s infinite ease-in-out;
        }
        @keyframes badge-pulse {
          0%, 100% { box-shadow: 0 0 0 rgba(52,211,153,0); }
          50% { box-shadow: 0 0 12px rgba(52,211,153,0.4); }
        }

        .narr-upload-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border);
          color: var(--muted);
          cursor: pointer;
          transition: all 0.2s;
        }
        .narr-upload-btn:hover {
          background: var(--surface-hover);
          border-color: rgba(99,102,241,0.35);
          color: var(--text);
          transform: translateY(-1px);
        }

        .narr-send-btn {
          width: 38px; height: 38px;
          background: var(--accent);
          border: none;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 0 14px rgba(99,102,241,0.3);
          flex-shrink: 0;
        }
        .narr-send-btn:hover { background: #4f52e8; transform: scale(1.05); box-shadow: 0 0 22px rgba(99,102,241,0.5); }
        .narr-send-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
        .narr-send-btn svg { width: 16px; height: 16px; fill: #fff; }

        /* ── Model Dropdown ── */
        .narr-model-wrap {
          position: relative;
        }
        .narr-model-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: 1.5px solid var(--border);
          color: var(--muted);
          padding: 8px 12px;
          border-radius: 10px;
          font-family: var(--font-body);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .narr-model-btn:hover, .narr-model-btn.active {
          border-color: rgba(99,102,241,0.4);
          color: var(--text);
          background: rgba(255,255,255,0.02);
        }
        .narr-model-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 140px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.5);
          opacity: 0;
          visibility: hidden;
          transform: translateY(10px);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 50;
        }
        .narr-model-dropdown.show {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        .narr-model-option {
          background: transparent;
          border: none;
          color: var(--muted);
          padding: 8px 12px;
          text-align: left;
          border-radius: 8px;
          font-family: var(--font-body);
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .narr-model-option:hover {
          background: var(--surface);
          color: var(--text);
        }
        .narr-model-option.selected {
          color: var(--accent2);
          background: rgba(167,139,250,0.1);
        }

        /* ── Suggestions ── */
        .narr-suggestions {
          width: 100%;
          max-width: 720px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s ease 0.38s, transform 0.7s ease 0.38s;
        }
        .narr-suggestions.show { opacity: 1; transform: translateY(0); }

        .narr-suggestions-label {
          font-size: 0.75rem;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 500;
          margin-bottom: 0.9rem;
          text-align: center;
        }

        .narr-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }

        .narr-chip {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 100px;
          padding: 8px 16px;
          font-size: 0.82rem;
          font-family: var(--font-body);
          color: var(--muted);
          cursor: pointer;
          display: flex; align-items: center; gap: 7px;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .narr-chip:hover {
          background: var(--surface-hover);
          border-color: rgba(99,102,241,0.35);
          color: var(--text);
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(99,102,241,0.12);
        }
        .narr-chip-icon { font-size: 0.85rem; }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 4px; }

        @media (max-width: 768px) {
          .narr-sidebar { 
            position: absolute; height: 100%; 
            box-shadow: 4px 0 20px rgba(0,0,0,0.5);
          }
          .narr-sidebar.closed { margin-left: 0; }
          .narr-toggle-float { display: flex; opacity: 1; pointer-events: auto; }
          .narr-chip { font-size: 0.76rem; padding: 7px 12px; }
        }
      `}</style>
      
      <div className="narr-layout">
        <button 
          className={`narr-toggle-float ${!isSidebarOpen ? 'visible' : ''}`}
          onClick={() => setIsSidebarOpen(true)}
          title="Open sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>

        <aside className={`narr-sidebar ${isSidebarOpen ? '' : 'closed'}`}>
          <div className="narr-sidebar-top-group">
            <button 
              className="narr-sidebar-btn" 
              onClick={() => navigate("/dashboard")}
              style={{ marginBottom: 10, justifyContent: 'center' }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>← Dashboard</span>
            </button>

          </div>

          <div className="narr-sidebar-top-group">
            <button 
              className="narr-sidebar-btn icon-only" 
              onClick={() => setIsSidebarOpen(false)}
              title="Close sidebar"
            >

              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
            <button className="narr-sidebar-btn icon-only" onClick={() => setQuery("")} title="New chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          
          <div className="narr-sidebar-search">
            <span className="narr-sidebar-icon" style={{ opacity: 0.5 }}>⚲</span>
            <input 
              type="text" 
              placeholder="Search chats..." 
            />
          </div>
          
          <div className="narr-sidebar-section">
            {/* Chat history will appear here and can be filtered by the search above */}
          </div>
        </aside>

        <div className="narr-main-wrapper">
          <AnimatedNetwork />

          {/* ── Main content ── */}
          <main className="narr-main">
            {/* Greeting */}
            <h1 className={`narr-greeting${mounted ? " show" : ""}`}>
              {greeting}, analyst.
            </h1>

          <p className={`narr-subtitle${mounted ? " show" : ""}`}>
            Ask a question about your data — get charts, insights, and reports instantly.
            No SQL, no dashboards, no waiting.
          </p>

          {/* Input */}
          <div className={`narr-input-wrap${mounted ? " show" : ""}`}>
            <div className={`narr-input-box${focused ? " focused" : ""}`}>
              <textarea
                className="narr-textarea"
                placeholder="Ask anything about your data…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                rows={2}
              />
              <div className="narr-input-footer">
                <div className="narr-input-meta">
                  <span className="narr-badge active">● AI Ready</span>
                  <span className="narr-badge">CSV / XLSX / JSON</span>
                  <label className="narr-upload-btn" title="Upload file">
                    <input type="file" accept=".csv, .xlsx, .json" style={{ display: 'none' }} />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="narr-model-wrap" ref={dropdownRef}>
                    <button 
                      className={`narr-model-btn ${isModelDropdownOpen ? 'active' : ''}`}
                      onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    >
                      {selectedModel}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, transform: isModelDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    <div className={`narr-model-dropdown ${isModelDropdownOpen ? 'show' : ''}`}>
                      {MODELS.map(model => (
                        <button
                          key={model}
                          className={`narr-model-option ${selectedModel === model ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedModel(model);
                            setIsModelDropdownOpen(false);
                          }}
                        >
                          {model}
                          {selectedModel === model && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="narr-send-btn"
                    onClick={() => handleSubmit()}
                    disabled={!query.trim()}
                    title="Send"
                  >
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Suggestion chips */}
          <div className={`narr-suggestions${mounted ? " show" : ""}`}>
            <p className="narr-suggestions-label">Try asking</p>
            <div className="narr-chips">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  className="narr-chip"
                  onClick={() => {
                    setQuery(s.label);
                    handleSubmit(s.label);
                  }}
                >
                  <span className="narr-chip-icon">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </main>
        </div>
      </div>
    </>
  );
}

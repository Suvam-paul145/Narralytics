import { useState, useEffect, useRef, memo } from "react";

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

export default function NarralyticsHome() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [greeting, setGreeting] = useState("Good morning");
  const [mounted, setMounted] = useState(false);

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

        /* ── Navbar ── */
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
        .narr-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: var(--text);
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 1.05rem;
          letter-spacing: -0.01em;
        }
        .narr-logo-icon {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem;
          box-shadow: 0 0 18px rgba(99,102,241,0.4);
        }
        .narr-logo span { color: var(--accent2); }
        .narr-nav-links {
          display: flex;
          gap: 2rem;
          list-style: none;
        }
        .narr-nav-links a {
          color: var(--muted);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 400;
          transition: color 0.2s;
        }
        .narr-nav-links a:hover { color: var(--text); }
        .narr-nav-actions { display: flex; align-items: center; gap: 12px; }
        .btn-ghost {
          background: none;
          border: 1px solid var(--border);
          color: var(--muted);
          padding: 7px 16px;
          border-radius: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          font-family: var(--font-body);
          transition: all 0.2s;
        }
        .btn-ghost:hover { border-color: rgba(255,255,255,0.2); color: var(--text); }
        .btn-primary {
          background: var(--accent);
          border: none;
          color: #fff;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 0.88rem;
          font-weight: 500;
          cursor: pointer;
          font-family: var(--font-body);
          display: flex; align-items: center; gap: 6px;
          transition: all 0.2s;
          box-shadow: 0 0 20px rgba(99,102,241,0.3);
        }
        .btn-primary:hover { background: #4f52e8; box-shadow: 0 0 28px rgba(99,102,241,0.5); transform: translateY(-1px); }

        /* ── Main ── */
        .narr-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 90px 1.5rem 2rem;
          position: relative;
          z-index: 1;
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
          overflow: hidden;
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

        /* ── Status bar ── */
        .narr-status {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 20px;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: rgba(232,232,240,0.25);
          z-index: 10;
          white-space: nowrap;
        }
        .narr-status-dot {
          width: 6px; height: 6px;
          background: var(--teal);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--teal);
          animation: pulse-dot 2s ease infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 4px; }

        @media (max-width: 640px) {
          .narr-nav-links { display: none; }
          .btn-ghost { display: none; }
          .narr-chip { font-size: 0.76rem; padding: 7px 12px; }
        }
      `}</style>

      <div className="narr-page">
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
    </>
  );
}

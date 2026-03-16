/**
 * Narralytics — Landing Page
 * ─────────────────────────────────────────────────────────────
 * Design:   Obsidian Intelligence — editorial dark-first aesthetic
 * Fonts:    DM Serif Display (headlines) · DM Sans (body) · JetBrains Mono (data)
 * 3D:       Three.js neural-network graph (mouse-interactive)
 * Theme:    Dark/Light toggle with CSS variables
 * Icons:    lucide-react (NO emojis)
 * Deps:     three, lucide-react
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart2, Brain, Upload, MessageSquare, FileText,
  Mic, Zap, Shield, ChevronRight, ArrowRight,
  Sun, Moon, Menu, X, Github, Twitter,
  Database, TrendingUp, Layers, Check, Star
} from "lucide-react";

// ─── THEME TOKENS ────────────────────────────────────────────
const THEMES = {
  dark: {
    "--bg":           "#05050f",
    "--bg-card":      "#0c0c1e",
    "--bg-card-2":    "#111128",
    "--bg-nav":       "rgba(5,5,15,0.90)",
    "--border":       "rgba(255,255,255,0.07)",
    "--border-glow":  "rgba(91,106,249,0.45)",
    "--text":         "#f0f0fc",
    "--text-muted":   "#9898c8",
    "--text-sub":     "#55557a",
    "--accent":       "#5b6af9",
    "--accent-soft":  "rgba(91,106,249,0.14)",
    "--accent-glow":  "rgba(91,106,249,0.28)",
    "--amber":        "#f5a623",
    "--amber-soft":   "rgba(245,166,35,0.12)",
    "--green":        "#2dd4a0",
    "--green-soft":   "rgba(45,212,160,0.12)",
    "--red":          "#ff6b8a",
    "--shadow":       "0 4px 32px rgba(0,0,0,0.5)",
    "--shadow-lg":    "0 12px 60px rgba(0,0,0,0.6)",
    "--gradient":     "linear-gradient(135deg,#5b6af9 0%,#8b5cf6 60%,#f5a623 100%)",
  },
  light: {
    "--bg":           "#f2f2f8",
    "--bg-card":      "#ffffff",
    "--bg-card-2":    "#f7f7fd",
    "--bg-nav":       "rgba(242,242,248,0.92)",
    "--border":       "rgba(0,0,0,0.08)",
    "--border-glow":  "rgba(67,56,202,0.4)",
    "--text":         "#06061a",
    "--text-muted":   "#3e3e68",
    "--text-sub":     "#8888b8",
    "--accent":       "#4338ca",
    "--accent-soft":  "rgba(67,56,202,0.09)",
    "--accent-glow":  "rgba(67,56,202,0.18)",
    "--amber":        "#b45309",
    "--amber-soft":   "rgba(180,83,9,0.09)",
    "--green":        "#047857",
    "--green-soft":   "rgba(4,120,87,0.09)",
    "--red":          "#be123c",
    "--shadow":       "0 2px 16px rgba(0,0,0,0.08)",
    "--shadow-lg":    "0 8px 40px rgba(0,0,0,0.12)",
    "--gradient":     "linear-gradient(135deg,#4338ca 0%,#7c3aed 60%,#b45309 100%)",
  }
};

// ─── GLOBAL STYLES ────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 2px; }

  @keyframes fadeUp   { from { opacity:0; transform:translateY(28px) } to { opacity:1; transform:translateY(0) } }
  @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
  @keyframes float    { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-8px) } }
  @keyframes shimmer  { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
  @keyframes glow     { 0%,100% { box-shadow:0 0 20px var(--accent-glow) } 50% { box-shadow:0 0 44px var(--accent-glow),0 0 80px var(--accent-soft) } }
  @keyframes spin     { to { transform:rotate(360deg) } }
  @keyframes pulse    { 0%,100% { opacity:1 } 50% { opacity:.4 } }
  @keyframes slideIn  { from { opacity:0;transform:translateX(-12px) } to { opacity:1;transform:translateX(0) } }
  @keyframes countUp  { from { opacity:0;transform:scale(.8) } to { opacity:1;transform:scale(1) } }

  .fade-up-1 { animation: fadeUp .7s cubic-bezier(.16,1,.3,1) .05s both }
  .fade-up-2 { animation: fadeUp .7s cubic-bezier(.16,1,.3,1) .18s both }
  .fade-up-3 { animation: fadeUp .7s cubic-bezier(.16,1,.3,1) .32s both }
  .fade-up-4 { animation: fadeUp .7s cubic-bezier(.16,1,.3,1) .46s both }
  .fade-up-5 { animation: fadeUp .7s cubic-bezier(.16,1,.3,1) .60s both }
  .float-anim { animation: float 5s ease-in-out infinite }

  @keyframes blinkColor {
    0%, 100% { border-color: var(--border-glow); background: var(--accent-soft); }
    50% { border-color: var(--accent); background: var(--accent-glow); }
  }
  .blink-anim { animation: blinkColor 2.5s ease-in-out infinite; }

  @keyframes blob-anim-1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
  }
  @keyframes blob-anim-2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-30px, 40px) scale(1.15); }
    66% { transform: translate(40px, -20px) scale(0.85); }
  }

  .hover-lift { transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease }
  .hover-lift:hover { transform: translateY(-4px) }
  .btn-hover { transition: all .2s ease }
  .btn-hover:hover { transform: translateY(-2px) }
  .transition-all { transition: all .25s ease }

  .gradient-text {
    background: var(--gradient);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 4s linear infinite;
  }

  .grid-bg {
    background-image:
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px);
    background-size: 56px 56px;
  }

  @media (max-width: 768px) {
    .hide-mobile { display: none !important }
    .mobile-col { flex-direction: column !important }
    .mobile-stack { grid-template-columns: 1fr !important }
    .mobile-2col { grid-template-columns: 1fr 1fr !important }
  }
  @media (max-width: 480px) {
    .mobile-2col { grid-template-columns: 1fr !important }
  }
`;

function StyleInjector() {
  useEffect(() => {
    const tag = document.createElement("style");
    tag.textContent = GLOBAL_CSS;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);
  return null;
}

// ─── THEME CONTEXT ─────────────────────────────────────────────
function applyTheme(isDark) {
  const tokens = isDark ? THEMES.dark : THEMES.light;
  const root = document.documentElement;
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v));
}



// ─── REUSABLE COMPONENTS ──────────────────────────────────────

// Section label (small all-caps above section title)
function EyebrowLabel({ children }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 600, letterSpacing: "0.18em",
      textTransform: "uppercase", color: "var(--accent)",
      marginBottom: 12,
    }}>
      {children}
    </p>
  );
}

// Section heading
function SectionTitle({ children, center = false }) {
  return (
    <h2 style={{
      fontFamily: "'DM Serif Display', serif",
      fontSize: "clamp(1.9rem, 4vw, 2.9rem)",
      fontWeight: 400, lineHeight: 1.12,
      letterSpacing: "-0.025em", color: "var(--text)",
      textAlign: center ? "center" : "left",
    }}>
      {children}
    </h2>
  );
}

// CTA button — primary
function BtnPrimary({ children, onClick, large }) {
  return (
    <button onClick={onClick} className="btn-hover" style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: large ? "14px 32px" : "10px 22px",
      background: "var(--accent)", color: "#fff",
      fontFamily: "'DM Sans', sans-serif",
      fontWeight: 600, fontSize: large ? "1rem" : "0.9rem",
      border: "none", borderRadius: 10, cursor: "pointer",
      boxShadow: "0 4px 20px var(--accent-glow)",
    }}>
      {children}
    </button>
  );
}

// CTA button — ghost
function BtnGhost({ children, onClick }) {
  return (
    <button onClick={onClick} className="btn-hover transition-all" style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "10px 22px",
      background: "transparent", color: "var(--text)",
      fontFamily: "'DM Sans', sans-serif",
      fontWeight: 500, fontSize: "0.9rem",
      border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-glow)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
    >
      {children}
    </button>
  );
}

// Feature card
function FeatureCard({ icon: Icon, color, title, desc, delay = 0 }) {
  return (
    <div className="hover-lift" style={{
      background: "var(--bg-card)", borderRadius: 16,
      border: "1px solid var(--border)", padding: "28px 24px",
      boxShadow: "var(--shadow)", animationDelay: `${delay}ms`,
      cursor: "default",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color + "60";
        e.currentTarget.style.boxShadow = `0 16px 48px ${color}18`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "var(--shadow)";
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: color + "18", border: `1px solid ${color}28`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 16, color,
      }}>
        <Icon size={20} />
      </div>
      <h3 style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "0.95rem", fontWeight: 600,
        color: "var(--text)", marginBottom: 8, letterSpacing: "-0.015em",
      }}>{title}</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.7 }}>{desc}</p>
    </div>
  );
}

// Step card
function StepCard({ number, icon: Icon, title, desc, color }) {
  return (
    <div style={{
      display: "flex", gap: 20, padding: "24px",
      background: "var(--bg-card)", borderRadius: 16,
      border: "1px solid var(--border)",
    }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${color}18`,
          border: `1px solid ${color}28`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color,
        }}>
          <Icon size={22} />
        </div>
      </div>
      <div>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "var(--text-sub)",
          marginBottom: 4,
        }}>Step {number}</p>
        <h3 style={{
          fontSize: "1rem", fontWeight: 600,
          color: "var(--text)", marginBottom: 6, letterSpacing: "-0.015em",
        }}>{title}</h3>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.7 }}>{desc}</p>
      </div>
    </div>
  );
}

// Stat card
function StatCard({ value, label, icon: Icon, color }) {
  return (
    <div style={{
      textAlign: "center", padding: "28px 20px",
      background: "var(--bg-card)", borderRadius: 16,
      border: "1px solid var(--border)",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9,
        background: `${color}18`, color,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px",
      }}>
        <Icon size={17} />
      </div>
      <p style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: "2.2rem", fontWeight: 400,
        color: "var(--text)", lineHeight: 1, marginBottom: 6,
      }}>{value}</p>
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>{label}</p>
    </div>
  );
}

// ─── NAVBAR ───────────────────────────────────────────────────
function NavBar({ isDark, onToggle, onGetStarted }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      height: 64,
      background: scrolled ? "var(--bg-nav)" : "transparent",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      borderBottom: scrolled ? "1px solid var(--border)" : "none",
      transition: "all .35s ease",
      display: "flex", alignItems: "center",
      padding: "0 clamp(16px, 4vw, 48px)",
      justifyContent: "space-between",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 16px var(--accent-glow)",
        }}>
          <Brain size={16} color="#fff" />
        </div>
        <span style={{
          fontFamily: "'DM Serif Display', serif",
          fontWeight: 400, fontSize: "1.15rem",
          letterSpacing: "-0.02em", color: "var(--text)",
        }}>
          Narra<span style={{ color: "var(--accent)" }}>lytics</span>
        </span>
      </div>

      {/* Nav links */}
      <div className="hide-mobile" style={{ display: "flex", gap: 32 }}>
        {["Features", "How it Works", "Pricing"].map(l => (
          <a key={l} href={`#${l.toLowerCase().replace(/\s/g, "-")}`} style={{
            fontSize: "0.87rem", fontWeight: 500,
            color: "var(--text-muted)", textDecoration: "none",
            transition: "color .2s",
          }}
            onMouseEnter={e => e.target.style.color = "var(--text)"}
            onMouseLeave={e => e.target.style.color = "var(--text-muted)"}
          >{l}</a>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Theme toggle */}
        <button onClick={onToggle} style={{
          width: 36, height: 36, borderRadius: 9,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "var(--text-muted)",
          transition: "all .2s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-glow)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <div className="hide-mobile">
          <BtnPrimary onClick={onGetStarted}>
            Get Started <ArrowRight size={14} />
          </BtnPrimary>
        </div>

        {/* Mobile menu */}
        <button className="btn-hover"
          onClick={() => setMobileOpen(p => !p)}
          style={{
            display: "none", width: 36, height: 36, borderRadius: 9,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--text-muted)",
          }}
          // visible only on mobile via CSS class
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>
    </nav>
  );
}

// ─── ANIMATED MOCKUP (HERO RIGHT SIDE) ────────────────────────
function AnimatedMockup() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => (s + 1) % 3);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: "relative",
      width: "100%",
      aspectRatio: "4/3",
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      boxShadow: "var(--shadow-lg)",
      overflow: "hidden",
    }}>
      {/* Mac-like header */}
      <div style={{
        height: 36, borderBottom: "1px solid var(--border)",
        background: "var(--bg-card-2)",
        display: "flex", alignItems: "center", padding: "0 16px", gap: 6,
      }}>
        <div style={{width: 10, height: 10, borderRadius: "50%", background: "var(--red)"}}/>
        <div style={{width: 10, height: 10, borderRadius: "50%", background: "var(--amber)"}}/>
        <div style={{width: 10, height: 10, borderRadius: "50%", background: "var(--green)"}}/>
      </div>

      <div style={{ position: "relative", height: "calc(100% - 36px)", padding: 24 }}>
        
        {/* Step 1: Upload CSV */}
        <div style={{
          position: "absolute", inset: 24,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          opacity: step === 0 ? 1 : 0,
          transform: step === 0 ? "translateY(0)" : "translateY(-20px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          pointerEvents: step === 0 ? "auto" : "none",
          border: "2px dashed var(--border)", borderRadius: 12,
          background: "var(--bg-card-2)"
        }}>
          <div className={step === 0 ? "float-anim" : ""} style={{
            width: 56, height: 56, borderRadius: 16,
            background: "var(--accent-soft)", color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
          }}>
            <FileText size={28} />
          </div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            sales_data_q3.csv
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Uploading and analyzing...</p>
          <div style={{ width: 140, height: 4, background: "var(--border)", borderRadius: 2, marginTop: 16, overflow: "hidden" }}>
            <div style={{ 
               height: "100%", background: "var(--accent)", 
               width: step === 0 ? "100%" : "0%", transition: "width 4s linear" 
            }} />
          </div>
        </div>

        {/* Step 2: Chat Interface */}
        <div style={{
          position: "absolute", inset: 24,
          display: "flex", flexDirection: "column", gap: 16,
          opacity: step === 1 ? 1 : 0,
          transform: step === 1 ? "translateY(0)" : step > 1 ? "translateY(-20px)" : "translateY(20px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          pointerEvents: step === 1 ? "auto" : "none",
        }}>
          <div style={{
            alignSelf: "flex-end", background: "var(--accent)", color: "#fff",
            padding: "10px 16px", borderRadius: "16px 16px 4px 16px",
            fontSize: "0.9rem", boxShadow: "0 4px 12px var(--accent-glow)",
            maxWidth: "85%", transform: step === 1 ? "translateY(0)" : "translateY(10px)",
            opacity: step === 1 ? 1 : 0, transition: "all 0.4s ease 0.3s"
          }}>
            Show me monthly revenue for Q3 compared to Q2.
          </div>
          <div style={{
            alignSelf: "flex-start", display: "flex", gap: 12, maxWidth: "85%",
            transform: step === 1 ? "translateY(0)" : "translateY(10px)",
            opacity: step === 1 ? 1 : 0, transition: "all 0.4s ease 0.9s"
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: "var(--accent-soft)",
              color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
              <Brain size={16} />
            </div>
            <div style={{
               background: "var(--bg-card-2)", border: "1px solid var(--border)",
               padding: "12px 16px", borderRadius: "4px 16px 16px 16px",
               fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.6
            }}>
              Analyzing your data... <br/>
              Found 12,450 rows. Grouping by month and calculating revenue sum.
            </div>
          </div>
        </div>

        {/* Step 3: Chart Visualization */}
        <div style={{
          position: "absolute", inset: 24,
          display: "flex", flexDirection: "column",
          opacity: step === 2 ? 1 : 0,
          transform: step === 2 ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          pointerEvents: step === 2 ? "auto" : "none",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Q3 Revenue</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--green)" }}>+24.5% vs Q2</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
               <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                 <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }}/>
                 <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Q3</span>
               </div>
               <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                 <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--border)" }}/>
                 <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Q2</span>
               </div>
            </div>
          </div>
          
          {/* Mock Chart */}
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "6%", paddingBottom: 10 }}>
            {[35, 60, 45, 75, 55, 85, 65].map((h, i) => (
              <div key={i} style={{
                flex: 1, position: "relative",
                display: "flex", alignItems: "flex-end",
              }}>
                <div style={{
                  width: "100%", background: i % 2 === 0 ? "var(--border)" : "var(--accent)",
                  height: step === 2 ? `${h}%` : "0%",
                  borderRadius: "4px 4px 0 0",
                  transition: `height 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.08 + 0.3}s`
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map(m => (
              <span key={m} style={{ fontSize: 10, color: "var(--text-sub)" }}>{m}</span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── HERO SECTION ─────────────────────────────────────────────
function Hero({ isDark, onGetStarted }) {
  return (
    <section style={{
      minHeight: "100vh", position: "relative",
      display: "flex", alignItems: "center",
      overflow: "hidden",
      background: "var(--bg)",
    }}>
      {/* Background — Abstract Glowing Orbs & Grid */}
      <div style={{
        position: "absolute", inset: 0,
        overflow: "hidden", pointerEvents: "none",
        background: isDark ? "#05050f" : "#f2f2f8",
        transition: "background .5s ease",
      }}>
        {/* Abstract Glowing Orbs */}
        <div style={{
          position: "absolute", top: "10%", left: "15%",
          width: "45vw", height: "45vw", borderRadius: "50%",
          background: "var(--accent)",
          opacity: isDark ? 0.15 : 0.08,
          filter: "blur(120px)",
          animation: "blob-anim-1 20s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "5%", right: "10%",
          width: "40vw", height: "40vw", borderRadius: "50%",
          background: "var(--amber)",
          opacity: isDark ? 0.12 : 0.06,
          filter: "blur(140px)",
          animation: "blob-anim-2 25s ease-in-out infinite reverse",
        }} />

        {/* Subtle Grid Base */}
        <div className="grid-bg" style={{
          position: "absolute", inset: "-50%",
          opacity: isDark ? 0.4 : 0.25,
          transform: "perspective(1000px) rotateX(60deg) translateY(-100px) scale(2.5)",
          transformOrigin: "top center",
        }} />

        {/* Radial Fade Overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: isDark
            ? "radial-gradient(circle at center, transparent 0%, var(--bg) 65%)"
            : "radial-gradient(circle at center, transparent 0%, var(--bg) 65%)",
        }} />
      </div>

      {/* Hero content */}
      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 1240, margin: "0 auto",
        padding: "120px clamp(24px, 5vw, 48px) 80px",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center",
      }} className="mobile-stack">
        
        {/* Left Side: Copy & CTAs */}
        <div style={{ textAlign: "left" }}>
          {/* Badge */}
          <div className="fade-up-1" style={{ marginBottom: 28 }}>
            <div className="blink-anim" style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "5px 14px", borderRadius: 20,
              background: "var(--accent-soft)",
              border: "1px solid var(--border-glow)",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--amber)", display: "inline-block",
                boxShadow: "0 0 8px var(--amber)", animation: "glow 2s ease-in-out infinite",
              }} />
              <span style={{
                fontSize: 11, fontWeight: 600,
                letterSpacing: "0.07em", textTransform: "uppercase",
                color: "var(--accent)",
              }}>
                AI-Powered Business Intelligence
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="fade-up-2" style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(2.5rem, 4.5vw, 4.2rem)",
            fontWeight: 400, lineHeight: 1.05,
            letterSpacing: "-0.03em", color: "var(--text)",
            marginBottom: 24,
          }}>
            Turn Your CSV Data Into<br />
            <span className="gradient-text">Insights With AI.</span>
          </h1>

          {/* Subheading */}
          <p className="fade-up-3" style={{
            fontSize: "clamp(1rem, 1.3vw, 1.15rem)",
            color: "var(--text-muted)", lineHeight: 1.7,
            marginBottom: 40, fontWeight: 400,
            maxWidth: 540,
          }}>
            Upload your business data and ask questions in plain English. 
            Instantly generate answers, charts, and interactive dashboards.
          </p>

          {/* CTAs */}
          <div className="fade-up-4" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <BtnPrimary onClick={onGetStarted} large>
              Get Started <ArrowRight size={18} />
            </BtnPrimary>
          </div>
        </div>

        {/* Right Side: Animated Mockup */}
        <div className="fade-up-3" style={{ position: "relative", zIndex: 10 }}>
          <AnimatedMockup />
          
          {/* Floating Accents */}
          <div className="float-anim" style={{
            position: "absolute", top: -24, right: -24,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            padding: "12px 16px", borderRadius: 12,
            boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: 10,
            animationDelay: "1s"
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 8px var(--green)" }} />
            <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>Database Connected</span>
          </div>

          <div className="float-anim" style={{
            position: "absolute", bottom: -20, left: -24,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            padding: "14px", borderRadius: 12,
            boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: 12,
            animationDelay: "0s"
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Rows Analyzed</p>
              <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", fontFamily: "'JetBrains Mono', monospace" }}>2,450,192</p>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom fade */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 160,
        background: "linear-gradient(to top, var(--bg), transparent)",
        pointerEvents: "none",
        zIndex: 2,
      }} />

    </section>
  );
}

// ─── FEATURES SECTION ─────────────────────────────────────────
function FeaturesSection() {
  const features = [
    { icon: Upload,      color: "#5b6af9", title: "Upload Any Dataset",    desc: "Drag and drop CSV or Excel files. Narralytics auto-detects your schema, column types, and date ranges instantly." },
    { icon: BarChart2,   color: "#f5a623", title: "Auto Dashboard",        desc: "Get 6–10 meaningful charts generated automatically from your data — trends, comparisons, distributions." },
    { icon: MessageSquare, color: "#2dd4a0", title: "Natural Language Queries", desc: "Ask business questions in plain English. The AI writes SQL, executes it, and returns interactive charts." },
    { icon: Mic,         color: "#ff6b8a", title: "Voice Assistant",       desc: "Speak your queries out loud. Voice input converts to text, same AI pipeline — results read back to you." },
    { icon: TrendingUp,  color: "#a78bfa", title: "Forecasting on Demand", desc: "Explicitly ask for predictions and the system runs statistical extrapolation with confidence intervals." },
    { icon: FileText,    color: "#f5a623", title: "PDF Reports",           desc: "Export full analytical reports with charts, executive summary, and statistical calculations in one click." },
  ];

  return (
    <section id="features" style={{
      padding: "100px clamp(20px,5vw,64px)",
      background: "var(--bg)", position: "relative",
    }}>
      {/* Subtle grid background */}
      <div className="grid-bg" style={{
        position: "absolute", inset: 0, opacity: 0.35,
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <EyebrowLabel>Features</EyebrowLabel>
          <SectionTitle center>
            Everything you need to
            <br />
            <em>understand your data</em>
          </SectionTitle>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 18,
        }} className="mobile-stack" id="features-grid">
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} delay={i * 70} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── HOW IT WORKS ─────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { icon: Upload,    color: "#5b6af9", title: "Upload your dataset",       desc: "CSV or Excel file. We detect columns, types, date ranges, and build a queryable database instantly." },
    { icon: BarChart2, color: "#f5a623", title: "Get an instant dashboard",  desc: "AI analyzes your schema and generates 6–10 meaningful chart specs covering trends, rankings, and distributions." },
    { icon: MessageSquare, color: "#2dd4a0", title: "Ask business questions", desc: "Type or speak. The AI writes SQL, runs it against your data, and returns charts with business insights." },
  ];

  return (
    <section id="how-it-works" style={{
      padding: "100px clamp(20px,5vw,64px)",
      background: "var(--bg-card-2)",
      borderTop: "1px solid var(--border)",
      borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: 52 }}>
          <EyebrowLabel>How it Works</EyebrowLabel>
          <SectionTitle>From upload to insight<br />in three steps</SectionTitle>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {steps.map((s, i) => <StepCard key={i} number={i + 1} {...s} />)}
        </div>
      </div>
    </section>
  );
}

// ─── STATS SECTION ────────────────────────────────────────────
function Stats() {
  const stats = [
    { value: "50K+",  label: "Rows analyzed per query",  icon: Database,   color: "#5b6af9" },
    { value: "6–10",  label: "Charts auto-generated",    icon: BarChart2,  color: "#f5a623" },
    { value: "< 5s",  label: "Average response time",    icon: Zap,        color: "#2dd4a0" },
    { value: "100%",  label: "Hallucination protected",  icon: Shield,     color: "#ff6b8a" },
  ];

  return (
    <section style={{
      padding: "80px clamp(20px,5vw,64px)",
      background: "var(--bg)",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16,
        }} className="mobile-2col">
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      </div>
    </section>
  );
}

// ─── PRICING / CTA SECTION ────────────────────────────────────
function CTASection({ onGetStarted }) {
  return (
    <section id="pricing" style={{
      padding: "100px clamp(20px,5vw,64px)",
      background: "var(--bg-card-2)",
      borderTop: "1px solid var(--border)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Glow orb */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 400, height: 200, borderRadius: "50%",
        background: "radial-gradient(ellipse, var(--accent-glow) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        maxWidth: 620, margin: "0 auto",
        textAlign: "center", position: "relative", zIndex: 1,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "5px 14px", borderRadius: 20,
          background: "var(--accent-soft)", border: "1px solid var(--border-glow)",
          marginBottom: 28,
        }}>
          <Star size={12} color="var(--amber)" fill="var(--amber)" />
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
            textTransform: "uppercase", color: "var(--accent)",
          }}>Free to use</span>
        </div>

        <h2 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: "clamp(2.2rem, 5vw, 3.6rem)",
          fontWeight: 400, lineHeight: 1.08,
          letterSpacing: "-0.03em", color: "var(--text)",
          marginBottom: 18,
        }}>
          Ready to talk<br />
          <span className="gradient-text">to your data?</span>
        </h2>

        <p style={{
          fontSize: "1.05rem", color: "var(--text-muted)",
          lineHeight: 1.7, marginBottom: 40,
        }}>
          Upload any dataset and start asking questions in seconds.
          No setup, no SQL, no waiting.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <BtnPrimary onClick={onGetStarted} large>
            Get Started Free <ArrowRight size={16} />
          </BtnPrimary>
        </div>

        {/* Plan comparison */}
        <div style={{
          marginTop: 48, display: "grid",
          gridTemplateColumns: "1fr 1fr", gap: 16,
          textAlign: "left",
        }} className="mobile-stack">
          {[
            { label: "Free", features: ["5 datasets", "Auto dashboard", "Natural language queries", "PDF export"] },
            { label: "Pro — coming soon", features: ["Unlimited datasets", "Voice assistant", "Advanced forecasting", "Team sharing", "Priority LLM"] },
          ].map((plan, pi) => (
            <div key={pi} style={{
              padding: "22px", borderRadius: 14,
              background: pi === 1 ? "var(--accent-soft)" : "var(--bg-card)",
              border: `1px solid ${pi === 1 ? "var(--border-glow)" : "var(--border)"}`,
            }}>
              <p style={{
                fontSize: "0.85rem", fontWeight: 700,
                color: pi === 1 ? "var(--accent)" : "var(--text-muted)",
                marginBottom: 12, letterSpacing: "0.04em",
              }}>{plan.label}</p>
              {plan.features.map(f => (
                <div key={f} style={{
                  display: "flex", gap: 8, alignItems: "flex-start",
                  marginBottom: 7,
                }}>
                  <Check size={13} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{f}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid var(--border)",
      padding: "32px clamp(20px,5vw,64px)",
      background: "var(--bg)",
    }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto",
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Brain size={13} color="#fff" />
          </div>
          <span style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "0.95rem", color: "var(--text)",
          }}>
            Narra<span style={{ color: "var(--accent)" }}>lytics</span>
          </span>
        </div>

        <div className="hide-mobile" style={{ display: "flex", gap: 28 }}>
          {["Features", "GitHub", "Documentation"].map(l => (
            <a key={l} href="#" style={{
              fontSize: 13, color: "var(--text-muted)", textDecoration: "none",
              transition: "color .2s",
            }}
              onMouseEnter={e => e.target.style.color = "var(--text)"}
              onMouseLeave={e => e.target.style.color = "var(--text-muted)"}
            >{l}</a>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "var(--text-sub)" }}>
          © {new Date().getFullYear()} Narralytics · Built with AI
        </p>
      </div>
    </footer>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────
export default function Landing({ onGetStarted }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => applyTheme(isDark), [isDark]);

  const toggle = () => setIsDark(p => !p);
  const handleStart = onGetStarted || (() => console.log("Navigate to dashboard"));

  return (
    <>
      <StyleInjector />
      <div style={{
        minHeight: "100vh",
        background: "var(--bg)", color: "var(--text)",
        transition: "background .4s ease, color .4s ease",
      }}>
        <NavBar isDark={isDark} onToggle={toggle} onGetStarted={handleStart} />
        <Hero isDark={isDark} onGetStarted={handleStart} />
        <FeaturesSection />
        <HowItWorks />
        <Stats />
        <CTASection onGetStarted={handleStart} />
        <Footer />
      </div>
    </>
  );
}

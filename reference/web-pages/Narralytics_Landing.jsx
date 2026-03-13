import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════
   NARRALYTICS — World-Class Landing Page
   Design: Premium Data Intelligence Aesthetic
   Fonts: Syne (display) + Outfit (body)
   Theme: Dark-first with smooth light mode toggle
   3D: Three.js particle constellation in hero
════════════════════════════════════════════════════════════════ */

// ─── DESIGN TOKENS ────────────────────────────────────────────
const DARK = {
  bg:           "#03030a",
  bgCard:       "#0c0c18",
  bgNav:        "rgba(3,3,10,0.88)",
  border:       "rgba(99,102,241,0.18)",
  borderHover:  "rgba(99,102,241,0.55)",
  text:         "#f2f2fa",           // ✅ Pure near-white — maximum legibility
  textMuted:    "#a8b0cc",           // ✅ FIXED: was #6b7280 (4.1:1) → now 8.3:1 contrast on #03030a
  textSubtle:   "#606880",           // ✅ FIXED: was #374151 (near-invisible) → now clearly visible
  accent:       "#6366f1",
  accentLight:  "#a5b4fc",           // ✅ Lighter indigo — more legible on dark bg
  accentGlow:   "rgba(99,102,241,0.25)",
  amber:        "#fbbf24",           // ✅ Brighter amber for dark bg
  emerald:      "#34d399",           // ✅ Brighter green for dark bg
  rose:         "#fb7185",           // ✅ Brighter rose for dark bg
  cyan:         "#22d3ee",           // ✅ Brighter cyan for dark bg
  surface:      "rgba(12,12,24,0.85)",
};

const LIGHT = {
  bg:           "#f4f4fa",           // ✅ Slightly more neutral
  bgCard:       "#ffffff",
  bgNav:        "rgba(244,244,250,0.92)",
  border:       "rgba(99,102,241,0.14)",
  borderHover:  "rgba(99,102,241,0.5)",
  text:         "#07071a",           // ✅ FIXED: near-black for maximum contrast on white
  textMuted:    "#404468",           // ✅ FIXED: was #6b7280 (4.6:1) → now 9.1:1 on #f4f4fa
  textSubtle:   "#8890b0",           // ✅ FIXED: was #d1d5db (barely visible) → clearly readable
  accent:       "#4338ca",           // ✅ Darker indigo — passes AA on white
  accentLight:  "#4f46e5",
  accentGlow:   "rgba(67,56,202,0.12)",
  amber:        "#b45309",           // ✅ Dark amber — legible on light bg
  emerald:      "#047857",           // ✅ Dark green — legible on light bg
  rose:         "#be123c",           // ✅ Dark rose — legible on light bg
  cyan:         "#0e7490",           // ✅ Dark cyan — legible on light bg
  surface:      "rgba(255,255,255,0.95)",
};

// ─── GLOBAL STYLES INJECTION ──────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: 'Outfit', sans-serif; }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #6366f1; border-radius: 2px; }

    /* Animations */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(32px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-10px); }
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.3); }
      50%       { box-shadow: 0 0 40px rgba(99,102,241,0.6), 0 0 80px rgba(99,102,241,0.2); }
    }
    @keyframes shimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes spin-slow {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0; }
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-20px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    .fade-up-1 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
    .fade-up-2 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.25s both; }
    .fade-up-3 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s both; }
    .fade-up-4 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.55s both; }
    .fade-up-5 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.7s both; }
    .float-anim { animation: float 6s ease-in-out infinite; }

    .card-hover {
      transition: transform 0.3s cubic-bezier(0.16,1,0.3,1),
                  box-shadow 0.3s ease,
                  border-color 0.3s ease;
    }
    .card-hover:hover {
      transform: translateY(-6px);
    }

    .btn-primary {
      transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
    }

    .nav-link {
      transition: color 0.2s ease;
      text-decoration: none;
      cursor: pointer;
    }

    /* Typing cursor */
    .cursor::after {
      content: '|';
      animation: blink 1s step-end infinite;
    }

    /* Gradient text */
    .gradient-text {
      background: linear-gradient(135deg, #818cf8 0%, #6366f1 40%, #a78bfa 70%, #f59e0b 100%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: shimmer 4s linear infinite;
    }

    @media (max-width: 768px) {
      .hide-mobile { display: none !important; }
      .grid-mobile-1 { grid-template-columns: 1fr !important; }
      .grid-mobile-2 { grid-template-columns: 1fr 1fr !important; }
      .hero-text { font-size: clamp(2.4rem, 8vw, 3rem) !important; }
      .section-pad { padding: 60px 20px !important; }
    }
  `}</style>
);

// ─── THREE.JS PARTICLE CONSTELLATION ─────────────────────────
function useThreeScene(canvasRef, isDark) {
  const sceneRef    = useRef(null);
  const rendererRef = useRef(null);
  const frameRef    = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;

    // Scene setup
    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.set(0, 0, 55);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    sceneRef.current    = scene;
    rendererRef.current = renderer;

    // ── Particle nodes ────────────────────────────────────────
    const PARTICLE_COUNT = 90;
    const positions      = new Float32Array(PARTICLE_COUNT * 3);
    const particleData   = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 18 + Math.random() * 22;

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi) * 0.4;

      particleData.push({
        ox: positions[i * 3],
        oy: positions[i * 3 + 1],
        oz: positions[i * 3 + 2],
        speed: 0.3 + Math.random() * 0.7,
        offset: Math.random() * Math.PI * 2,
      });
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particleMat = new THREE.PointsMaterial({
      color:       0x818cf8,
      size:        0.55,
      transparent: true,
      opacity:     isDark ? 0.85 : 0.5,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // ── Connection lines ──────────────────────────────────────
    const CONNECT_DIST = 14;
    const linePositions = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const dx = positions[i*3]   - positions[j*3];
        const dy = positions[i*3+1] - positions[j*3+1];
        const dz = positions[i*3+2] - positions[j*3+2];
        const d  = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d < CONNECT_DIST) {
          linePositions.push(
            positions[i*3], positions[i*3+1], positions[i*3+2],
            positions[j*3], positions[j*3+1], positions[j*3+2]
          );
        }
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(linePositions, 3)
    );
    const lineMat = new THREE.LineBasicMaterial({
      color:       0x6366f1,
      transparent: true,
      opacity:     isDark ? 0.2 : 0.12,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    // ── Accent nodes (larger, amber) ─────────────────────────
    const accentGeo = new THREE.BufferGeometry();
    const accentPos = new Float32Array(8 * 3);
    for (let i = 0; i < 8; i++) {
      accentPos[i*3]   = (Math.random() - 0.5) * 50;
      accentPos[i*3+1] = (Math.random() - 0.5) * 40;
      accentPos[i*3+2] = (Math.random() - 0.5) * 20;
    }
    accentGeo.setAttribute("position", new THREE.BufferAttribute(accentPos, 3));
    const accentMat = new THREE.PointsMaterial({
      color: 0xf59e0b, size: 1.2, transparent: true, opacity: 0.7,
    });
    scene.add(new THREE.Points(accentGeo, accentMat));

    // ── Animation loop ────────────────────────────────────────
    let t = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.005;

      // Gentle scene rotation
      particles.rotation.y = t * 0.08;
      particles.rotation.x = Math.sin(t * 0.05) * 0.08;
      lines.rotation.y     = t * 0.08;
      lines.rotation.x     = Math.sin(t * 0.05) * 0.08;

      // Subtle particle drift
      const pos = particleGeo.attributes.position.array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const d = particleData[i];
        pos[i*3+1] = d.oy + Math.sin(t * d.speed + d.offset) * 1.2;
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Camera gentle sway
      camera.position.x = Math.sin(t * 0.07) * 3;
      camera.position.y = Math.cos(t * 0.05) * 2;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize handler ────────────────────────────────────────
    const onResize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, [isDark]);
}

// ─── SECTION WRAPPER ─────────────────────────────────────────
const Section = ({ id, children, style = {} }) => (
  <section id={id} style={{ position: "relative", ...style }}>
    {children}
  </section>
);

// ─── NAV BAR ─────────────────────────────────────────────────
const NavBar = ({ isDark, onToggle, t }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navStyle = {
    position:     "fixed",
    top:          0, left: 0, right: 0,
    zIndex:       1000,
    padding:      "0 48px",
    height:       64,
    display:      "flex",
    alignItems:   "center",
    justifyContent: "space-between",
    background:   scrolled ? t.bgNav : "transparent",
    backdropFilter: scrolled ? "blur(20px)" : "none",
    borderBottom: scrolled ? `1px solid ${t.border}` : "none",
    transition:   "all 0.4s ease",
  };

  return (
    <nav style={navStyle} role="navigation" aria-label="Main navigation">
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 800,
          boxShadow: "0 0 16px rgba(99,102,241,0.4)",
        }}>N</div>
        <span style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 800,
          fontSize: "1.1rem", letterSpacing: "-0.03em", color: t.text,
        }}>
          Narra<span style={{ color: t.accent }}>lytics</span>
        </span>
      </div>

      {/* Nav links */}
      <div className="hide-mobile" style={{ display: "flex", gap: 36, alignItems: "center" }}>
        {["Features", "How it Works", "Services"].map(link => (
          <a key={link}
            href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
            className="nav-link"
            style={{ fontSize: 14, fontWeight: 500, color: t.textMuted }}
            onMouseEnter={e => e.target.style.color = t.accent}
            onMouseLeave={e => e.target.style.color = t.textMuted}
          >{link}</a>
        ))}
      </div>

      {/* Right actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Theme toggle */}
        <button
          onClick={onToggle}
          aria-label="Toggle theme"
          style={{
            width: 40, height: 40, borderRadius: 10,
            background:  t.bgCard, border: `1px solid ${t.border}`,
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 16, transition: "all 0.3s ease",
            color: t.text,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; }}
        >
          {isDark ? "☀️" : "🌙"}
        </button>

        {/* CTA */}
        <button
          className="btn-primary"
          style={{
            padding: "9px 20px", borderRadius: 10, cursor: "pointer",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            border: "none", color: "#fff",
            fontFamily: "'Syne', sans-serif", fontWeight: 700,
            fontSize: 13, letterSpacing: "-0.01em",
            boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
          }}
        >
          Get Started →
        </button>
      </div>
    </nav>
  );
};

// ─── HERO SECTION ─────────────────────────────────────────────
const Hero = ({ isDark, t }) => {
  const canvasRef = useRef(null);
  useThreeScene(canvasRef, isDark);

  const queries = [
    "Show monthly revenue by region for 2023",
    "Why are Electronics outperforming Books?",
    "Compare payment methods by avg order value",
  ];

  return (
    <Section id="hero" style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden", background: t.bg,
    }}>
      {/* Three.js Canvas — full background */}
      <canvas ref={canvasRef} style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        opacity: isDark ? 1 : 0.5,
        transition: "opacity 0.5s ease",
      }} />

      {/* Radial gradient overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: isDark
          ? "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(99,102,241,0.08) 0%, transparent 70%)"
          : "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(99,102,241,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Bottom fade to next section */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 200,
        background: `linear-gradient(to top, ${t.bg}, transparent)`,
        pointerEvents: "none",
      }} />

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 1,
        textAlign: "center", padding: "120px 24px 80px",
        maxWidth: 820, margin: "0 auto",
      }}>

        {/* Badge */}
        <div className="fade-up-1" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 14px", borderRadius: 20,
          border: `1px solid ${t.accent}60`,
          background: `${t.accent}12`,
          marginBottom: 32,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: t.amber,
            boxShadow: `0 0 8px ${t.amber}`,
            animation: "pulse-glow 2s ease-in-out infinite",
            display: "inline-block",
          }} />
          <span style={{
            fontSize: 12, fontWeight: 600, color: t.accentLight,
            fontFamily: "'Outfit', sans-serif", letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}>
            Natural Language → Instant Dashboard
          </span>
        </div>

        {/* Headline */}
        <h1 className="fade-up-2 hero-text" style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: "clamp(3rem, 6.5vw, 5.2rem)",
          lineHeight: 1.05,
          letterSpacing: "-0.04em",
          color: t.text,
          marginBottom: 24,
        }}>
          Your data speaks.
          <br />
          <span className="gradient-text">You just ask.</span>
        </h1>

        {/* Subheading */}
        <p className="fade-up-3" style={{
          fontSize: "clamp(1rem, 2vw, 1.2rem)",
          color: t.textMuted, lineHeight: 1.75,
          maxWidth: 540, margin: "0 auto 48px",
          fontWeight: 400,
        }}>
          Narralytics transforms plain English into fully interactive dashboards
          and analyst-grade insights — no SQL, no BI tools, no waiting.
          Built for executives who need answers now.
        </p>

        {/* Sample query chips */}
        <div className="fade-up-4" style={{
          display: "flex", flexWrap: "wrap", gap: 10,
          justifyContent: "center", marginBottom: 44,
        }}>
          {queries.map((q, i) => (
            <div key={i} style={{
              padding: "8px 14px", borderRadius: 8,
              background: t.bgCard,
              border: `1px solid ${t.border}`,
              fontSize: 12, color: t.textMuted,
              fontFamily: "'JetBrains Mono', monospace",
              transition: "all 0.3s ease", cursor: "pointer",
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = t.accent;
                e.currentTarget.style.color = t.accentLight;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.color = t.textMuted;
              }}
            >
              "{q}"
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="fade-up-5" style={{
          display: "flex", gap: 14, justifyContent: "center",
          flexWrap: "wrap",
        }}>
          <button className="btn-primary" style={{
            padding: "15px 36px", borderRadius: 12, cursor: "pointer",
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            border: "none", color: "#fff",
            fontFamily: "'Syne', sans-serif", fontWeight: 700,
            fontSize: "1rem", letterSpacing: "-0.01em",
            boxShadow: "0 8px 32px rgba(99,102,241,0.4), 0 0 0 1px rgba(99,102,241,0.2)",
          }}>
            Get Started — Sign in with Google
          </button>
          <button className="btn-primary" style={{
            padding: "15px 28px", borderRadius: 12, cursor: "pointer",
            background: "transparent",
            border: `1px solid ${t.border}`,
            color: t.text,
            fontFamily: "'Syne', sans-serif", fontWeight: 600,
            fontSize: "1rem",
          }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = t.accent;
              e.currentTarget.style.background = t.accentGlow;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = t.border;
              e.currentTarget.style.background = "transparent";
            }}
          >
            Watch Demo ▸
          </button>
        </div>

        {/* Social proof */}
        <p style={{
          marginTop: 28, fontSize: 12, color: t.textMuted,
          fontWeight: 400,
        }}>
          Free · Amazon Sales dataset pre-loaded · No setup required
        </p>
      </div>

      {/* Scroll indicator */}
      <div style={{
        position: "absolute", bottom: 32, left: "50%",
        transform: "translateX(-50%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 6,
        animation: "float 2.5s ease-in-out infinite",
      }}>
        <div style={{
          width: 24, height: 38, borderRadius: 12,
          border: `2px solid ${t.border}`,
          position: "relative", display: "flex",
          justifyContent: "center", paddingTop: 6,
        }}>
          <div style={{
            width: 4, height: 8, borderRadius: 2,
            background: t.accent,
            animation: "float 1.5s ease-in-out infinite",
          }} />
        </div>
      </div>
    </Section>
  );
};

// ─── HOW IT WORKS ─────────────────────────────────────────────
const HowItWorks = ({ t }) => {
  const steps = [
    {
      num: "01",
      icon: "💬",
      color: "#6366f1",
      title: "Ask in Plain English",
      desc: "Type any business question naturally — 'Show me Q3 revenue by region' or 'Why is Asia outperforming Europe?' No SQL, no technical jargon.",
    },
    {
      num: "02",
      icon: "📊",
      color: "#f59e0b",
      title: "Two Visual Options",
      desc: "Every query returns two genuinely different chart perspectives. A bar chart and a trend line. A total and a breakdown. You choose what reveals more insight.",
    },
    {
      num: "03",
      icon: "🧠",
      color: "#10b981",
      title: "Chat with Your Data",
      desc: "Switch to Chat Mode for narrative answers. Ask strategic questions and get analyst-grade responses backed by real numbers from your dataset.",
    },
  ];

  return (
    <Section id="how-it-works" style={{
      padding: "120px 48px", background: t.bg,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <p style={{
            fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase",
            color: t.accent, fontWeight: 700, marginBottom: 14,
          }}>How It Works</p>
          <h2 style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.03em",
            color: t.text, lineHeight: 1.1,
          }}>
            From question to insight<br />in three steps
          </h2>
        </div>

        {/* Steps */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 24,
        }} className="grid-mobile-1">
          {steps.map((step, i) => (
            <div key={i} className="card-hover" style={{
              background: t.bgCard,
              borderRadius: 20,
              border: `1px solid ${t.border}`,
              padding: "36px 32px",
              position: "relative",
              overflow: "hidden",
              cursor: "default",
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = step.color + "60";
                e.currentTarget.style.boxShadow = `0 20px 60px ${step.color}15`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Number watermark */}
              <div style={{
                position: "absolute", top: 16, right: 20,
                fontFamily: "'Syne', sans-serif", fontWeight: 800,
                fontSize: "4rem", lineHeight: 1,
                color: step.color + "12",
                userSelect: "none",
              }}>{step.num}</div>

              {/* Icon */}
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: step.color + "18",
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 22,
                marginBottom: 20,
                border: `1px solid ${step.color}30`,
              }}>{step.icon}</div>

              {/* Connector line (not on last) */}
              {i < 2 && (
                <div className="hide-mobile" style={{
                  position: "absolute", top: "50%", right: -12,
                  width: 24, height: 2, zIndex: 2,
                  background: `linear-gradient(to right, ${step.color}60, transparent)`,
                }} />
              )}

              <h3 style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 700,
                fontSize: "1.1rem", color: t.text,
                marginBottom: 12, letterSpacing: "-0.02em",
              }}>{step.title}</h3>

              <p style={{
                fontSize: 14, color: t.textMuted,
                lineHeight: 1.75, fontWeight: 400,
              }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
};

// ─── FEATURES SECTION ─────────────────────────────────────────
const Features = ({ t }) => {
  const features = [
    {
      icon: "⚡",
      color: "#6366f1",
      title: "Instant SQL Generation",
      desc: "Gemini AI translates your question to precise SQL in milliseconds. Full hallucination detection ensures you never see fabricated data.",
    },
    {
      icon: "🎯",
      color: "#f59e0b",
      title: "Dual Chart Selection",
      desc: "Every query returns two visual options — two angles on the same data. See it as a trend or a breakdown before committing.",
    },
    {
      icon: "💬",
      color: "#10b981",
      title: "Conversational Follow-ups",
      desc: "'Now filter to Asia only.' 'Break this down by quarter.' Full context retained across the conversation.",
    },
    {
      icon: "🛡️",
      color: "#ec4899",
      title: "Hallucination Protection",
      desc: "When your question exceeds the dataset, Narralytics says so. No fabricated numbers. No confident lies.",
    },
    {
      icon: "📝",
      color: "#06b6d4",
      title: "Analyst-Grade Narratives",
      desc: "Chat Mode answers like a senior analyst — backed by real SQL queries, written as executive-ready prose.",
    },
    {
      icon: "🔍",
      color: "#a78bfa",
      title: "SQL Transparency",
      desc: "Every chart has a 'View SQL' toggle. Technical stakeholders can verify every query that ran against the data.",
    },
  ];

  return (
    <Section id="features" style={{
      padding: "120px 48px",
      background: isDark => isDark
        ? "linear-gradient(180deg, #03030a 0%, #06060f 50%, #03030a 100%)"
        : t.bg,
    }}>
      {/* Subtle grid background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(${t.border} 1px, transparent 1px),
                          linear-gradient(90deg, ${t.border} 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
        opacity: 0.4,
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
      }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <p style={{
            fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase",
            color: t.accent, fontWeight: 700, marginBottom: 14,
          }}>Features</p>
          <h2 style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.03em",
            color: t.text, lineHeight: 1.1,
          }}>
            Everything a CXO needs.<br />Nothing they don't.
          </h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 20,
        }} className="grid-mobile-1">
          {features.map((f, i) => (
            <div key={i} className="card-hover" style={{
              background: t.bgCard,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              padding: "28px",
              transition: "all 0.3s ease",
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = f.color + "50";
                e.currentTarget.style.boxShadow = `0 12px 40px ${f.color}12`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                fontSize: 24, marginBottom: 16,
                width: 44, height: 44,
                borderRadius: 10,
                background: f.color + "15",
                border: `1px solid ${f.color}25`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{f.icon}</div>
              <h4 style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 700,
                fontSize: "0.95rem", color: t.text,
                marginBottom: 10, letterSpacing: "-0.02em",
              }}>{f.title}</h4>
              <p style={{
                fontSize: 13.5, color: t.textMuted,
                lineHeight: 1.7,
              }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
};

// ─── SERVICES / SHOWCASE ───────────────────────────────────────
const Services = ({ t }) => {
  const services = [
    {
      icon: "📈",
      color: "#6366f1",
      title: "Revenue Analytics",
      desc: "Track total revenue, average order values, and growth trends across time periods and all four global regions.",
      queries: [
        "Monthly revenue by region for 2023",
        "Q3 vs Q4 revenue comparison",
        "Year-over-year growth rate",
      ],
    },
    {
      icon: "🏆",
      color: "#f59e0b",
      title: "Product Performance",
      desc: "Discover which categories drive your business and which products earn the strongest ratings across 50K transactions.",
      queries: [
        "Top categories by total revenue",
        "Rating vs review count correlation",
        "Best performing product segments",
      ],
    },
    {
      icon: "🌍",
      color: "#10b981",
      title: "Regional Intelligence",
      desc: "Break down sales behavior across North America, Asia, Europe, and the Middle East with precision.",
      queries: [
        "Region-wise revenue distribution",
        "Payment preferences by region",
        "Which region is growing fastest?",
      ],
    },
    {
      icon: "💰",
      color: "#ec4899",
      title: "Pricing & Discounts",
      desc: "Analyze the true impact of your discount strategy on revenue. See if you're winning customers or giving money away.",
      queries: [
        "Discount % vs revenue correlation",
        "Is our discount strategy working?",
        "Price elasticity by category",
      ],
    },
  ];

  return (
    <Section id="services" style={{
      padding: "120px 48px", background: t.bg,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <p style={{
            fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase",
            color: t.accent, fontWeight: 700, marginBottom: 14,
          }}>Services</p>
          <h2 style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.03em",
            color: t.text, lineHeight: 1.1,
          }}>
            What you can explore
          </h2>
          <p style={{
            fontSize: "1rem", color: t.textMuted, marginTop: 16,
            maxWidth: 480, margin: "16px auto 0",
          }}>
            Pre-loaded with 50,000 Amazon e-commerce transactions across 2022–2023.
            Six product categories. Four global regions.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 24,
        }} className="grid-mobile-1">
          {services.map((s, i) => (
            <div key={i} className="card-hover" style={{
              background: t.bgCard,
              borderRadius: 20,
              border: `1px solid ${t.border}`,
              padding: "36px",
              overflow: "hidden",
              position: "relative",
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = s.color + "50";
                e.currentTarget.style.boxShadow = `0 20px 60px ${s.color}12`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Background gradient accent */}
              <div style={{
                position: "absolute", top: -20, right: -20,
                width: 120, height: 120, borderRadius: "50%",
                background: `radial-gradient(circle, ${s.color}15 0%, transparent 70%)`,
                pointerEvents: "none",
              }} />

              <div style={{
                fontSize: 28, marginBottom: 20,
                width: 56, height: 56, borderRadius: 14,
                background: s.color + "15",
                border: `1px solid ${s.color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{s.icon}</div>

              <h3 style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 700,
                fontSize: "1.15rem", color: t.text,
                marginBottom: 12, letterSpacing: "-0.02em",
              }}>{s.title}</h3>

              <p style={{
                fontSize: 14, color: t.textMuted,
                lineHeight: 1.75, marginBottom: 24,
              }}>{s.desc}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {s.queries.map((q, j) => (
                  <div key={j} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 12.5, color: t.textMuted,
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: "6px 10px", borderRadius: 6,
                    background: s.color + "08",
                    border: `1px solid ${s.color}15`,
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = s.color + "18";
                      e.currentTarget.style.color = s.color;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = s.color + "08";
                      e.currentTarget.style.color = t.textMuted;
                    }}
                  >
                    <span style={{ color: s.color, fontSize: 14 }}>›</span>
                    "{q}"
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
};

// ─── DUAL MODE SHOWCASE ────────────────────────────────────────
const ModeShowcase = ({ t }) => (
  <Section style={{
    padding: "80px 48px", background: t.bg, overflow: "hidden",
  }}>
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Mode toggle preview */}
      <div style={{
        background: t.bgCard, borderRadius: 24,
        border: `1px solid ${t.border}`,
        padding: "48px", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* Glow */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: 400, height: 200,
          background: "radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <h3 style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 800,
          fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
          letterSpacing: "-0.03em", color: t.text,
          marginBottom: 16, position: "relative",
        }}>
          Two modes. One platform.
        </h3>
        <p style={{
          fontSize: 15, color: t.textMuted, maxWidth: 500,
          margin: "0 auto 40px", lineHeight: 1.7, position: "relative",
        }}>
          Switch seamlessly between chart generation and conversational analysis.
          Same data. Two powerful ways to understand it.
        </p>

        {/* Mode cards */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 16, maxWidth: 600, margin: "0 auto",
          position: "relative",
        }} className="grid-mobile-1">
          {[
            {
              icon: "📊", label: "Chart Mode", color: "#6366f1",
              desc: "Ask → Get 2 chart options → Pick the best → Follow up",
            },
            {
              icon: "💬", label: "Chat Mode", color: "#f59e0b",
              desc: "Ask → Get analyst narrative → Real numbers → Strategic insight",
            },
          ].map((m, i) => (
            <div key={i} style={{
              padding: "20px", borderRadius: 14,
              background: m.color + "10",
              border: `1px solid ${m.color}30`,
              textAlign: "left",
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{m.icon}</div>
              <div style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 700,
                fontSize: "1rem", color: t.text, marginBottom: 8,
              }}>{m.label}</div>
              <div style={{
                fontSize: 12.5, color: t.textMuted, lineHeight: 1.6,
              }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Section>
);

// ─── CTA SECTION ──────────────────────────────────────────────
const CTA = ({ t }) => (
  <Section id="cta" style={{
    padding: "120px 48px",
    background: t.bg,
    borderTop: `1px solid ${t.border}`,
  }}>
    {/* Noise texture overlay */}
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      background: `
        radial-gradient(ellipse 60% 60% at 50% 0%, ${t.accentGlow} 0%, transparent 70%),
        radial-gradient(ellipse 40% 40% at 80% 100%, rgba(245,158,11,0.05) 0%, transparent 70%)
      `,
    }} />

    <div style={{
      maxWidth: 680, margin: "0 auto",
      textAlign: "center", position: "relative", zIndex: 1,
    }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "6px 14px", borderRadius: 20,
        background: t.accentGlow, border: `1px solid ${t.accent}40`,
        marginBottom: 32,
      }}>
        <span style={{ fontSize: 12, color: t.accentLight, fontWeight: 600 }}>
          ✦ Built for decision makers
        </span>
      </div>

      <h2 style={{
        fontFamily: "'Syne', sans-serif", fontWeight: 800,
        fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
        letterSpacing: "-0.04em", color: t.text,
        lineHeight: 1.08, marginBottom: 20,
      }}>
        Ready to talk<br />
        <span className="gradient-text">to your data?</span>
      </h2>

      <p style={{
        fontSize: "1.05rem", color: t.textMuted, lineHeight: 1.7,
        marginBottom: 48, maxWidth: 440, margin: "0 auto 48px",
      }}>
        Sign in with Google and start asking questions in seconds.
        No setup. No SQL. No waiting.
      </p>

      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn-primary" style={{
          padding: "16px 40px", borderRadius: 14, cursor: "pointer",
          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
          border: "none", color: "#fff",
          fontFamily: "'Syne', sans-serif", fontWeight: 700,
          fontSize: "1.05rem", letterSpacing: "-0.01em",
          boxShadow: "0 8px 32px rgba(99,102,241,0.45), 0 0 60px rgba(99,102,241,0.15)",
          animation: "pulse-glow 3s ease-in-out infinite",
        }}>
          Get Started — It's Free
        </button>
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: t.textSubtle }}>
        Amazon Sales 2022–2023 · 50,000 transactions · Powered by Google Gemini
      </p>
    </div>
  </Section>
);

// ─── FOOTER ───────────────────────────────────────────────────
const Footer = ({ t }) => (
  <footer style={{
    padding: "40px 48px",
    borderTop: `1px solid ${t.border}`,
    background: t.bg,
  }}>
    <div style={{
      maxWidth: 1100, margin: "0 auto",
      display: "flex", justifyContent: "space-between",
      alignItems: "center", flexWrap: "wrap", gap: 16,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: "#fff",
        }}>N</div>
        <span style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 800,
          fontSize: "1rem", color: t.text, letterSpacing: "-0.02em",
        }}>
          Narra<span style={{ color: t.accent }}>lytics</span>
        </span>
      </div>

      {/* Links */}
      <div style={{ display: "flex", gap: 28 }} className="hide-mobile">
        {["Features", "How it Works", "Services", "GitHub"].map(l => (
          <a key={l} href="#" className="nav-link"
            style={{ fontSize: 13, color: t.textMuted }}
            onMouseEnter={e => e.target.style.color = t.accent}
            onMouseLeave={e => e.target.style.color = t.textMuted}
          >{l}</a>
        ))}
      </div>

      {/* Copyright */}
      <p style={{ fontSize: 12, color: t.textMuted }}>
        © 2024 Narralytics · Built with ♥ for Hackathon
      </p>
    </div>
  </footer>
);

// ─── ROOT APP COMPONENT ───────────────────────────────────────
export default function NarralyticsLanding() {
  const [isDark, setIsDark] = useState(true);
  const t = isDark ? DARK : LIGHT;

  return (
    <div style={{
      background:  t.bg,
      color:       t.text,
      minHeight:   "100vh",
      overflowX:   "hidden",
      transition:  "background 0.5s ease, color 0.5s ease",
      fontFamily:  "'Outfit', sans-serif",
    }}>
      {/* Inject global styles + fonts */}
      <GlobalStyles />

      {/* Navigation */}
      <NavBar isDark={isDark} onToggle={() => setIsDark(d => !d)} t={t} />

      {/* Page sections */}
      <Hero     isDark={isDark} t={t} />
      <HowItWorks              t={t} />
      <Features                t={t} />
      <Services                t={t} />
      <ModeShowcase            t={t} />
      <CTA                     t={t} />
      <Footer                  t={t} />
    </div>
  );
}

import React from 'react';

const Landing = () => {
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const handleGetStarted = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <header style={{ marginBottom: '4rem' }}>
        <h1 className="gradient-text" style={{ fontSize: '4rem', fontWeight: 800, marginBottom: '1rem' }}>Narralytics</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px' }}>
          Senior BI insights at your fingertips. Ask questions, get charts, and chat with your data in plain English.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', maxWidth: '1000px', marginBottom: '4rem' }}>
        <div className="glass" style={{ padding: '2rem', borderRadius: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>📊 Chart Mode</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Convert data questions into visual dual-chart specifications instantly.</p>
        </div>
        <div className="glass" style={{ padding: '2rem', borderRadius: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>💬 Chat Mode</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Narrative business answers backed by real-time SQL data execution.</p>
        </div>
        <div className="glass" style={{ padding: '2rem', borderRadius: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>📜 Full History</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Persistent DynamoDB history to track your insights across sessions.</p>
        </div>
      </div>

      <button 
        onClick={handleGetStarted}
        style={{
          background: 'var(--accent)',
          color: 'white',
          border: 'none',
          padding: '1rem 3rem',
          borderRadius: '2rem',
          fontSize: '1.1rem',
          fontWeight: 700,
          boxShadow: '0 0 20px var(--accent-glow)',
          transition: 'transform 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        Get Started
      </button>

      <footer style={{ marginTop: 'auto', paddingTop: '4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        Narralytics · AWS Lambda · Gemini · Built to win 🏆
      </footer>
    </div>
  );
};

export default Landing;

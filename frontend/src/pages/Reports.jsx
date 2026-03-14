import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

export default function Reports() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#05050f",
      color: "#f0f0fc",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      <header style={{
        padding: "20px 30px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
        gap: "20px"
      }}>
        <Link to="/dashboard" style={{
          display: "flex", alignItems: "center", gap: "8px",
          color: "#9898c8", textDecoration: "none", fontSize: "0.9rem"
        }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 500 }}>Report Builder</h1>
      </header>
      
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        textAlign: "center"
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: "rgba(245,166,35,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
          color: "#f5a623"
        }}>
          <FileText size={32} />
        </div>
        <h2 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: "2.5rem",
          fontWeight: 400,
          marginBottom: "16px",
        }}>PDF Export (Coming Soon)</h2>
        <p style={{
          color: "#9898c8",
          maxWidth: "500px",
          lineHeight: 1.6,
          fontSize: "1.1rem"
        }}>
          The automated report generator is currently under development. Soon you will select charts and instantly download a comprehensive business intelligence PDF.
        </p>
      </main>
    </div>
  );
}

import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Brain, ArrowRight } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { loginAsGuest, user } = useAuth();

  // Redirect if already logged in
  if (user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const handleGuestLogin = () => {
    loginAsGuest();
    navigate("/dashboard");
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#05050f",
      color: "#f0f0fc",
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{
        background: "#0c0c1e",
        padding: "40px",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 12px 60px rgba(0,0,0,0.6)",
        textAlign: "center",
        maxWidth: "400px",
        width: "100%"
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: "#5b6af9",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
          boxShadow: "0 0 20px rgba(91,106,249,0.3)"
        }}>
          <Brain size={24} color="#fff" />
        </div>
        
        <h2 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: "2rem",
          fontWeight: 400,
          marginBottom: "8px",
          letterSpacing: "-0.02em"
        }}>
          Welcome to Narralytics
        </h2>
        <p style={{
          color: "#9898c8",
          fontSize: "0.95rem",
          marginBottom: "32px",
          lineHeight: 1.6
        }}>
          Sign in to your account or continue as a guest to explore the platform.
        </p>

        <button 
          disabled
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "16px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#55557a",
            borderRadius: "10px",
            fontSize: "0.95rem",
            fontWeight: 500,
            cursor: "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          Google Sign-In (Coming Soon)
        </button>

        <div style={{
          display: "flex",
          alignItems: "center",
          margin: "20px 0",
          color: "#55557a",
          fontSize: "0.85rem"
        }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          <span style={{ padding: "0 12px" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
        </div>

        <button 
          onClick={handleGuestLogin}
          style={{
            width: "100%",
            padding: "12px",
            background: "#5b6af9",
            border: "none",
            color: "#fff",
            borderRadius: "10px",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 4px 20px rgba(91,106,249,0.28)",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          Continue as Guest <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

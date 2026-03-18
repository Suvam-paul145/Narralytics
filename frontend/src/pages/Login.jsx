import React from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Brain, ArrowRight, AlertCircle } from "lucide-react";
import API_BASE_URL from "../config/api";

export default function Login() {
  const navigate = useNavigate();
  const { loginAsGuest, user } = useAuth();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  
  React.useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  if (user) return null;

  const handleGoogleLogin = () => {
    const frontendOrigin = window.location.origin;
    // Redirect to backend OAuth endpoint with explicit return origin
    window.location.href = `${API_BASE_URL}/auth/google?redirect=${encodeURIComponent(frontendOrigin)}`;
  };

  const handleGuestLogin = () => {
    loginAsGuest();
    navigate("/dashboard");
  };

  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth_failed':
        return 'Authentication failed. Please try again.';
      case 'no_token':
        return 'Authentication incomplete. Please try again.';
      default:
        return null;
    }
  };

  const errorMessage = getErrorMessage(error);

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
        boxShadow: "0 12px 60px rgba(0,0,0,0.6)",
        textAlign: "center",
        maxWidth: "400px",
        width: "100%"
      }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "#5b6af9",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px",
            boxShadow: "0 0 20px rgba(91,106,249,0.3)",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <Brain size={24} color="#fff" />
          </div>
        </Link>
        
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

        {errorMessage && (
          <div style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#fca5a5"
          }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: "0.9rem" }}>{errorMessage}</span>
          </div>
        )}

        <button 
          onClick={handleGoogleLogin}
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "16px",
            background: "#fff",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#333",
            borderRadius: "10px",
            fontSize: "0.95rem",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.2s",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
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

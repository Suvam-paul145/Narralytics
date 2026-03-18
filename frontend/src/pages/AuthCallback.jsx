import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { fetchUserInfo } = useAuth();

  useEffect(() => {
    const hash = window.location.hash || "";
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const queryParams = new URLSearchParams(window.location.search || "");

    // Support token in either hash or query for compatibility.
    const token = hashParams.get("token") || queryParams.get("token");

    if (token) {
      localStorage.setItem('authToken', token);
      fetchUserInfo(token)
        .then(() => {
          navigate("/dashboard", { replace: true });
        })
        .catch(() => {
          navigate("/login?error=auth_failed", { replace: true });
        });
      return;
    }

    if (queryParams.get('auth_error')) {
      const errorMsg = queryParams.get('error_msg');
      const suffix = errorMsg ? `&error_msg=${encodeURIComponent(errorMsg)}` : "";
      navigate(`/login?error=auth_failed${suffix}`, { replace: true });
      return;
    }

    navigate("/login?error=no_token", { replace: true });
  }, [navigate, fetchUserInfo]);

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
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: "3px solid #5b6af9",
          borderTop: "3px solid transparent",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          margin: "0 auto 16px"
        }} />
        <p>Completing sign-in...</p>
      </div>
    </div>
  );
}
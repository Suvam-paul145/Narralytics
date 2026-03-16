import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { fetchUserInfo } = useAuth();

  useEffect(() => {
    // Extract token from URL hash
    const hash = window.location.hash;
    if (hash.includes('token=')) {
      const token = hash.split('token=')[1].split('&')[0]; // Handle potential additional params
      if (token) {
        // Store the token
        localStorage.setItem('authToken', token);
        // Fetch user info and update context
        fetchUserInfo(token).then(() => {
          // Redirect to dashboard
          navigate("/dashboard", { replace: true });
        });
      } else {
        // No token found, redirect to login with error
        navigate("/login?error=no_token", { replace: true });
      }
    } else {
      // Check for error parameter
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('auth_error')) {
        navigate("/login?error=auth_failed", { replace: true });
      } else {
        // No token or error, redirect to login
        navigate("/login", { replace: true });
      }
    }
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
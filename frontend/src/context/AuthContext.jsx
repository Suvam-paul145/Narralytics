import React, { createContext, useContext, useState, useEffect } from "react";
import { API_ENDPOINTS } from "../config/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for OAuth token first
    const token = localStorage.getItem("authToken");
    if (token) {
      // Verify token and get user info
      fetchUserInfo(token);
    } else {
      // Check local storage for guest session
      try {
        const guestUser = localStorage.getItem("guestUser");
        if (guestUser && guestUser !== "undefined") {
          setUser(JSON.parse(guestUser));
        }
      } catch (err) {
        console.error("Failed to parse guestUser from localStorage", err);
        localStorage.removeItem("guestUser");
      } finally {
        setLoading(false);
      }
    }
  }, []);

  const fetchUserInfo = async (token) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.AUTH}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser({
          ...userData,
          role: 'oauth',
          isAuthenticated: true
        });
      } else {
        // Token is invalid, remove it
        localStorage.removeItem("authToken");
      }
    } catch (error) {
      console.error("Failed to fetch user info:", error);
      localStorage.removeItem("authToken");
    } finally {
      setLoading(false);
    }
  };

  const loginAsGuest = () => {
    const guestData = { id: "guest", name: "Guest User", role: "guest", isAuthenticated: false };
    localStorage.setItem("guestUser", JSON.stringify(guestData));
    setUser(guestData);
  };

  const logout = () => {
    localStorage.removeItem("guestUser");
    localStorage.removeItem("authToken");
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#05050f",
        color: "#f0f0fc"
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
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loginAsGuest, logout, fetchUserInfo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

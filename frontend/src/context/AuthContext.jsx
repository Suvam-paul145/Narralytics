import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for guest session on load
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
  }, []);


  const loginAsGuest = () => {
    const guestData = { id: "guest", name: "Guest User", role: "guest" };
    localStorage.setItem("guestUser", JSON.stringify(guestData));
    setUser(guestData);
  };

  const logout = () => {
    localStorage.removeItem("guestUser");
    setUser(null);
  };

  if (loading) return null; // Or a loading spinner

  return (
    <AuthContext.Provider value={{ user, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

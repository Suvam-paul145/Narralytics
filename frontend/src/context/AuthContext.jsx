import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(sessionStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      sessionStorage.setItem('token', token);
      // In a real app, fetch user info from /auth/me here
      // For now, we'll decode the JWT or set a mock user
    } else {
      sessionStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  const logout = () => {
    setToken(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

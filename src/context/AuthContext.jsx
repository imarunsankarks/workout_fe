import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check for saved user and token on initial load
    const savedUser = localStorage.getItem('workoutUser');
    const savedToken = localStorage.getItem('workoutToken');
    
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
    setLoading(false);
  }, []);

  // 2. Updated login to accept both user info and the JWT token
  const login = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('workoutUser', JSON.stringify(userData));
    localStorage.setItem('workoutToken', userToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('workoutUser');
    localStorage.removeItem('workoutToken');
    // Clear any active session markers to prevent data leak between users
    localStorage.removeItem('active_session_exercises');
    localStorage.removeItem('active_session_seconds');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      loading,
      isAuthenticated: !!token // Quick helper to check login status
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
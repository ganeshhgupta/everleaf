import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Configure axios defaults
  axios.defaults.baseURL = 'http://localhost:5000/api';

  console.log('🔍 Axios baseURL set to:', axios.defaults.baseURL);
  console.log('🔍 Environment variable:', process.env.REACT_APP_API_URL);

  useEffect(() => {
    const token = Cookies.get('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    try {
      const response = await axios.get('/auth/verify');
      setUser(response.data.user);
    } catch (error) {
      console.error('Token verification failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, isAdmin = false) => {
    try {
      const endpoint = isAdmin ? '/auth/admin/login' : '/auth/login';
      const response = await axios.post(endpoint, { email, password });
      
      const { token, user: userData } = response.data;
      
      // Set token in cookies and axios headers
      Cookies.set('token', token, { expires: 7 }); // 7 days
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const signup = async (userData) => {
    try {
      const response = await axios.post('/auth/signup', userData);
      const { token, user: newUser } = response.data;
      
      // Set token in cookies and axios headers
      Cookies.set('token', token, { expires: 7 });
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(newUser);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Signup failed' 
      };
    }
  };

  const logout = () => {
    Cookies.remove('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const forgotPassword = async (email) => {
    try {
      await axios.post('/auth/forgot-password', { email });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to send reset email' 
      };
    }
  };

  const resetPassword = async (token, password) => {
    try {
      await axios.post('/auth/reset-password', { token, password });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to reset password' 
      };
    }
  };

  const googleLogin = async (credential) => {
    try {
      const response = await axios.post('/auth/google', { credential });
      const { token, user: userData } = response.data;
      
      Cookies.set('token', token, { expires: 7 });
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Google login failed' 
      };
    }
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    forgotPassword,
    resetPassword,
    googleLogin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
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
  const [error, setError] = useState(null);

  // Create a dedicated axios instance instead of using defaults
  const api = axios.create({
    baseURL: `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`,
    timeout: 15000, // 15 second timeout to handle Render cold starts
    headers: {
      'Content-Type': 'application/json',
    },
  });

  console.log('🔍 Axios baseURL set to:', api.defaults.baseURL);
  console.log('🔍 Environment variable:', process.env.REACT_APP_API_URL);

  // Request interceptor to add auth token
  api.interceptors.request.use(
    (config) => {
      const token = Cookies.get('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for error handling
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNABORTED') {
        console.error('Request timeout - server may be sleeping (Render cold start)');
        setError('Server is starting up, please wait a moment and try again...');
      } else if (error.response?.status === 401) {
        console.log('Token invalid, clearing auth state');
        logout();
      } else if (!error.response) {
        console.error('Network error - server may be down');
        setError('Unable to connect to server. Please check your connection.');
      }
      return Promise.reject(error);
    }
  );

  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      const token = Cookies.get('token');
      if (token && mounted) {
        await verifyToken();
      } else if (mounted) {
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []); // Only run once on mount

  const verifyToken = async () => {
    try {
      setError(null); // Clear any previous errors
      const response = await api.get('/auth/verify');
      
      if (response.data.success) {
        setUser(response.data.user);
        console.log('Token verified successfully');
      } else {
        throw new Error('Token verification failed');
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      
      // Handle different error types
      if (error.code === 'ECONNABORTED') {
        setError('Server is starting up, please wait...');
        // Don't logout on timeout - server might just be cold starting
      } else if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
        logout();
      } else if (!error.response) {
        setError('Unable to connect to server. Please check your connection.');
        // Don't logout on network error - might be temporary
      } else {
        setError('Authentication failed. Please try logging in again.');
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, isAdmin = false) => {
    try {
      setError(null);
      setLoading(true);
      
      const endpoint = isAdmin ? '/auth/admin/login' : '/auth/login';
      const response = await api.post(endpoint, { email, password });
      
      const { token, user: userData } = response.data;
      
      // Set token in cookies
      Cookies.set('token', token, { expires: 7 }); // 7 days
      setUser(userData);
      
      console.log('Login successful');
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Server is starting up, please wait a moment and try again...';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (!error.response) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      }
      
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (userData) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await api.post('/auth/signup', userData);
      const { token, user: newUser } = response.data;
      
      // Set token in cookies
      Cookies.set('token', token, { expires: 7 });
      setUser(newUser);
      
      console.log('Signup successful');
      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      
      let errorMessage = 'Signup failed. Please try again.';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Server is starting up, please wait a moment and try again...';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (!error.response) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      }
      
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    Cookies.remove('token');
    setUser(null);
    setError(null);
    console.log('User logged out');
  };

  const forgotPassword = async (email) => {
    try {
      setError(null);
      await api.post('/auth/forgot-password', { email });
      return { success: true };
    } catch (error) {
      let errorMessage = 'Failed to send reset email';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Server is starting up, please wait a moment and try again...';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (!error.response) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      }
      
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const resetPassword = async (token, password) => {
    try {
      setError(null);
      await api.post('/auth/reset-password', { token, password });
      return { success: true };
    } catch (error) {
      let errorMessage = 'Failed to reset password';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Server is starting up, please wait a moment and try again...';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (!error.response) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      }
      
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const googleLogin = async (credential) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await api.post('/auth/google', { credential });
      const { token, user: userData } = response.data;
      
      Cookies.set('token', token, { expires: 7 });
      setUser(userData);
      
      console.log('Google login successful');
      return { success: true };
    } catch (error) {
      console.error('Google login error:', error);
      
      let errorMessage = 'Google login failed';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Server is starting up, please wait a moment and try again...';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (!error.response) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      }
      
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Function to retry connection (useful for UI)
  const retryConnection = async () => {
    if (Cookies.get('token')) {
      setLoading(true);
      await verifyToken();
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    signup,
    logout,
    forgotPassword,
    resetPassword,
    googleLogin,
    retryConnection,
    api // Export api instance for use in other components
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
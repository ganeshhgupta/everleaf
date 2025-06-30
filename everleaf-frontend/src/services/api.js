// In your existing src/services/api.js file, make sure you have this structure:

import axios from 'axios';

// Configure axios with base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    
    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401) {
      // Token might be expired or invalid
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Project API functions - MAKE SURE THIS EXISTS
export const projectAPI = {
  // Create a new project
  createProject: async (projectData) => {
    const response = await api.post('/projects', projectData);
    return response.data;
  },

  // Get user's owned projects
  getMyProjects: async (page = 1, limit = 20) => {
    const response = await api.get('/projects/my-projects', {
      params: { page, limit }
    });
    return response.data;
  },

  // Get projects where user is a collaborator
  getCollaboratedProjects: async (page = 1, limit = 20) => {
    const response = await api.get('/projects/collaborated', {
      params: { page, limit }
    });
    return response.data;
  },

  // Get a specific project by ID
  getProject: async (projectId) => {
    const response = await api.get(`/projects/${projectId}`);
    return response.data;
  },

  // Update a project
  updateProject: async (projectId, updates) => {
    const response = await api.put(`/projects/${projectId}`, updates);
    return response.data;
  },

  // Delete a project
  deleteProject: async (projectId) => {
    const response = await api.delete(`/projects/${projectId}`);
    return response.data;
  },

  // Clone a project
  cloneProject: async (projectId, title) => {
    const response = await api.post(`/projects/${projectId}/clone`, { title });
    return response.data;
  },

  // Search projects
  searchProjects: async (query, page = 1, limit = 20) => {
    const response = await api.get('/projects/search', {
      params: { query, page, limit }
    });
    return response.data;
  },

  // Get public projects/templates
  getPublicProjects: async (category = null, page = 1, limit = 20) => {
    const response = await api.get('/projects/public', {
      params: { category, page, limit }
    });
    return response.data;
  },

  // Collaborator management
  getCollaborators: async (projectId) => {
    const response = await api.get(`/projects/${projectId}/collaborators`);
    return response.data;
  },

  addCollaborator: async (projectId, email, permission = 'edit') => {
    const response = await api.post(`/projects/${projectId}/collaborators`, {
      email,
      permission
    });
    return response.data;
  },

  removeCollaborator: async (projectId, collaboratorId) => {
    const response = await api.delete(`/projects/${projectId}/collaborators/${collaboratorId}`);
    return response.data;
  },

  acceptCollaboration: async (projectId) => {
    const response = await api.post(`/projects/${projectId}/accept`);
    return response.data;
  },

  // Get project activity
  getProjectActivity: async (projectId, limit = 50) => {
    const response = await api.get(`/projects/${projectId}/activity`, {
      params: { limit }
    });
    return response.data;
  }
};

// User API functions
export const userAPI = {
  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/users/profile', profileData);
    return response.data;
  }
};

// Auth API functions (if needed beyond AuthContext)
export const authAPI = {
  verifyToken: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  }
};

// Document management functions - ADD THIS NEW SECTION
export const documentAPI = {
  // Upload documents (files)
  uploadDocuments: async (projectId, files) => {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('documents', file);
    });

    const response = await api.post(`/documents/${projectId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Upload documents from URLs
  uploadDocumentsFromUrls: async (projectId, urls) => {
    const response = await api.post(`/documents/${projectId}/upload-urls`, { urls });
    return response.data;
  },

  // Get project documents
  getProjectDocuments: async (projectId) => {
    const response = await api.get(`/documents/${projectId}`);
    return response.data;
  },

  // Delete document
  deleteDocument: async (projectId, documentId) => {
    const response = await api.delete(`/documents/${projectId}/${documentId}`);
    return response.data;
  },

  // Reprocess document
  reprocessDocument: async (projectId, documentId) => {
    const response = await api.post(`/documents/${projectId}/${documentId}/reprocess`);
    return response.data;
  }
};

// Export the axios instance for custom requests
export default api;
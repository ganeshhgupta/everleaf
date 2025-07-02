import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

/**
 * Collaborator Component - Handles all collaboration functionality
 * This component manages:
 * - Loading collaborators
 * - Sharing projects via email
 * - Creating/managing shareable links
 * - Collaborator permissions
 */
const Collaborator = ({ 
  projectId, 
  project,
  onCollaboratorsChange,
  children 
}) => {
  const { api } = useAuth();
  
  // Collaboration state
  const [collaborators, setCollaborators] = useState([]);
  const [shareLink, setShareLink] = useState(null);
  const [shareLinkPermission, setShareLinkPermission] = useState('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load collaborators from API
  const loadCollaborators = async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/projects/${projectId}/collaborators`);
      
      if (response.data.success) {
        const collaboratorList = response.data.collaborators || [];
        setCollaborators(collaboratorList);
        
        // Notify parent component
        if (onCollaboratorsChange) {
          onCollaboratorsChange(collaboratorList);
        }
        
        console.log(`✅ Loaded ${collaboratorList.length} collaborators`);
      } else {
        throw new Error(response.data.message || 'Failed to load collaborators');
      }
    } catch (err) {
      console.error('❌ Failed to load collaborators:', err);
      setError(err.message);
      setCollaborators([]);
      
      if (onCollaboratorsChange) {
        onCollaboratorsChange([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load existing share link
  const loadShareLink = async () => {
    if (!projectId) return;
    
    try {
      const response = await api.get(`/projects/${projectId}/share-link`);
      
      if (response.data.success && response.data.shareLink) {
        setShareLink(response.data.shareLink);
        setShareLinkPermission(response.data.permission || 'view');
        console.log('✅ Loaded existing share link');
      } else {
        setShareLink(null);
        console.log('ℹ️ No existing share link');
      }
    } catch (err) {
      console.error('❌ Failed to load share link:', err);
      setShareLink(null);
    }
  };

  // Share project via email invitations
  const shareProject = async (emails, permission = 'edit') => {
    if (!projectId || !emails || emails.length === 0) {
      throw new Error('Project ID and emails are required');
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('📧 Sharing project with:', emails, 'permission:', permission);
      
      const response = await api.post(`/projects/${projectId}/share`, {
        emails,
        permission
      });
      
      if (response.data.success) {
        // Refresh collaborators list
        await loadCollaborators();
        
        const results = response.data.results;
        console.log('✅ Project shared successfully:', results);
        
        return {
          success: true,
          message: response.data.message,
          results: results
        };
      } else {
        throw new Error(response.data.message || 'Failed to share project');
      }
    } catch (err) {
      console.error('❌ Share project error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Create shareable link
  const createShareLink = async (permission = 'view') => {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🔗 Creating share link with permission:', permission);
      
      const response = await api.post(`/projects/${projectId}/share-link`, {
        permission
      });
      
      if (response.data.success) {
        const newShareLink = response.data.shareLink;
        setShareLink(newShareLink);
        setShareLinkPermission(permission);
        
        console.log('✅ Share link created:', newShareLink);
        
        return newShareLink;
      } else {
        throw new Error(response.data.message || 'Failed to create share link');
      }
    } catch (err) {
      console.error('❌ Create share link error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Disable share link
  const disableShareLink = async () => {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🚫 Disabling share link');
      
      const response = await api.delete(`/projects/${projectId}/share-link`);
      
      if (response.data.success) {
        setShareLink(null);
        setShareLinkPermission('view');
        
        console.log('✅ Share link disabled');
        
        return true;
      } else {
        throw new Error(response.data.message || 'Failed to disable share link');
      }
    } catch (err) {
      console.error('❌ Disable share link error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Add individual collaborator
  const addCollaborator = async (email, permission = 'edit') => {
    if (!projectId || !email) {
      throw new Error('Project ID and email are required');
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('➕ Adding collaborator:', email, 'with permission:', permission);
      
      const response = await api.post(`/projects/${projectId}/collaborators`, {
        email,
        permission
      });
      
      if (response.data.success) {
        // Refresh collaborators list
        await loadCollaborators();
        
        console.log('✅ Collaborator added successfully');
        
        return response.data.collaboration;
      } else {
        throw new Error(response.data.message || 'Failed to add collaborator');
      }
    } catch (err) {
      console.error('❌ Add collaborator error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Remove collaborator
  const removeCollaborator = async (collaboratorId) => {
    if (!projectId || !collaboratorId) {
      throw new Error('Project ID and collaborator ID are required');
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('➖ Removing collaborator:', collaboratorId);
      
      const response = await api.delete(`/projects/${projectId}/collaborators/${collaboratorId}`);
      
      if (response.data.success) {
        // Refresh collaborators list
        await loadCollaborators();
        
        console.log('✅ Collaborator removed successfully');
        
        return true;
      } else {
        throw new Error(response.data.message || 'Failed to remove collaborator');
      }
    } catch (err) {
      console.error('❌ Remove collaborator error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get project access level for current user
  const getAccessLevel = () => {
    if (!project) return null;
    return project.accessLevel || 'view';
  };

  // Check if current user can manage collaborators
  const canManageCollaborators = () => {
    const accessLevel = getAccessLevel();
    return accessLevel === 'owner' || accessLevel === 'admin';
  };

  // Load data when component mounts or projectId changes
  useEffect(() => {
    if (projectId && project) {
      console.log('🔄 Loading collaboration data for project:', projectId);
      loadCollaborators();
      loadShareLink();
    }
  }, [projectId, project]);

  // Prepare collaboration context/props for child components
  const collaborationProps = {
    // Data
    collaborators,
    shareLink,
    shareLinkPermission,
    loading,
    error,
    
    // Permissions
    canManageCollaborators: canManageCollaborators(),
    accessLevel: getAccessLevel(),
    
    // Actions
    shareProject,
    createShareLink,
    disableShareLink,
    addCollaborator,
    removeCollaborator,
    loadCollaborators,
    loadShareLink,
    
    // Utilities
    refresh: () => {
      loadCollaborators();
      loadShareLink();
    }
  };

  // Render children with collaboration props
  if (typeof children === 'function') {
    return children(collaborationProps);
  }

  // Clone children and pass collaboration props
  return React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        ...child.props,
        collaborationProps
      });
    }
    return child;
  });
};

export default Collaborator;
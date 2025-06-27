const Project = require('../models/Project');
const User = require('../models/User');
const { logActivity } = require('../utils/activityLogger');

// Create a new project
const createProject = async (req, res) => {
  try {
    const { title, description, content, latexContent, isTemplate, templateCategory } = req.body;
    
    const project = await Project.create({
      title,
      description,
      content,
      latexContent,
      ownerId: req.user.id,
      isTemplate,
      templateCategory
    });

    // Log activity
    await logActivity(req.user.id, project.id, 'project_created', {
      projectTitle: title
    }, req.ip, req.get('User-Agent'));

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create project'
    });
  }
};

// Get user's projects
const getUserProjects = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const projects = await Project.getUserProjects(req.user.id, limit, offset);

    res.json({
      success: true,
      projects,
      pagination: {
        page,
        limit,
        hasMore: projects.length === limit
      }
    });

  } catch (error) {
    console.error('Get user projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get projects'
    });
  }
};

// Get collaborated projects
const getCollaboratedProjects = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const projects = await Project.getCollaboratedProjects(req.user.id, limit, offset);

    res.json({
      success: true,
      projects,
      pagination: {
        page,
        limit,
        hasMore: projects.length === limit
      }
    });

  } catch (error) {
    console.error('Get collaborated projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get collaborated projects'
    });
  }
};

// Get project by ID
const getProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Check access permission
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this project'
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get collaborators if user has access
    let collaborators = [];
    if (accessLevel !== 'view' || project.owner_id === req.user.id) {
      collaborators = await Project.getCollaborators(projectId);
    }

    // Log activity
    await logActivity(req.user.id, projectId, 'project_viewed', null, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      project: {
        ...project,
        accessLevel,
        collaborators
      }
    });

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get project'
    });
  }
};

// Update project
const updateProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Check if user has edit access
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel || accessLevel === 'view') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this project'
      });
    }

    const updates = req.body;
    const updatedProject = await Project.update(projectId, updates, req.user.id);

    if (!updatedProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Log activity
    await logActivity(req.user.id, projectId, 'project_updated', {
      updatedFields: Object.keys(updates)
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Project updated successfully',
      project: updatedProject
    });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update project'
    });
  }
};

// Delete project
const deleteProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    
    const deletedProject = await Project.delete(projectId, req.user.id);

    if (!deletedProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or you do not have permission to delete it'
      });
    }

    // Log activity
    await logActivity(req.user.id, null, 'project_deleted', {
      projectTitle: deletedProject.title,
      projectId: projectId
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete project'
    });
  }
};

// Add collaborator to project
const addCollaborator = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { email, permission = 'edit' } = req.body;

    // Check if user is project owner or admin
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (accessLevel !== 'owner' && accessLevel !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only project owners and admins can add collaborators'
      });
    }

    // Find user by email
    const collaborator = await User.findByEmail(email);
    if (!collaborator) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email address'
      });
    }

    // Check if user is trying to add themselves
    if (collaborator.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot add yourself as a collaborator'
      });
    }

    const collaboration = await Project.addCollaborator(
      projectId, 
      collaborator.id, 
      req.user.id, 
      permission
    );

    // Log activity
    await logActivity(req.user.id, projectId, 'collaborator_added', {
      collaboratorEmail: email,
      permission
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Collaborator added successfully',
      collaboration: {
        ...collaboration,
        user: {
          id: collaborator.id,
          firstName: collaborator.first_name,
          lastName: collaborator.last_name,
          email: collaborator.email,
          avatarUrl: collaborator.avatar_url
        }
      }
    });

  } catch (error) {
    console.error('Add collaborator error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add collaborator'
    });
  }
};

// Accept collaboration invitation
const acceptCollaboration = async (req, res) => {
  try {
    const projectId = req.params.id;
    
    const collaboration = await Project.acceptCollaboration(projectId, req.user.id);

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration invitation not found'
      });
    }

    // Log activity
    await logActivity(req.user.id, projectId, 'collaboration_accepted', null, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Collaboration invitation accepted',
      collaboration
    });

  } catch (error) {
    console.error('Accept collaboration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept collaboration'
    });
  }
};

// Remove collaborator
const removeCollaborator = async (req, res) => {
  try {
    const projectId = req.params.id;
    const collaboratorId = req.params.collaboratorId;

    const removedCollaborator = await Project.removeCollaborator(projectId, collaboratorId, req.user.id);

    if (!removedCollaborator) {
      return res.status(404).json({
        success: false,
        message: 'Collaborator not found or access denied'
      });
    }

    // Log activity
    await logActivity(req.user.id, projectId, 'collaborator_removed', {
      collaboratorId
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Collaborator removed successfully'
    });

  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove collaborator'
    });
  }
};

// Get project collaborators
const getCollaborators = async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Check access permission
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this project'
      });
    }

    const collaborators = await Project.getCollaborators(projectId);

    res.json({
      success: true,
      collaborators
    });

  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get collaborators'
    });
  }
};

// Get public projects/templates
const getPublicProjects = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category;
    const offset = (page - 1) * limit;

    const projects = await Project.getPublicProjects(category, limit, offset);

    res.json({
      success: true,
      projects,
      pagination: {
        page,
        limit,
        hasMore: projects.length === limit
      }
    });

  } catch (error) {
    console.error('Get public projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get public projects'
    });
  }
};

// Clone project (from template)
const cloneProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { title } = req.body;

    // Check if project exists and is accessible
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this project'
      });
    }

    const clonedProject = await Project.clone(projectId, req.user.id, title);

    // Log activity
    await logActivity(req.user.id, clonedProject.id, 'project_cloned', {
      originalProjectId: projectId,
      newTitle: title
    }, req.ip, req.get('User-Agent'));

    res.status(201).json({
      success: true,
      message: 'Project cloned successfully',
      project: clonedProject
    });

  } catch (error) {
    console.error('Clone project error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to clone project'
    });
  }
};

// Search projects
const searchProjects = async (req, res) => {
  try {
    const { query } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const projects = await Project.search(query.trim(), req.user.id, limit, offset);

    res.json({
      success: true,
      projects,
      pagination: {
        page,
        limit,
        hasMore: projects.length === limit
      }
    });

  } catch (error) {
    console.error('Search projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search projects'
    });
  }
};

// Get project activity/history
const getProjectActivity = async (req, res) => {
  try {
    const projectId = req.params.id;
    const limit = parseInt(req.query.limit) || 50;

    // Check access permission
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this project'
      });
    }

    const activity = await Project.getActivity(projectId, limit);

    res.json({
      success: true,
      activity
    });

  } catch (error) {
    console.error('Get project activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get project activity'
    });
  }
};

module.exports = {
  createProject,
  getUserProjects,
  getCollaboratedProjects,
  getProject,
  updateProject,
  deleteProject,
  addCollaborator,
  acceptCollaboration,
  removeCollaborator,
  getCollaborators,
  getPublicProjects,
  cloneProject,
  searchProjects,
  getProjectActivity
};
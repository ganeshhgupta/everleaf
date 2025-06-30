// utils/projectUtils.js

export const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now - date;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  if (diffInHours < 1) return '1 hour ago';
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  if (diffInDays === 1) return '1 day ago';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks === 1) return '1 week ago';
  if (diffInWeeks < 4) return `${diffInWeeks} weeks ago`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths === 1) return '1 month ago';
  if (diffInMonths < 12) return `${diffInMonths} months ago`;
  
  return date.toLocaleDateString();
};

export const getProjectTypeIcon = (type) => {
  switch (type) {
    case 'research':
      return '📄';
    case 'thesis':
      return '📚';
    case 'presentation':
      return '📊';
    case 'report':
      return '📈';
    default:
      return '📝';
  }
};

export const getCollaboratorText = (count) => {
  if (count === 0) return '';
  if (count === 1) return '1 collaborator';
  return `${count} collaborators`;
};

export const generateDefaultProjectTitle = () => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
  return `New_Project_${month}_${day}_${year}`;
};

export const validateProjectData = (projectData) => {
  const errors = {};
  
  if (!projectData.title || projectData.title.trim().length === 0) {
    errors.title = 'Project title is required';
  } else if (projectData.title.length > 255) {
    errors.title = 'Project title must be less than 255 characters';
  }
  
  if (projectData.description && projectData.description.length > 1000) {
    errors.description = 'Project description must be less than 1000 characters';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const sortProjectsByDate = (projects, direction = 'desc') => {
  return [...projects].sort((a, b) => {
    const dateA = new Date(a.updated_at);
    const dateB = new Date(b.updated_at);
    
    if (direction === 'desc') {
      return dateB - dateA;
    } else {
      return dateA - dateB;
    }
  });
};

export const filterProjectsBySearch = (projects, searchTerm) => {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return projects;
  }
  
  const term = searchTerm.toLowerCase().trim();
  
  return projects.filter(project => 
    project.title.toLowerCase().includes(term) ||
    (project.description && project.description.toLowerCase().includes(term)) ||
    (project.owner_first_name && project.owner_first_name.toLowerCase().includes(term)) ||
    (project.owner_last_name && project.owner_last_name.toLowerCase().includes(term))
  );
};

export const getProjectAccessLevel = (project, currentUserId) => {
  if (project.owner_id === currentUserId) {
    return 'owner';
  }
  
  if (project.access_level) {
    return project.access_level;
  }
  
  return 'view';
};

export const canEditProject = (project, currentUserId) => {
  const accessLevel = getProjectAccessLevel(project, currentUserId);
  return accessLevel === 'owner' || accessLevel === 'edit' || accessLevel === 'admin';
};

export const canDeleteProject = (project, currentUserId) => {
  return project.owner_id === currentUserId;
};
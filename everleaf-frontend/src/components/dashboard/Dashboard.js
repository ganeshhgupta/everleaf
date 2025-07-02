import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { downloadTeX, downloadPDF } from '../../utils/latexUtils';
import {
  DocumentTextIcon,
  PlusIcon,
  FolderIcon,
  ClockIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { user, logout, api } = useAuth(); // Get api instance from AuthContext
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState([]);
  const [collaboratedProjects, setCollaboratedProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, project: null });
  const [specialGreeting, setSpecialGreeting] = useState(false);

  // Check for special user greeting
  useEffect(() => {
    checkSpecialUser();
  }, [user]);

  const checkSpecialUser = async () => {
    try {
      if (!user?.email) {
        return;
      }

      // Check frontend env var
      const frontendSpecialEmail = process.env.REACT_APP_CHH_CHH;
      
      if (frontendSpecialEmail && user.email.trim().toLowerCase() === frontendSpecialEmail.trim().toLowerCase()) {
        setSpecialGreeting(true);
        return;
      }

      // If no match, try API call as backup
      try {
        const response = await api.get('/users/check-special', {
          params: { email: user.email }
        });
        
        if (response.data.isSpecial) {
          setSpecialGreeting(true);
        }
      } catch (apiError) {
        // API call failed, continue without backend check
      }
    } catch (error) {
      console.error('Special user check failed:', error);
    }
  };

  // Load projects on component mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Loading projects...');

      const [myProjectsResponse, collaboratedResponse] = await Promise.all([
        api.get('/projects/my-projects', { params: { page: 1, limit: 10 } }),
        api.get('/projects/collaborated', { params: { page: 1, limit: 5 } })
      ]);

      console.log('📊 My projects response:', myProjectsResponse.data);
      console.log('📊 Collaborated projects response:', collaboratedResponse.data);

      setProjects(myProjectsResponse.data.projects || []);
      setCollaboratedProjects(collaboratedResponse.data.projects || []);
      
      console.log('✅ Projects loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load projects:', error);
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateUniqueTitle = (baseTitle, existingProjects) => {
    const existingTitles = existingProjects.map(p => p.title);
    
    if (!existingTitles.includes(baseTitle)) {
      return baseTitle;
    }
    
    let counter = 2;
    let newTitle = `${baseTitle} (${counter})`;
    
    while (existingTitles.includes(newTitle)) {
      counter++;
      newTitle = `${baseTitle} (${counter})`;
    }
    
    return newTitle;
  };

  const handleLogout = () => {
    logout();
  };

  // Handle "New Project" and "Create Project" buttons - simple content with special greeting
  const handleCreateProject = async () => {
    try {
      setCreating(true);
      
      const baseTitle = `New Project ${new Date().toLocaleDateString()}`;
      const uniqueTitle = generateUniqueTitle(baseTitle, [...projects, ...collaboratedProjects]);
      
      // Set simple content with conditional greeting
      const greeting = specialGreeting ? 'Chh Chh..' : 'Hello Hello Hello :)';
      const simpleContent = `\\documentclass{article}
\\begin{document}
${greeting}
\\end{document}`;
      
      const projectData = {
        title: uniqueTitle,
        description: '',
        content: simpleContent,
        latexContent: simpleContent
      };

      console.log('🔨 Creating simple project:', projectData);

      const response = await api.post('/projects', projectData);
      
      console.log('✅ Project created:', response.data);

      if (response.data.success) {
        // Navigate normally (content already set)
        navigate(`/editor/${response.data.project.id}`);
      } else {
        setError('Failed to create project. Please try again.');
      }
    } catch (error) {
      console.error('❌ Failed to create project:', error);
      setError('Failed to create project. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // Handle "Use Template" button - full template content
  const handleUseTemplate = async () => {
    try {
      setCreating(true);
      
      const baseTitle = `Research Paper ${new Date().toLocaleDateString()}`;
      const uniqueTitle = generateUniqueTitle(baseTitle, [...projects, ...collaboratedProjects]);
      
      // Import and set full template content directly
      const { sampleLatex } = await import('../../utils/latexUtils');
      
      const projectData = {
        title: uniqueTitle,
        description: 'Research paper from template',
        content: sampleLatex,
        latexContent: sampleLatex
      };

      console.log('📄 Creating project from template:', projectData);

      const response = await api.post('/projects', projectData);
      
      console.log('✅ Template project created:', response.data);

      if (response.data.success) {
        // Navigate normally (content already set)
        navigate(`/editor/${response.data.project.id}`);
      } else {
        setError('Failed to create project from template. Please try again.');
      }
    } catch (error) {
      console.error('❌ Failed to create project from template:', error);
      setError('Failed to create project from template. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // Handle "Import Project" button - upload .tex file
  const handleImportProject = async () => {
    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.tex,.latex';
    fileInput.style.display = 'none';
    
    fileInput.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      try {
        setCreating(true);
        
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.tex') && !file.name.toLowerCase().endsWith('.latex')) {
          setError('Please select a .tex or .latex file');
          return;
        }
        
        // Read file content
        const fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
        });
        
        console.log('📄 Read .tex file:', file.name, 'Size:', file.size, 'bytes');
        
        // Generate project title from filename
        const baseTitle = file.name.replace(/\.(tex|latex)$/i, '') || `Imported Project ${new Date().toLocaleDateString()}`;
        const uniqueTitle = generateUniqueTitle(baseTitle, [...projects, ...collaboratedProjects]);
        
        const projectData = {
          title: uniqueTitle,
          description: `Imported from ${file.name}`,
          content: fileContent,
          latexContent: fileContent
        };

        console.log('📄 Creating project from imported file:', projectData.title);

        const response = await api.post('/projects', projectData);
        
        console.log('✅ Import project created:', response.data);

        if (response.data.success) {
          // Navigate to editor with imported content
          navigate(`/editor/${response.data.project.id}`);
        } else {
          setError('Failed to import project. Please try again.');
        }
        
      } catch (error) {
        console.error('❌ Failed to import project:', error);
        
        if (error.name === 'NotReadableError' || error.message.includes('read')) {
          setError('Failed to read the file. Please make sure it\'s a valid .tex file.');
        } else {
          setError('Failed to import project. Please try again.');
        }
      } finally {
        setCreating(false);
        // Clean up file input
        if (document.body.contains(fileInput)) {
          document.body.removeChild(fileInput);
        }
      }
    };
    
    // Trigger file selection
    document.body.appendChild(fileInput);
    fileInput.click();
  };

  const handleProjectClick = (projectId) => {
    navigate(`/editor/${projectId}`);
  };

  const handleDownloadTeX = async (project, event) => {
    event.stopPropagation();
    try {
      console.log('⬇️ Downloading TeX for project:', project.id);
      
      const response = await api.get(`/projects/${project.id}`);
      
      if (response.data.success) {
        const content = response.data.project.latex_content || response.data.project.content || '';
        downloadTeX(content, { name: 'main.tex' });
        console.log('✅ TeX download initiated');
      }
    } catch (error) {
      console.error('❌ Failed to download TeX:', error);
    }
  };

  const handleDownloadPDF = async (project, event) => {
    event.stopPropagation();
    // For now, show message that PDF needs to be compiled first
    alert('Please open the project and compile it first to generate a PDF');
  };

  const handleCloneProject = async (project, event) => {
    event.stopPropagation();
    try {
      const cloneTitle = generateUniqueTitle(`${project.title} (Copy)`, [...projects, ...collaboratedProjects]);
      
      console.log('📋 Cloning project:', project.id, 'with title:', cloneTitle);
      
      const response = await api.post(`/projects/${project.id}/clone`, { title: cloneTitle });
      
      if (response.data.success) {
        console.log('✅ Project cloned successfully');
        await loadProjects(); // Refresh project list
        navigate(`/editor/${response.data.project.id}`);
      }
    } catch (error) {
      console.error('❌ Failed to clone project:', error);
      setError('Failed to clone project. Please try again.');
    }
  };

  const handleDeleteProject = async (project, event) => {
    event.stopPropagation();
    setDeleteModal({ isOpen: true, project });
  };

  const confirmDelete = async () => {
    try {
      console.log('🗑️ Deleting project:', deleteModal.project.id);
      
      await api.delete(`/projects/${deleteModal.project.id}`);
      
      console.log('✅ Project deleted successfully');
      await loadProjects(); // Refresh project list
      setDeleteModal({ isOpen: false, project: null });
    } catch (error) {
      console.error('❌ Failed to delete project:', error);
      setError('Failed to delete project. Please try again.');
      setDeleteModal({ isOpen: false, project: null });
    }
  };

  const cancelDelete = () => {
    setDeleteModal({ isOpen: false, project: null });
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks === 1) return '1 week ago';
    if (diffInWeeks < 4) return `${diffInWeeks} weeks ago`;
    
    return date.toLocaleDateString();
  };

  const recentProjects = [...projects, ...collaboratedProjects]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <img 
                  src="/logo512.png" 
                  alt="Everleaf" 
                  className="w-8 h-8 rounded-full"
                  onError={(e) => {
                    // Fallback to gradient background with icon if image fails
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center" style={{ display: 'none' }}>
                  <img 
                    src="/logo512.png" 
                    alt="Everleaf" 
                    className="w-5 h-5 rounded-full"
                  />
                </div>
                <span className="text-xl font-bold text-gray-900">Everleaf</span>
              </div>
              
              <div className="hidden sm:block relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search projects..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button 
                onClick={handleCreateProject}
                disabled={creating}
                className="btn-primary inline-flex items-center justify-center px-3 py-2 sm:px-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon className="w-4 h-4 flex-shrink-0" />
                <span className="ml-2 hidden sm:block font-medium">
                  {creating ? 'Creating...' : 'New Project'}
                </span>
              </button>
              
              <div className="relative">
                <button className="flex items-center space-x-2 text-gray-700 hover:text-gray-900">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {user?.firstName?.charAt(0) || user?.first_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <span className="hidden sm:block font-medium">
                    {user?.firstName || user?.first_name} {user?.lastName || user?.last_name}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3"
          >
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </motion.div>
        )}

        {/* Welcome Section with conditional greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {specialGreeting ? 'Chh Chh..' : 'Welcome back'}, {user?.firstName || user?.first_name}{specialGreeting ? ' :)' : '!'}
          </h1>
          <p className="text-gray-600">
            Ready to continue your research? Here are your recent projects.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-1"
          >
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <nav className="space-y-2">
                <a
                  href="#"
                  className="flex items-center space-x-3 text-primary-700 bg-primary-50 px-3 py-2 rounded-lg font-medium"
                >
                  <DocumentTextIcon className="w-5 h-5" />
                  <span>All Projects</span>
                </a>
                <a
                  href="#"
                  className="flex items-center space-x-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-lg"
                >
                  <ClockIcon className="w-5 h-5" />
                  <span>Recent</span>
                </a>
                <a
                  href="#"
                  className="flex items-center space-x-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-lg"
                >
                  <UserGroupIcon className="w-5 h-5" />
                  <span>Shared with me</span>
                </a>
                <a
                  href="#"
                  className="flex items-center space-x-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-lg"
                >
                  <FolderIcon className="w-5 h-5" />
                  <span>Templates</span>
                </a>
              </nav>

              <div className="border-t border-gray-200 mt-6 pt-6">
                <nav className="space-y-2">
                  <a
                    href="#"
                    className="flex items-center space-x-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-lg"
                  >
                    <Cog6ToothIcon className="w-5 h-5" />
                    <span>Settings</span>
                  </a>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-lg w-full text-left"
                  >
                    <ArrowRightOnRectangleIcon className="w-5 h-5" />
                    <span>Sign out</span>
                  </button>
                </nav>
                
                {/* Early Stage Notice */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-500 leading-relaxed">
                    <p className="mb-3">
                      This project is still in its early stages, so some features may not be fully functional yet. I'm working on improving them soon. If you encounter any issues, especially with the RAG or AI editing, or if you have any suggestions, I'd love to hear your feedback!
                    </p>
                    <div className="flex items-center space-x-3">
                      <a 
                        href="https://www.linkedin.com/in/ganeshhgupta" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs">LinkedIn</span>
                      </a>
                      
                      <a 
                        href="mailto:iamgs10rk@gmail.com"
                        className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">Email</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-3"
          >
            {/* Quick Actions */}
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <button
                onClick={handleCreateProject}
                disabled={creating}
                className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-primary-300 hover:bg-primary-50 transition-colors text-center group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon className="w-8 h-8 text-gray-400 group-hover:text-primary-500 mx-auto mb-2" />
                <h3 className="font-medium text-gray-900 group-hover:text-primary-700">New Project</h3>
                <p className="text-sm text-gray-500">Start from scratch</p>
              </button>

              <button 
                onClick={handleUseTemplate}
                disabled={creating}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DocumentTextIcon className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <h3 className="font-medium text-gray-900">Use Template</h3>
                <p className="text-sm text-gray-500">Research paper template</p>
              </button>

              <button 
                onClick={handleImportProject}
                disabled={creating}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserGroupIcon className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <h3 className="font-medium text-gray-900">Import Project</h3>
                <p className="text-sm text-gray-500">From Overleaf or LaTeX</p>
              </button>
            </div>

            {/* Recent Projects */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Recent Projects</h2>
              </div>

              {loading ? (
                <div className="px-6 py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading projects...</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {recentProjects.map((project) => (
                    <div 
                      key={project.id} 
                      className="px-6 py-4 hover:bg-gray-50 cursor-pointer group"
                      onClick={() => handleProjectClick(project.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                            <DocumentTextIcon className="w-5 h-5 text-primary-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{project.title}</h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span>Modified {formatTimeAgo(project.updated_at)}</span>
                              {project.collaborator_count > 0 && (
                                <span className="flex items-center">
                                  <UserGroupIcon className="w-4 h-4 mr-1" />
                                  {project.collaborator_count} collaborators
                                </span>
                              )}
                              {project.owner_first_name && (
                                <span>by {project.owner_first_name} {project.owner_last_name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Project Action Icons */}
                        <div className="flex items-center space-x-2">
                          <button 
                            className="relative p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors tooltip-container"
                            onClick={(e) => handleDownloadTeX(project, e)}
                          >
                            <DocumentTextIcon className="w-5 h-5 font-bold stroke-2" />
                            <div className="tooltip">
                              Download as .tex
                            </div>
                          </button>
                          <button 
                            className="relative p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors tooltip-container"
                            onClick={(e) => handleDownloadPDF(project, e)}
                          >
                            <DocumentArrowDownIcon className="w-5 h-5 font-bold stroke-2" />
                            <div className="tooltip">
                              Download as PDF
                            </div>
                          </button>
                          <button 
                            className="relative p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors tooltip-container"
                            onClick={(e) => handleCloneProject(project, e)}
                          >
                            <DocumentDuplicateIcon className="w-5 h-5 font-bold stroke-2" />
                            <div className="tooltip">
                              Make a copy
                            </div>
                          </button>
                          <button 
                            className="relative p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors tooltip-container"
                            onClick={(e) => handleDeleteProject(project, e)}
                          >
                            <TrashIcon className="w-5 h-5 font-bold stroke-2" />
                            <div className="tooltip">
                              Delete
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {recentProjects.length === 0 && !loading && (
                    <div className="px-6 py-12 text-center">
                      <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
                      <p className="text-gray-500 mb-4">Create your first project to get started</p>
                      <button 
                        onClick={handleCreateProject} 
                        disabled={creating}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {creating ? 'Creating...' : 'Create Project'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Project</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete <span className="font-medium">"{deleteModal.project?.title}"</span>? 
              All project data will be permanently removed.
            </p>
            
            <div className="flex space-x-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add CSS for tooltips */}
      <style jsx>{`
        .tooltip-container {
          position: relative;
        }
        
        .tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          padding: 8px 12px;
          background-color: rgb(31, 41, 55);
          color: white;
          font-size: 0.875rem;
          border-radius: 6px;
          white-space: nowrap;
          opacity: 0;
          visibility: hidden;
          transition: opacity 200ms, visibility 200ms;
          z-index: 20;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          pointer-events: none;
        }
        
        .tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 4px solid rgb(31, 41, 55);
        }
        
        .tooltip-container:hover .tooltip {
          opacity: 1;
          visibility: visible;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
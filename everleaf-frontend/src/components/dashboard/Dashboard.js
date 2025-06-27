import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data - replace with real data later
  const recentProjects = [
    {
      id: 1,
      title: 'Research Paper Draft',
      lastModified: '2 hours ago',
      collaborators: 3,
      type: 'document'
    },
    {
      id: 2,
      title: 'Thesis Chapter 3',
      lastModified: '1 day ago',
      collaborators: 1,
      type: 'document'
    },
    {
      id: 3,
      title: 'Conference Presentation',
      lastModified: '3 days ago',
      collaborators: 2,
      type: 'presentation'
    }
  ];

  const handleLogout = () => {
    logout();
  };

  const handleCreateProject = () => {
    // Create a new project ID (temporary - replace with backend call)
    const newProjectId = Date.now();
    navigate(`/editor/${newProjectId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <AcademicCapIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Everleaf</span>
              </div>
              
              {/* Search Bar */}
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
                className="btn-primary inline-flex items-center justify-center px-3 py-2 sm:px-4"
              >
                <PlusIcon className="w-4 h-4 flex-shrink-0" />
                <span className="ml-2 hidden sm:block font-medium">New Project</span>
              </button>
              
              <div className="relative">
                <button className="flex items-center space-x-2 text-gray-700 hover:text-gray-900">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {user?.firstName?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <span className="hidden sm:block font-medium">
                    {user?.firstName} {user?.lastName}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.firstName}!
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
                className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-primary-300 hover:bg-primary-50 transition-colors text-center group"
              >
                <PlusIcon className="w-8 h-8 text-gray-400 group-hover:text-primary-500 mx-auto mb-2" />
                <h3 className="font-medium text-gray-900 group-hover:text-primary-700">New Project</h3>
                <p className="text-sm text-gray-500">Start from scratch</p>
              </button>

              <button className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow text-center">
                <DocumentTextIcon className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <h3 className="font-medium text-gray-900">Use Template</h3>
                <p className="text-sm text-gray-500">Research paper template</p>
              </button>

              <button className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow text-center">
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

              <div className="divide-y divide-gray-200">
                {recentProjects.map((project) => (
                  <div key={project.id} className="px-6 py-4 hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                          <DocumentTextIcon className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{project.title}</h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Modified {project.lastModified}</span>
                            <span className="flex items-center">
                              <UserGroupIcon className="w-4 h-4 mr-1" />
                              {project.collaborators} collaborators
                            </span>
                          </div>
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <EllipsisHorizontalIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {recentProjects.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
                  <p className="text-gray-500 mb-4">Create your first project to get started</p>
                  <button onClick={handleCreateProject} className="btn-primary">
                    Create Project
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
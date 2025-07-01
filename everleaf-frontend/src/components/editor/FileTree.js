import React from 'react';
import {
  FolderOpenIcon,
  DocumentTextIcon,
  PlusIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline';

const FileTree = ({
  files,
  activeFile,
  expandedFolders,
  sidebarOpen,
  onFileSelect,
  onToggleFolder,
  onToggleSidebar
}) => {
  const renderFileTree = (files, level = 0) => {
    return files.map(file => (
      <div key={file.id} style={{ paddingLeft: `${level * 12}px` }}>
        {file.type === 'folder' ? (
          <div>
            <div 
              className="flex items-center space-x-1 px-2 py-1 hover:bg-gray-100 cursor-pointer"
              onClick={() => onToggleFolder(file.name)}
            >
              {expandedFolders.has(file.name) ? (
                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronRightIcon className="w-3 h-3 text-gray-500" />
              )}
              <FolderOpenIcon className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">{file.name}</span>
            </div>
            {expandedFolders.has(file.name) && file.children && renderFileTree(file.children, level + 1)}
          </div>
        ) : (
          <div 
            className={`flex items-center space-x-2 px-2 py-1 hover:bg-gray-100 cursor-pointer ${
              activeFile?.id === file.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
            }`}
            onClick={() => onFileSelect(file)}
          >
            <div className="w-3 h-3"></div> {/* Spacer for alignment */}
            <DocumentTextIcon className="w-4 h-4 text-gray-500" />
            <span className={`text-sm ${
              activeFile?.id === file.id ? 'text-blue-700 font-medium' : 'text-gray-700'
            }`}>
              {file.name}
            </span>
          </div>
        )}
      </div>
    ));
  };

  if (!sidebarOpen) {
    return (
      // Collapsed state - show a thin vertical bar with expand button
      <div className="w-8 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-9 flex items-center justify-center border-b border-gray-200">
          <button 
            onClick={onToggleSidebar}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Expand Files Panel"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header with collapse button */}
      <div className="bg-white border-b border-gray-200 px-3 py-2 h-9">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button 
              onClick={onToggleSidebar}
              className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Collapse Files Panel"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-medium text-gray-900">Files</h3>
          </div>
          <button 
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Add File"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {renderFileTree(files)}
      </div>
    </div>
  );
};

export default FileTree;
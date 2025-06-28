import React, { useState, useRef, useEffect } from 'react';
import {
  PlayIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  Bars3Icon,
  ShareIcon,
  ArrowLeftIcon,
  PencilIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { downloadTeX, downloadPDF } from '../../utils/latexUtils';

const Toolbar = ({
  project,
  isEditingTitle,
  tempTitle,
  setTempTitle,
  isCompiling,
  pdfUrl,
  sidebarOpen,
  setSidebarOpen,
  activeFile,
  latexCode,
  onTitleClick,
  onTitleSave,
  onTitleCancel,
  onCompile,
  onNavigateBack
}) => {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef(null);

  // Close download menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTitleKeyPress = (e) => {
    if (e.key === 'Enter') {
      onTitleSave();
    } else if (e.key === 'Escape') {
      onTitleCancel();
    }
  };

  const handleDownloadTeX = () => {
    downloadTeX(latexCode, activeFile);
    setShowDownloadMenu(false);
  };

  const handleDownloadPDF = () => {
    const success = downloadPDF(pdfUrl, project);
    if (!success) {
      alert('Please compile the document first to generate a PDF');
    }
    setShowDownloadMenu(false);
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onNavigateBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span className="text-sm">Back to Dashboard</span>
          </button>
          
          <div className="h-6 w-px bg-gray-300"></div>
          
          {/* Editable Title */}
          <div className="flex items-center space-x-2">
            {isEditingTitle ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onKeyDown={handleTitleKeyPress}
                  onBlur={onTitleSave}
                  className="text-lg font-semibold bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={onTitleSave}
                  className="text-green-600 hover:text-green-700"
                >
                  <CheckIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div 
                className="flex items-center space-x-2 group cursor-pointer"
                onClick={onTitleClick}
              >
                <h1 className="text-lg font-semibold text-gray-900">
                  {project?.title || 'LaTeX Editor'}
                </h1>
                <PencilIcon className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onCompile}
            disabled={isCompiling}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${
              isCompiling 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow-md'
            }`}
          >
            <PlayIcon className="w-4 h-4 mr-2" />
            {isCompiling ? 'Compiling...' : 'Compile'}
          </button>
        
          
          {/* Download Button with Hover Menu */}
          <div className="relative" ref={downloadMenuRef}>
            <button
              onMouseEnter={() => setShowDownloadMenu(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
              Download
            </button>
            
            {showDownloadMenu && (
              <div 
                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                onMouseLeave={() => setShowDownloadMenu(false)}
              >
                <button
                  onClick={handleDownloadTeX}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <DocumentTextIcon className="w-4 h-4 text-gray-500" />
                  <span>Download as .tex</span>
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 text-gray-500" />
                  <span>Download as PDF</span>
                </button>
              </div>
            )}
          </div>
          
          <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            <ShareIcon className="w-4 h-4 mr-2" />
            Share
          </button>

          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
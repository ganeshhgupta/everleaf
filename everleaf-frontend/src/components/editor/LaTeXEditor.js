import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Toolbar from './Toolbar';
import FileTree from './FileTree';
import EditorPanel from './EditorPanel';
import PDFPreview from './PDFPreview';
import useResizeObserverFix from '../../hooks/useResizeObserverFix';
import { sampleLatex, sampleBibliography, getSampleChapterContent } from '../../utils/latexUtils';

const LaTeXEditor = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Apply ResizeObserver fix
  useResizeObserverFix();

  // State management
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [latexCode, setLatexCode] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [compileErrors, setCompileErrors] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['images', 'chapters']));
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  // Layout state
  const editorWidth = 50; // Fixed 50% width
  const containerRef = useRef(null);

  // Initialize project data
  useEffect(() => {
    console.log('Initializing LaTeX Editor...');
    
    // Initialize editor with sample content
    setLatexCode(sampleLatex);
    console.log('Sample LaTeX loaded, length:', sampleLatex.length);
    
    // Mock project data
    setProject({
      id: projectId,
      title: 'Research Paper Draft',
      owner: user?.firstName + ' ' + user?.lastName,
      lastModified: new Date().toISOString()
    });

    // Mock file structure
    setFiles([
      { id: 1, name: 'main.tex', type: 'file', active: true },
      { id: 2, name: 'references.bib', type: 'file', active: false },
      { id: 3, name: 'images', type: 'folder', children: [
        { id: 4, name: 'graph1.png', type: 'file', active: false },
        { id: 5, name: 'diagram.pdf', type: 'file', active: false }
      ]},
      { id: 6, name: 'chapters', type: 'folder', children: [
        { id: 7, name: 'introduction.tex', type: 'file', active: false },
        { id: 8, name: 'methodology.tex', type: 'file', active: false }
      ]}
    ]);

    setActiveFile({ id: 1, name: 'main.tex', type: 'file' });
    console.log('LaTeX Editor initialization complete');
  }, [projectId, user]);

  // Compilation handler - using useCallback to prevent re-creation
  const handleCompile = useCallback(async (isAutoSave = false) => {
    setIsCompiling(true);
    setCompileErrors([]);
    
    if (isAutoSave) {
      console.log('🔄 Auto-compiling on Ctrl+S...');
    } else {
      console.log('🔧 Manual compilation started...');
    }
    
    try {
      // Get token from cookies
      const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
      };
      
      const token = getCookie('token');
      
      if (!token) {
        setCompileErrors(['Authentication required. Please log in again.']);
        return;
      }
      
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/latex/projects/${projectId}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          files: {
            'main.tex': latexCode,
            'references.bib': sampleBibliography
          }
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
        const pdfObjectUrl = URL.createObjectURL(blob);
        setPdfUrl(pdfObjectUrl);
        setCompileErrors([]);
        console.log('✅ PDF generated successfully');
        
        if (isAutoSave) {
          console.log('💾 Auto-save compilation completed');
        }
      } else {
        const errorData = await response.json();
        console.error('❌ Compilation failed:', errorData);
        setCompileErrors(errorData.errors || ['Compilation failed']);
        setPdfUrl('');
      }
      
    } catch (error) {
      console.error('💥 Compilation error:', error);
      setCompileErrors([`Network error: ${error.message}`]);
    } finally {
      setIsCompiling(false);
    }
  }, [projectId, latexCode, pdfUrl]); // Dependencies for useCallback

  // Debug effect to track latexCode changes
  useEffect(() => {
    console.log('LaTeX code updated, length:', latexCode?.length || 0);
    console.log('Active file:', activeFile?.name);
  }, [latexCode, activeFile]);

  // Initial compilation on load
  useEffect(() => {
    const performInitialCompilation = async () => {
      if (latexCode && isInitialLoad && project) {
        console.log('🚀 Performing initial compilation...');
        setIsInitialLoad(false);
        // Add a small delay to ensure everything is loaded
        setTimeout(() => {
          handleCompile();
        }, 1000);
      }
    };

    performInitialCompilation();
  }, [latexCode, isInitialLoad, project]);

  // Ctrl+S auto-save and compile
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Check for Ctrl+S (or Cmd+S on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault(); // Prevent browser's default save behavior
        
        if (!isCompiling && latexCode) {
          console.log('⌨️ Ctrl+S detected - triggering auto-compile');
          handleCompile(true); // Pass true to indicate this is an auto-save
        }
      }
    };

    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove event listener
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCompiling, latexCode, handleCompile]); // Include handleCompile in dependencies

  // File selection handler
  const handleFileSelect = (file) => {
    setActiveFile(file);
    
    if (file.name === 'main.tex') {
      setLatexCode(sampleLatex);
    } else if (file.name === 'references.bib') {
      setLatexCode(sampleBibliography);
    } else if (file.name.endsWith('.tex')) {
      setLatexCode(getSampleChapterContent(file.name));
    }
  };

  // Folder toggle handler
  const toggleFolder = (folderName) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderName)) {
      newExpanded.delete(folderName);
    } else {
      newExpanded.add(folderName);
    }
    setExpandedFolders(newExpanded);
  };

  // Title editing functions
  const handleTitleClick = () => {
    setIsEditingTitle(true);
    setTempTitle(project?.title || 'Research Paper Draft');
  };

  const handleTitleSave = () => {
    const newTitle = tempTitle.trim() || 'Untitled Project';
    setProject(prev => ({ ...prev, title: newTitle }));
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setTempTitle(project?.title || 'Research Paper Draft');
    setIsEditingTitle(false);
  };

  // Prepare props for child components
  const toolbarProps = {
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
    onTitleClick: handleTitleClick,
    onTitleSave: handleTitleSave,
    onTitleCancel: handleTitleCancel,
    onCompile: () => handleCompile(false), // Explicitly pass false for manual compile
    onNavigateBack: () => navigate('/dashboard')
  };

  const fileTreeProps = {
    files,
    activeFile,
    expandedFolders,
    sidebarOpen,
    onFileSelect: handleFileSelect,
    onToggleFolder: toggleFolder
  };

  const editorProps = {
    activeFile,
    latexCode,
    setLatexCode,
    compileErrors,
    editorWidth
  };

  const previewProps = {
    pdfUrl,
    isCompiling,
    editorWidth
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Toolbar {...toolbarProps} />
      
      <div className="flex-1 flex overflow-hidden" ref={containerRef}>
        <FileTree {...fileTreeProps} />
        
        <div className="flex-1 flex">
          <EditorPanel {...editorProps} />
          
          {/* Static Divider */}
          <div className="w-1 bg-gray-200 flex items-center justify-center">
            <div className="w-0.5 h-8 bg-gray-400 rounded-full opacity-60"></div>
          </div>
          
          <PDFPreview {...previewProps} />
        </div>
      </div>
    </div>
  );
};

export default LaTeXEditor;
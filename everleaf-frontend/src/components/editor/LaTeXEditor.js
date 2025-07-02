// LaTeXEditor.js - MOBILE-RESPONSIVE VERSION WITH HEADER FIX

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Toolbar from './Toolbar';
import FileTree from './FileTree';
import EditorPanel from './EditorPanel';
import PDFPreview from './PDFPreview';
import ChatPanel from './ChatPanel';
import DocumentUpload from './DocumentUpload';
import useResizeObserverFix from '../../hooks/useResizeObserverFix';
import { sampleLatex, sampleBibliography, getSampleChapterContent } from '../../utils/latexUtils';
import Collaborator from './Collaborator';
import SurgicalEditingService from './SurgicalEditingService';

const LaTeXEditor = () => {
  const { api } = useAuth();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  useResizeObserverFix();

  // Existing state management
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [latexCode, setLatexCode] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [compileErrors, setCompileErrors] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['images', 'chapters', 'documents']));
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [isChatCollapsed, setIsChatCollapsed] = useState(true);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [ragMode, setRagMode] = useState(true);
  const [editorWidth, setEditorWidth] = useState(50);
  const [chatWidth, setChatWidth] = useState(25);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState(null);
  const [surgicalEditingService, setSurgicalEditingService] = useState(null);
  const [isProcessingSurgicalEdit, setIsProcessingSurgicalEdit] = useState(false);
  const [surgicalEditHistory, setSurgicalEditHistory] = useState([]);
  const [collaborators, setCollaborators] = useState([]);

  // NEW: Mobile-specific state management with initialization tracking
  const [isMobile, setIsMobile] = useState(false);
  const [hasInitializedMobile, setHasInitializedMobile] = useState(false);
  const [currentScreenMode, setCurrentScreenMode] = useState('editor'); // 'editor', 'preview', 'files', 'chat'
  const [mobileLeftPanelOpen, setMobileLeftPanelOpen] = useState(false);
  const [mobileChatPanelOpen, setMobileChatPanelOpen] = useState(false);
  const [mobilePreviewMode, setMobilePreviewMode] = useState(false);
  const [showSurgicalEditsFloat, setShowSurgicalEditsFloat] = useState(true);

  const containerRef = useRef(null);
  const dragStartRef = useRef(null);

  const GROQ_SERVER_URL = process.env.REACT_APP_FLASK_SERVER_URL || 'https://llm-server-production.up.railway.app';

  // FIXED: Mobile detection with proper state management to prevent header disappearing
  const checkIsMobile = useCallback(() => {
    return window.innerWidth < 768; // Tailwind's md breakpoint
  }, []);

  // Initialize mobile state only once
  useEffect(() => {
    const mobile = checkIsMobile();
    setIsMobile(mobile);
    
    // Set initial states based on mobile detection
    if (mobile) {
      setSidebarOpen(false);
      setIsChatCollapsed(true);
      setCurrentScreenMode('editor');
      setMobileLeftPanelOpen(false);
      setMobileChatPanelOpen(false);
      setMobilePreviewMode(false);
    } else {
      setSidebarOpen(true);
      setIsChatCollapsed(true); // Keep chat collapsed by default on desktop too
      setMobileLeftPanelOpen(false);
      setMobileChatPanelOpen(false);
      setMobilePreviewMode(false);
    }
    
    setHasInitializedMobile(true);
  }, []); // Empty dependency array - only run once on mount

  // Handle window resize - only update mobile state, don't reset UI states
  useEffect(() => {
    const handleResize = () => {
      const mobile = checkIsMobile();
      
      // Only update isMobile state if it actually changed
      setIsMobile(prevMobile => {
        if (prevMobile !== mobile) {
          console.log(`📱 Mobile state changed: ${prevMobile} -> ${mobile}`);
          
          // Only adjust layout if we're switching between mobile/desktop
          if (mobile) {
            // Switching to mobile - close desktop panels
            setSidebarOpen(false);
            setCurrentScreenMode('editor');
            // Close any open mobile panels
            setMobileLeftPanelOpen(false);
            setMobileChatPanelOpen(false);
            setMobilePreviewMode(false);
          } else {
            // Switching to desktop - restore desktop layout
            setSidebarOpen(true);
            // Close mobile panels
            setMobileLeftPanelOpen(false);
            setMobileChatPanelOpen(false);
            setMobilePreviewMode(false);
          }
        }
        return mobile;
      });
    };

    // Only add resize listener after initial mobile state is set
    if (hasInitializedMobile) {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [hasInitializedMobile, checkIsMobile]);

  // NEW: Mobile panel handlers
  const handleMobileHamburgerToggle = useCallback(() => {
    if (isMobile) {
      setMobileLeftPanelOpen(prev => {
        const newState = !prev;
        setCurrentScreenMode(newState ? 'files' : 'editor');
        return newState;
      });
    } else {
      setSidebarOpen(prev => !prev);
    }
  }, [isMobile]);

  const handleMobileChatToggle = useCallback(() => {
    if (isMobile) {
      setMobileChatPanelOpen(prev => {
        const newState = !prev;
        setCurrentScreenMode(newState ? 'chat' : 'editor');
        return newState;
      });
    } else {
      setIsChatCollapsed(prev => !prev);
    }
  }, [isMobile]);

  const handleMobilePreviewToggle = useCallback(() => {
    if (isMobile) {
      setMobilePreviewMode(prev => {
        const newState = !prev;
        setCurrentScreenMode(newState ? 'preview' : 'editor');
        return newState;
      });
    }
  }, [isMobile]);

  const handleMobileBackToEditor = useCallback(() => {
    setCurrentScreenMode('editor');
    setMobileLeftPanelOpen(false);
    setMobileChatPanelOpen(false);
    setMobilePreviewMode(false);
  }, []);

  // Update existing toggle functions for mobile compatibility
  const handleToggleChat = useCallback(() => {
    if (isMobile) {
      handleMobileChatToggle();
    } else {
      console.log('Toggling chat panel from', isChatCollapsed, 'to', !isChatCollapsed);
      setIsChatCollapsed(prev => !prev);
    }
  }, [isMobile, handleMobileChatToggle, isChatCollapsed]);

  // Initialize surgical editing service
  useEffect(() => {
    const llmClient = async (prompt) => {
      const response = await fetch(`${GROQ_SERVER_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          model_type: 'code',
          project_id: projectId,
          use_rag: ragMode && documents.filter(d => d.processingStatus === 'completed').length > 0,
          max_tokens: 2000,
          temperature: 0.2
        })
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.response;
    };

    const service = new SurgicalEditingService(llmClient, {
      debugMode: process.env.NODE_ENV === 'development',
      validationEnabled: true,
      maxRetries: 2
    });

    setSurgicalEditingService(service);
  }, [projectId, ragMode, documents]);

  // Calculate layout widths for desktop - memoized to prevent unnecessary recalculations
  const getLayoutWidths = useMemo(() => {
    if (isMobile) {
      return { editor: 100, chat: 0, preview: 0 };
    }

    const basePreviewWidth = 100 - editorWidth;
    
    if (isChatCollapsed) {
      return {
        editor: editorWidth,
        chat: 0,
        preview: basePreviewWidth
      };
    } else {
      return {
        editor: Math.max(20, editorWidth - chatWidth),
        chat: chatWidth,
        preview: basePreviewWidth
      };
    }
  }, [editorWidth, chatWidth, isChatCollapsed, isMobile]);

  // Handle mouse down on resize handles (desktop only)
  const handleMouseDown = useCallback((e, type) => {
    if (isMobile) return; // Skip resize on mobile
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeType(type);
    
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    
    dragStartRef.current = {
      startX: e.clientX,
      startEditorWidth: editorWidth,
      startChatWidth: chatWidth,
      containerWidth: containerRect.width
    };

    const handleMouseMove = (moveEvent) => {
      if (!dragStartRef.current || !containerRef.current) return;

      const { startX, startEditorWidth, startChatWidth, containerWidth } = dragStartRef.current;
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;

      if (type === 'editor-chat') {
        const newEditorWidth = Math.max(20, Math.min(70, startEditorWidth + deltaPercent));
        const widthDiff = newEditorWidth - startEditorWidth;
        const newChatWidth = Math.max(15, Math.min(50, startChatWidth - widthDiff));
        
        setEditorWidth(newEditorWidth);
        setChatWidth(newChatWidth);
      } else if (type === 'chat-preview') {
        const newChatWidth = Math.max(15, Math.min(50, startChatWidth + deltaPercent));
        setChatWidth(newChatWidth);
      } else if (type === 'editor-preview') {
        const newEditorWidth = Math.max(20, Math.min(80, startEditorWidth + deltaPercent));
        setEditorWidth(newEditorWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeType(null);
      dragStartRef.current = null;
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.style.pointerEvents = 'none';
  }, [editorWidth, chatWidth, isMobile]);

  // Load project documents
  const loadDocuments = useCallback(async () => {
    try {
      setDocumentsLoading(true);
      const response = await api.get(`/documents/${projectId}`);
      
      if (response.data.success) {
        setDocuments(response.data.documents);
        console.log(`Loaded ${response.data.documents.length} documents`);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setDocumentsLoading(false);
    }
  }, [api, projectId]);

  // Load project data from API
  const loadProject = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading project:', projectId);
      const response = await api.get(`/projects/${projectId}`);
      
      console.log('🔍 Full API response:', response);
      
      let projectData = null;
      
      if (response.data.success && response.data.project) {
        projectData = response.data.project;
        console.log('✅ Using success/project format');
      } else if (response.data.data) {
        projectData = response.data.data;
        console.log('✅ Using data format');
      } else if (response.data.id) {
        projectData = response.data;
        console.log('✅ Using direct object format');
      } else {
        console.error('❌ Unexpected response format:', response.data);
        setError('Unexpected response format from server');
        return;
      }
      
      setProject(projectData);
      
      const content = projectData.latex_content || projectData.content || `\\documentclass{article}
\\begin{document}
Hello Hello Hello :)
\\end{document}`;
      setLatexCode(content);
      
      console.log('✅ Project loaded successfully:', projectData.title);
    } catch (error) {
      console.error('❌ Error loading project:', error);
      setError('Failed to load project. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [api, projectId]);

  // Initialize chat with welcome message
  useEffect(() => {
    const completedDocs = documents.filter(doc => doc.processingStatus === 'completed').length;
    const processingDocs = documents.filter(doc => doc.processingStatus === 'processing').length;
    
    const ragStatus = completedDocs > 0 
      ? `\n\n🧠 **RAG Mode Active**: I can reference your ${completedDocs} processed document${completedDocs !== 1 ? 's' : ''} to provide contextual assistance.${processingDocs > 0 ? ` (${processingDocs} document${processingDocs !== 1 ? 's' : ''} still processing)` : ''}`
      : documents.length > 0 
        ? `\n\nDocuments uploaded but still processing...`
        : `\n\nUpload PDFs to enable RAG-powered assistance.`;

    setChatMessages([{
      id: Date.now(),
      role: 'assistant',
      content: `Hi there! I'm your Everleaf AI Assistant. I can help you:

• Surgically edit specific sections in LaTeX
• Write, fix, and explain LaTeX with precision
• Full validation and rollback protection
• Generate equations, tables, and figures${ragStatus}`,
      timestamp: new Date().toISOString(),
      autoApplied: false
    }]);
  }, [documents]);

  // Main function with natural language responses
  const sendChatMessage = useCallback(async (message, isLatexAssist = false, assistAction = '') => {
    if (!message.trim() || isChatLoading || !surgicalEditingService) return;

    console.log('🚀 LaTeXEditor sending message with surgical editing:', message.substring(0, 50));

    setIsChatLoading(true);
    setIsProcessingSurgicalEdit(true);

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      selectedText: selectedText || null,
      selectionRange: selectionRange || null
    };
    setChatMessages(prev => [...prev, userMessage]);

    try {
      const surgicalResult = await surgicalEditingService.performSurgicalEdit(
        latexCode,
        message,
        selectedText,
        selectionRange
      );

      console.log('🔧 Surgical editing result:', surgicalResult);

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isLatexAssist,
        assistAction,
        autoApplied: false,
        surgicalEdit: surgicalResult,
        metadata: { 
          action: assistAction,
          surgical: true,
          targetSection: surgicalResult.metadata?.targetSection,
          editType: surgicalResult.metadata?.editType
        }
      };

      if (surgicalResult.success) {
        let naturalResponse = surgicalResult.metadata.aiResponse || "I've made the changes you requested!";
        
        naturalResponse = naturalResponse
          .replace(/CONFIRMED_DELETE/g, "")
          .replace(/\*\*[^*]+\*\*/g, "")
          .replace(/^✅.*?successfully\*\*/i, "")
          .trim();
        
        if (naturalResponse.includes('**') || naturalResponse.includes('Applied') || naturalResponse.length < 10) {
          if (surgicalResult.metadata?.editType === 'delete') {
            naturalResponse = `I've deleted the ${surgicalResult.metadata?.targetSection || 'selected'} section.`;
          } else if (surgicalResult.metadata?.editType === 'add') {
            naturalResponse = `I've added content to the ${surgicalResult.metadata?.targetSection || 'document'}.`;
          } else if (surgicalResult.metadata?.editType === 'replace') {
            naturalResponse = `I've updated the ${surgicalResult.metadata?.targetSection || 'selected'} section.`;
          } else {
            naturalResponse = "I've made the changes you requested!";
          }
        }
        
        assistantMessage.content = naturalResponse;
        assistantMessage.autoApplied = true;

        console.log('🔧 Applying surgical changes to document');
        setLatexCode(surgicalResult.newDocument);

        setSurgicalEditHistory(prev => [...prev, {
          id: surgicalResult.sessionId,
          timestamp: assistantMessage.timestamp,
          message: message,
          changes: surgicalResult.changes,
          validation: surgicalResult.metadata.validation
        }]);

        // Show the surgical edits float when new edit is made
        setShowSurgicalEditsFloat(true);

      } else {
        console.log('❌ Surgical edit failed, showing natural error message');
        
        assistantMessage.content = `I'm having trouble with that request. ${surgicalResult.error}

Could you try rephrasing, or select specific text for me to work with?`;
        assistantMessage.isError = true;
        assistantMessage.autoApplied = false;
      }

      setChatMessages(prev => [...prev, assistantMessage]);
      setSelectedText('');
      setSelectionRange({ start: 0, end: 0 });

    } catch (err) {
      console.error('❌ Surgical editing error:', err);
      
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Sorry, I ran into an issue: ${err.message}

Let me try again, or you can rephrase your request.`,
        timestamp: new Date().toISOString(),
        isError: true,
        surgical: true,
        autoApplied: false
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
      setIsProcessingSurgicalEdit(false);
    }
  }, [isChatLoading, surgicalEditingService, selectedText, selectionRange, latexCode]);

  // Quick action handlers
  const handleQuickAction = useCallback((action) => {
    const actions = {
      equation: 'Generate a mathematical equation in LaTeX',
      table: 'Create a professional table in LaTeX',
      figure: 'Create a figure with caption in LaTeX',
      references: 'Add citations and improve bibliography'
    };
    
    sendChatMessage(actions[action], true, action);
  }, [sendChatMessage]);

  const handleSelectedTextAction = useCallback((action) => {
    if (!selectedText) return;

    const actions = {
      fix: 'Fix any errors in this LaTeX code',
      improve: 'Improve this LaTeX code with better formatting',
      explain: 'Explain what this LaTeX code does',
      delete: 'Delete this selected LaTeX code'
    };

    sendChatMessage(actions[action], true, action);
  }, [selectedText, sendChatMessage]);

  // Compilation handler
  const handleCompile = useCallback(async (isAutoSave = false) => {
    setIsCompiling(true);
    setCompileErrors([]);
    
    if (isAutoSave) {
      console.log('🔄 Auto-compiling on Ctrl+S...');
      await saveProject();
    } else {
      console.log('🔧 Manual compilation started...');
    }
    
    try {
      const response = await api.post(`/latex/projects/${projectId}/compile`, {
        files: {
          'main.tex': latexCode,
          'references.bib': sampleBibliography
        }
      }, {
        responseType: 'blob'
      });

      if (response.status === 200) {
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
        const pdfObjectUrl = URL.createObjectURL(response.data);
        setPdfUrl(pdfObjectUrl);
        setCompileErrors([]);
        console.log('✅ PDF generated successfully');
        
        if (isAutoSave) {
          console.log('💾 Auto-save compilation completed');
        }
      } else {
        console.error('❌ Compilation failed:', response.data);
        setCompileErrors(['Compilation failed']);
        setPdfUrl('');
      }
      
    } catch (error) {
      console.error('💥 Compilation error:', error);
      if (error.response?.data) {
        try {
          const errorText = await error.response.data.text();
          const errorData = JSON.parse(errorText);
          setCompileErrors(errorData.errors || ['Compilation failed']);
        } catch {
          setCompileErrors(['Compilation failed']);
        }
      } else {
        setCompileErrors([`Network error: ${error.message}`]);
      }
    } finally {
      setIsCompiling(false);
    }
  }, [projectId, latexCode, pdfUrl, api]);

  // Save project content
  const saveProject = useCallback(async (content = latexCode, title = project?.title) => {
    if (!project) return;
    
    try {
      const updates = {
        latex_content: content,
        content: content,
      };
      
      if (title && title !== project.title) {
        updates.title = title;
      }
      
      await api.put(`/projects/${projectId}`, updates);
      console.log('Project saved successfully');
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  }, [latexCode, project, api, projectId]);

  // Load project data from API
  useEffect(() => {
    if (projectId) {
      loadProject();
      loadDocuments();
    }
  }, [projectId, loadProject, loadDocuments]);

  // Initialize file structure after project loads
  useEffect(() => {
    if (project && !loading) {
      console.log('Initializing file structure for project:', project.title);
      
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
    }
  }, [project, loading]);

  // Initial compilation on load
  useEffect(() => {
    const performInitialCompilation = async () => {
      if (latexCode && isInitialLoad && project && !loading) {
        console.log('🚀 Performing initial compilation...');
        setIsInitialLoad(false);
        setTimeout(() => {
          handleCompile();
        }, 1000);
      }
    };

    performInitialCompilation();
  }, [latexCode, isInitialLoad, project, loading, handleCompile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        
        if (!isCompiling && latexCode) {
          console.log('⌨️ Ctrl+S detected - triggering auto-compile');
          handleCompile(true);
        }
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
        event.preventDefault();
        console.log('⌨️ Ctrl+I detected - toggling chat panel');
        handleToggleChat();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCompiling, latexCode, handleCompile, handleToggleChat]);

  // Auto-hide floating surgical edits indicator after 10 seconds
  useEffect(() => {
    if (surgicalEditHistory.length > 0 && showSurgicalEditsFloat) {
      const timer = setTimeout(() => {
        setShowSurgicalEditsFloat(false);
      }, 10000); // Hide after 10 seconds
      
      return () => clearTimeout(timer);
    }
  }, [surgicalEditHistory.length, showSurgicalEditsFloat]);

  // File selection handler
  const handleFileSelect = useCallback((file) => {
    setActiveFile(file);
    
    if (file.name === 'main.tex') {
      // Keep the current content for main.tex
    } else if (file.name === 'references.bib') {
      setLatexCode(sampleBibliography);
    } else if (file.name.endsWith('.tex')) {
      setLatexCode(getSampleChapterContent(file.name));
    }
  }, []);

  // Folder toggle handler
  const toggleFolder = useCallback((folderName) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderName)) {
      newExpanded.delete(folderName);
    } else {
      newExpanded.add(folderName);
    }
    setExpandedFolders(newExpanded);
  }, [expandedFolders]);

  // Title editing functions
  const handleTitleClick = useCallback(() => {
    setIsEditingTitle(true);
    setTempTitle(project?.title || 'Untitled Project');
  }, [project?.title]);

  const handleTitleSave = useCallback(async () => {
    const newTitle = tempTitle.trim() || 'Untitled Project';
    
    if (newTitle !== project?.title) {
      await saveProject(latexCode, newTitle);
      setProject(prev => ({ ...prev, title: newTitle }));
    }
    
    setIsEditingTitle(false);
  }, [tempTitle, project?.title, saveProject, latexCode]);

  const handleTitleCancel = useCallback(() => {
    setTempTitle(project?.title || 'Untitled Project');
    setIsEditingTitle(false);
  }, [project?.title]);

  // Handle text selection
  const handleTextSelection = useCallback((text, range) => {
    console.log('Text selected:', text.length, 'characters');
    setSelectedText(text);
    setSelectionRange(range);
    
    if (text.trim() && isChatCollapsed && !isMobile) {
      console.log('Auto-expanding chat panel due to text selection');
      setIsChatCollapsed(false);
    }
  }, [isChatCollapsed, isMobile]);

  // Direct text injection
  const injectTextIntoEditor = useCallback((newText, range = null) => {
    console.log('🔧 LaTeXEditor: Direct text injection');
    console.log('   - newText length:', newText?.length || 0);
    console.log('   - range:', range);
    
    if (!newText) {
      console.log('❌ No text to inject');
      return;
    }
    
    if (range && range.start !== range.end && selectedText) {
      const before = latexCode.substring(0, range.start);
      const after = latexCode.substring(range.end);
      const updatedCode = before + newText + after;
      setLatexCode(updatedCode);
      console.log('✅ Replaced selected text');
    } else if (range && range.start >= 0) {
      const before = latexCode.substring(0, range.start);
      const after = latexCode.substring(range.start);
      const updatedCode = before + '\n' + newText + '\n' + after;
      setLatexCode(updatedCode);
      console.log('✅ Inserted at specific position');
    } else {
      const currentCode = latexCode || '';
      
      if (currentCode.includes('\\end{document}')) {
        const endDocIndex = currentCode.lastIndexOf('\\end{document}');
        const before = currentCode.substring(0, endDocIndex);
        const after = currentCode.substring(endDocIndex);
        const updatedCode = before.trimEnd() + '\n\n' + newText + '\n\n' + after;
        setLatexCode(updatedCode);
        console.log('✅ Inserted before \\end{document}');
      } else {
        const updatedCode = currentCode.trim() + '\n\n' + newText;
        setLatexCode(updatedCode);
        console.log('✅ Appended to end');
      }
    }
    
    setSelectedText('');
    setSelectionRange({ start: 0, end: 0 });
  }, [latexCode, selectedText]);

  // Manual apply with better code extraction
  const handleManualApplyText = useCallback((messageId, code) => {
    if (code) {
      console.log('🔧 LaTeXEditor: Manual apply triggered');
      injectTextIntoEditor(code, selectedText ? selectionRange : null);
      
      setChatMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, manuallyApplied: true }
          : msg
      ));
    }
  }, [injectTextIntoEditor, selectedText, selectionRange]);

  // Function to manually apply any message content
  const handleApplyAnyContent = useCallback((messageId, content) => {
    console.log('🔧 LaTeXEditor: Applying any content');
    const processedContent = extractOrConvertLatexCode(content) || content;
    injectTextIntoEditor(processedContent, selectedText ? selectionRange : null);
    
    setChatMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, manuallyApplied: true }
        : msg
    ));
  }, [injectTextIntoEditor, selectedText, selectionRange]);

  // Get editor context for chat
  const getEditorContext = useCallback(() => {
    if (!selectedText || selectionRange.start === 0) {
      return latexCode;
    }
    
    const contextStart = Math.max(0, selectionRange.start - 200);
    const contextEnd = Math.min(latexCode.length, selectionRange.end + 200);
    
    return latexCode.substring(contextStart, contextEnd);
  }, [selectedText, selectionRange, latexCode]);

  // Document management handlers
  const handleDocumentsUploaded = useCallback(async (newDocuments) => {
    console.log(`${newDocuments.length} documents uploaded, refreshing list...`);
    await loadDocuments();
    
    const pollForUpdates = () => {
      let pollCount = 0;
      const maxPolls = 40;
      
      const checkInterval = setInterval(async () => {
        pollCount++;
        console.log(`📊 Polling for updates (${pollCount}/${maxPolls})`);
        
        try {
          await loadDocuments();
          
          const currentDocs = await api.get(`/documents/${projectId}`);
          const processingDocs = currentDocs.data.documents.filter(
            doc => doc.processingStatus === 'processing' || doc.processingStatus === 'pending'
          );
          
          if (processingDocs.length === 0) {
            clearInterval(checkInterval);
            console.log('✅ All documents processed - stopping polls');
            return;
          }
          
          if (pollCount >= maxPolls) {
            clearInterval(checkInterval);
            console.log('⏰ Max polling time reached - stopping polls');
            return;
          }
          
        } catch (error) {
          console.error('❌ Polling error:', error);
          clearInterval(checkInterval);
        }
      }, 3000);
    };
    
    pollForUpdates();
  }, [loadDocuments, api, projectId]);

  const handleDeleteDocument = useCallback(async (documentId) => {
    if (window.confirm('Are you sure you want to delete this document? This will also remove its embeddings.')) {
      try {
        await api.delete(`/documents/${projectId}/${documentId}`);
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
        console.log('Document deleted successfully');
      } catch (error) {
        console.error('Failed to delete document:', error);
        alert('Failed to delete document');
      }
    }
  }, [api, projectId]);

  const handleReprocessDocument = useCallback(async (documentId) => {
    try {
      await api.post(`/documents/${projectId}/${documentId}/reprocess`);
      loadDocuments();
      console.log('Document reprocessing started');
    } catch (error) {
      console.error('Failed to reprocess document:', error);
      alert('Failed to reprocess document');
    }
  }, [api, projectId, loadDocuments]);

  // Project actions
  const handleCloneProject = useCallback(async () => {
    if (!project?.title) return;
    
    try {
      const response = await api.post(`/projects/${projectId}/clone`, { title: `${project.title} (Copy)` });
      if (response.data.success) {
        navigate(`/editor/${response.data.project.id}`);
      }
    } catch (error) {
      console.error('Failed to clone project:', error);
    }
  }, [api, projectId, project?.title, navigate]);

  const handleDeleteProject = useCallback(async () => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        await api.delete(`/projects/${projectId}`);
        navigate('/dashboard');
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  }, [api, projectId, navigate]);

  const handleCollaboratorsChange = useCallback((newCollaborators) => {
    setCollaborators(newCollaborators);
    console.log(`👥 Collaborators updated: ${newCollaborators.length} total`);
  }, []);

  // Extract LaTeX code function
  const extractOrConvertLatexCode = useCallback((text) => {
    if (!text || typeof text !== 'string') {
      console.log('❌ Invalid text input for extraction');
      return null;
    }
    
    const codeMatch = text.match(/```(?:latex|tex)?\s*([\s\S]*?)```/);
    if (codeMatch) {
      console.log('📄 Found LaTeX code block');
      return codeMatch[1].trim();
    }
    
    const hasLatexCommands = /\\[a-zA-Z]+|\\begin\{|\\end\{|\\section|\\subsection/.test(text);
    
    if (hasLatexCommands) {
      console.log('📄 Found LaTeX commands in text');
      return text.trim();
    }
    
    const shouldBeLatex = 
      text.includes('section') || 
      text.includes('subsection') ||
      text.includes('paragraph') ||
      text.includes('introduction') ||
      text.includes('methodology') ||
      text.includes('conclusion') ||
      selectedText.length > 0;
    
    if (shouldBeLatex) {
      console.log('📝 Converting plain text to LaTeX format');
      
      let latexContent = text.trim();
      
      if (text.length > 100 && !text.startsWith('\\')) {
        const paragraphs = text.split('\n\n').filter(p => p.trim());
        
        if (paragraphs.length > 1) {
          if (paragraphs[0].length < 100 && !paragraphs[0].includes('.')) {
            const title = paragraphs[0].trim();
            const content = paragraphs.slice(1).join('\n\n');
            latexContent = `\\section{${title}}\n\n${content}`;
          } else {
            latexContent = paragraphs.join('\n\n');
          }
        }
      }
      
      return latexContent;
    }
    
    if (text.trim().length > 10) {
      console.log('📝 Returning text as-is');
      return text.trim();
    }
    
    console.log('❌ No LaTeX code detected and content not suitable');
    return null;
  }, [selectedText]);

  // Loading and error states
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Get the current layout widths
  const { editor: currentEditorWidth, chat: currentChatWidth, preview: currentPreviewWidth } = getLayoutWidths;

  // Prepare props for child components with mobile support
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
    onCompile: () => handleCompile(false),
    onNavigateBack: () => navigate('/dashboard'),
    onCloneProject: handleCloneProject,
    onDeleteProject: handleDeleteProject,
    // Share-related props
    onShareProject: () => {}, // Include your share function
    onCreateShareLink: () => {}, // Include your share function
    projectCollaborators: collaborators,
    // Mobile-specific props (only passed if mobile and initialized)
    ...(isMobile && hasInitializedMobile && {
      isMobile,
      currentScreenMode,
      mobileLeftPanelOpen,
      mobileChatPanelOpen,
      mobilePreviewMode,
      onMobileHamburgerToggle: handleMobileHamburgerToggle,
      onMobileChatToggle: handleMobileChatToggle,
      onMobilePreviewToggle: handleMobilePreviewToggle,
      onMobileBackToEditor: handleMobileBackToEditor
    })
  };

  const fileTreeProps = {
    files,
    activeFile,
    expandedFolders,
    sidebarOpen,
    onFileSelect: (file) => {
      setActiveFile(file);
      handleFileSelect(file);
      if (isMobile) {
        handleMobileBackToEditor();
      }
    },
    onToggleFolder: toggleFolder,
    onToggleSidebar: () => setSidebarOpen(!sidebarOpen),
    // Mobile-specific props (only passed if mobile and initialized)
    ...(isMobile && hasInitializedMobile && {
      isMobile,
      mobileLeftPanelOpen,
      onMobileClose: handleMobileBackToEditor
    })
  };

  const editorProps = {
    activeFile,
    latexCode,
    setLatexCode,
    compileErrors,
    editorWidth: currentEditorWidth,
    onTextSelection: handleTextSelection,
    selectedText,
    selectionRange,
    isResizing,
    isChatCollapsed,
    onToggleChat: handleToggleChat,
    ragEnabled: documents.filter(doc => doc.processingStatus === 'completed').length > 0,
    isProcessingSurgicalEdit,
    surgicalEditHistory: surgicalEditHistory.slice(-5),
    showSurgicalEditsInline: true, // Show as floating box instead of bottom strip
    hideSurgicalEditsPanel: true, // Hide the bottom surgical edits panel
    // Mobile-specific props (only passed if mobile and initialized)
    ...(isMobile && hasInitializedMobile && {
      isMobile,
      currentScreenMode
    })
  };
  
  const chatProps = {
    projectId,
    isCollapsed: isChatCollapsed,
    onToggleCollapse: handleToggleChat,
    selectedText,
    selectionRange: selectionRange,
    documents: documents,
    ragEnabled: documents.filter(doc => doc.processingStatus === 'completed').length > 0,
    width: currentChatWidth,
    messages: chatMessages,
    isLoading: isChatLoading,
    ragMode,
    setRagMode,
    onSendMessage: sendChatMessage,
    onQuickAction: handleQuickAction,
    onSelectedTextAction: handleSelectedTextAction,
    onManualApplyText: handleManualApplyText,
    onApplyAnyContent: handleApplyAnyContent,
    extractLatexCode: extractOrConvertLatexCode,
    isProcessingSurgicalEdit,
    surgicalEditHistory,
    surgicalEditingService,
    // Mobile-specific props (only passed if mobile and initialized)
    ...(isMobile && hasInitializedMobile && {
      isMobile,
      mobileChatPanelOpen,
      onMobileClose: handleMobileBackToEditor
    })
  };

  const previewProps = {
    pdfUrl,
    isCompiling,
    editorWidth: currentPreviewWidth,
    compileErrors,
    // Mobile-specific props (only passed if mobile and initialized)
    ...(isMobile && hasInitializedMobile && {
      isMobile,
      mobilePreviewMode,
      onMobileClose: handleMobileBackToEditor
    })
  };

  const documentUploadProps = {
    projectId,
    documents,
    onDocumentsUploaded: handleDocumentsUploaded,
    onDeleteDocument: handleDeleteDocument,
    onReprocessDocument: handleReprocessDocument
  };

  return (
    <Collaborator
      projectId={projectId}
      project={project}
      onCollaboratorsChange={handleCollaboratorsChange}
    >
      {(collaborationProps) => (
        <div className="h-screen flex flex-col bg-gray-50 relative">
          {/* Only render Toolbar if we have a project or are not loading */}
          {(project || !loading) && <Toolbar {...toolbarProps} />}
          
          {isMobile && hasInitializedMobile ? (
            // MOBILE LAYOUT
            <div className="flex-1 relative overflow-hidden">
              {/* Main Content - Always Full Screen */}
              <div className="absolute inset-0">
                {currentScreenMode === 'editor' && (
                  <EditorPanel {...editorProps} />
                )}
                {currentScreenMode === 'preview' && (
                  <PDFPreview {...previewProps} />
                )}
                {currentScreenMode === 'chat' && (
                  <ChatPanel {...chatProps} />
                )}
              </div>

              {/* Mobile Left Panel - Files & Upload (Slides from left, 90% width) */}
              <div className={`absolute inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${
                mobileLeftPanelOpen ? 'translate-x-0' : '-translate-x-full'
              }`} style={{ width: '90%' }}>
                <div className="h-full bg-white shadow-xl flex flex-col">
                  <FileTree {...fileTreeProps} />
                  <div className="border-t border-gray-200 p-4 space-y-4 flex-shrink-0">
                    <DocumentUpload {...documentUploadProps} />
                  </div>
                </div>
              </div>

              {/* Mobile Chat Panel (Slides from right, 90% width) */}
              <div className={`absolute inset-y-0 right-0 z-50 transform transition-transform duration-300 ease-in-out ${
                mobileChatPanelOpen ? 'translate-x-0' : 'translate-x-full'
              }`} style={{ width: '90%' }}>
                <div className="h-full bg-white shadow-xl">
                  <ChatPanel {...chatProps} />
                </div>
              </div>

              {/* Overlay for open panels */}
              {(mobileLeftPanelOpen || mobileChatPanelOpen) && (
                <div 
                  className="absolute inset-0 bg-black bg-opacity-25 z-40"
                  onClick={handleMobileBackToEditor}
                />
              )}
            </div>
          ) : (
            // DESKTOP LAYOUT
            <div className="flex-1 flex overflow-hidden h-full" ref={containerRef}>
              {/* Left Sidebar */}
              <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 ease-in-out overflow-hidden bg-white border-r border-gray-200 flex flex-col`}>
                <div className="h-full flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto">
                    <FileTree {...fileTreeProps} />
                  </div>
                  <div className="border-t border-gray-200 p-4 space-y-4 flex-shrink-0">
                    <DocumentUpload {...documentUploadProps} />
                  </div>
                </div>
              </div>
              
              {/* Main Content Area - Fixed to prevent bottom strips from affecting layout */}
              <div className="flex-1 flex relative min-w-0 overflow-hidden">
                <EditorPanel {...editorProps} />
                
                {/* Resize handles for desktop only */}
                <div
                  className={`w-1 bg-gray-200 hover:bg-blue-300 cursor-col-resize flex items-center justify-center group transition-colors select-none ${
                    isResizing && (resizeType === 'editor-chat' || resizeType === 'editor-preview') ? 'bg-blue-400' : ''
                  }`}
                  onMouseDown={(e) => handleMouseDown(e, isChatCollapsed ? 'editor-preview' : 'editor-chat')}
                  title={isChatCollapsed ? "Drag to resize editor and preview panels" : "Drag to resize editor and chat panels"}
                  style={{ zIndex: 10 }}
                >
                  <div className="w-0.5 h-8 bg-gray-400 group-hover:bg-blue-500 rounded-full opacity-60 group-hover:opacity-100 transition-all pointer-events-none"></div>
                </div>
                
                <ChatPanel {...chatProps} />
                
                {!isChatCollapsed && (
                  <div
                    className={`w-1 bg-gray-200 hover:bg-blue-300 cursor-col-resize flex items-center justify-center group transition-colors select-none ${
                      isResizing && resizeType === 'chat-preview' ? 'bg-blue-400' : ''
                    }`}
                    onMouseDown={(e) => handleMouseDown(e, 'chat-preview')}
                    title="Drag to resize chat and preview panels"
                    style={{ zIndex: 10 }}
                  >
                    <div className="w-0.5 h-8 bg-gray-400 group-hover:bg-blue-500 rounded-full opacity-60 group-hover:opacity-100 transition-all pointer-events-none"></div>
                  </div>
                )}
                
                <PDFPreview {...previewProps} />
              </div>
            </div>
          )}
        </div>
      )}
    </Collaborator>
  );
};

export default LaTeXEditor;
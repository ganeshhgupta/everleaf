// LaTeXEditor.js - Now handles Flask communication directly

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
//import { projectAPI, documentAPI } from '../../services/api';
import Toolbar from './Toolbar';
import FileTree from './FileTree';
import EditorPanel from './EditorPanel';
import PDFPreview from './PDFPreview';
import ChatPanel from './ChatPanel';
import DocumentUpload from './DocumentUpload';
import useResizeObserverFix from '../../hooks/useResizeObserverFix';
import { sampleLatex, sampleBibliography, getSampleChapterContent } from '../../utils/latexUtils';

const LaTeXEditor = () => {
  const { api } = useAuth();
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
  const [expandedFolders, setExpandedFolders] = useState(new Set(['images', 'chapters', 'documents']));
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Document management state
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  // Chat integration state
  const [isChatCollapsed, setIsChatCollapsed] = useState(true);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
  const applyTextRef = useRef(null);

  // NEW: Chat messages state - LaTeXEditor now manages chat messages
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [ragMode, setRagMode] = useState(true);

  // Resizable layout state
  const [editorWidth, setEditorWidth] = useState(50);
  const [chatWidth, setChatWidth] = useState(25);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState(null);
  
  const containerRef = useRef(null);
  const dragStartRef = useRef(null);

  // Groq server configuration
  const GROQ_SERVER_URL = 'http://localhost:5001';

  // ENHANCED: Function to extract LaTeX code or convert plain text to LaTeX
  const extractOrConvertLatexCode = (text) => {
    // First, try to extract existing LaTeX code blocks
    const codeMatch = text.match(/```(?:latex|tex)?\s*([\s\S]*?)```/);
    if (codeMatch) {
      console.log('📄 Found LaTeX code block');
      return codeMatch[1].trim();
    }
    
    // Check if the response looks like it should be LaTeX content
    const shouldBeLatex = 
      text.includes('section') || 
      text.includes('subsection') ||
      text.includes('paragraph') ||
      text.includes('introduction') ||
      text.includes('methodology') ||
      text.includes('conclusion') ||
      selectedText.length > 0; // If user has selected text, they probably want LaTeX
    
    if (shouldBeLatex) {
      console.log('📝 Converting plain text to LaTeX format');
      
      // Convert plain text to LaTeX sections/paragraphs
      let latexContent = text;
      
      // If it's a substantial response and looks like content, format it as LaTeX
      if (text.length > 100 && !text.startsWith('\\')) {
        // Split by paragraphs and format
        const paragraphs = text.split('\n\n').filter(p => p.trim());
        
        if (paragraphs.length > 1) {
          // Multiple paragraphs - treat first as section title if it's short
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
    
    console.log('❌ No LaTeX code detected and content doesn\'t appear to be LaTeX-suitable');
    return null;
  };

  // Calculate layout widths based on chat state
  const getLayoutWidths = useCallback(() => {
    if (isChatCollapsed) {
      return {
        editor: editorWidth,
        chat: 0,
        preview: 100 - editorWidth
      };
    } else {
      return {
        editor: editorWidth,
        chat: chatWidth,
        preview: 100 - editorWidth - chatWidth
      };
    }
  }, [editorWidth, chatWidth, isChatCollapsed]);

  const { editor: currentEditorWidth, chat: currentChatWidth, preview: currentPreviewWidth } = getLayoutWidths();

  // NEW: Initialize chat with welcome message
  useEffect(() => {
    const completedDocs = documents.filter(doc => doc.processingStatus === 'completed').length;
    const processingDocs = documents.filter(doc => doc.processingStatus === 'processing').length;
    
    const ragStatus = completedDocs > 0 
      ? `\n\n🧠 **RAG Mode Active**: I can reference your ${completedDocs} processed document${completedDocs !== 1 ? 's' : ''} to provide contextual assistance.${processingDocs > 0 ? ` (${processingDocs} document${processingDocs !== 1 ? 's' : ''} still processing)` : ''}`
      : documents.length > 0 
        ? `\n\n📄 Documents uploaded but still processing...`
        : `\n\n📄 Upload PDFs to enable RAG-powered assistance with your reference materials!`;

    setChatMessages([{
      id: Date.now(),
      role: 'assistant',
      content: `👋 Hi! I'm your LaTeX assistant powered by Groq AI. I can help you:

• Write and fix LaTeX code
• Explain LaTeX commands
• Improve document structure
• Generate equations and tables${ragStatus}

Select text in the editor and I'll help improve it, or just ask me anything!`,
      timestamp: new Date().toISOString(),
      autoApplied: false
    }]);
  }, [documents]);

  // NEW: Main function to send message to Flask and handle response
  const sendChatMessage = async (message, isLatexAssist = false, assistAction = '') => {
    if (!message.trim() || isChatLoading) return;

    console.log('🚀 LaTeXEditor sending message to Flask:', message.substring(0, 50));

    setIsChatLoading(true);

    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      selectedText: selectedText || null
    };
    setChatMessages(prev => [...prev, userMessage]);

    try {
      // Create enhanced message with context and LaTeX formatting instructions
      let enhancedMessage = message;
      
      // Add selected text context if available
      if (selectedText && selectedText.trim().length > 0) {
        enhancedMessage = `Context: I have selected this LaTeX text: "${selectedText}"\n\nQuestion: ${message}\n\nIMPORTANT: Please provide your response in proper LaTeX format that can be directly inserted into a LaTeX document.`;
      } else {
        // For general requests, encourage LaTeX format
        enhancedMessage = `${message}\n\nIMPORTANT: Please provide your response in proper LaTeX format (sections, subsections, paragraphs, etc.) that can be directly inserted into a LaTeX document.`;
      }

      console.log('📤 Sending request to Flask server...');

      // Call Flask server
      const response = await fetch(`${GROQ_SERVER_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: enhancedMessage,
          model_type: isLatexAssist ? 'code' : 'text',
          project_id: projectId,
          use_rag: ragMode && documents.filter(d => d.processingStatus === 'completed').length > 0,
          max_tokens: 1000,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`Flask server error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Flask response received:', data);

      if (data.success && data.response) {
        // Create assistant message
        const assistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString(),
          isLatexAssist,
          assistAction,
          autoApplied: false,
          ragContext: data.context_used > 0 ? { chunks: [] } : null,
          metadata: { action: assistAction }
        };

        // Add assistant message to chat
        setChatMessages(prev => [...prev, assistantMessage]);

        // ENHANCED: Try to extract or convert content for injection
        const extractedCode = extractOrConvertLatexCode(data.response);
        
        if (extractedCode) {
          console.log('🚀 LaTeXEditor: Auto-injecting content');
          console.log('   - Content type:', extractedCode.includes('```') ? 'LaTeX code block' : 'Converted content');
          console.log('   - Content length:', extractedCode.length);
          console.log('   - Content preview:', extractedCode.substring(0, 100));
          
          // Direct injection
          injectTextIntoEditor(extractedCode, selectedText ? selectionRange : null);
          
          // Update message to show it was applied
          setChatMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, autoApplied: true, appliedCode: extractedCode }
              : msg
          ));
          
          console.log('✅ LaTeXEditor: Auto-injection completed');
        } else {
          console.log('ℹ️ Content not suitable for auto-injection - will remain in chat only');
        }

        // Clear selection after processing
        setSelectedText('');
        setSelectionRange({ start: 0, end: 0 });

      } else {
        throw new Error(data.error || 'No response from AI');
      }

    } catch (err) {
      console.error('❌ Flask communication error:', err);
      
      // Add error message to chat
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `❌ Sorry, I couldn't process your request. Error: ${err.message}\n\nPlease make sure the Flask server is running on ${GROQ_SERVER_URL}`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // NEW: Quick action handlers
  const handleQuickAction = (action) => {
    const actions = {
      equation: 'Generate a mathematical equation in LaTeX',
      table: 'Create a professional table in LaTeX',
      figure: 'Create a figure with caption in LaTeX',
      references: 'Add citations and improve bibliography'
    };
    
    sendChatMessage(actions[action], true, action);
  };

  // NEW: Selected text action handlers
  const handleSelectedTextAction = (action) => {
    if (!selectedText) return;

    const actions = {
      fix: 'Fix any errors in this LaTeX code',
      improve: 'Improve this LaTeX code with better formatting',
      explain: 'Explain what this LaTeX code does',
      delete: 'Delete this selected LaTeX code'
    };

    sendChatMessage(actions[action], true, action);
  };

  // Handle mouse down on resize handles
  const handleMouseDown = useCallback((e, type) => {
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
  }, [editorWidth, chatWidth]);

  // Load project documents
  const loadDocuments = async () => {
    try {
      setDocumentsLoading(true);
      const response = await api.get(`/documents/${projectId}`);
      
      if (response.success) {
        setDocuments(response.documents);
        console.log(`Loaded ${response.documents.length} documents`);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setDocumentsLoading(false);
    }
  };

  // Load project data from API
  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Loading project:', projectId);
        const response = await api.get(`/projects/${projectId}`);
        
        if (response.success) {
          const projectData = response.project;
          setProject(projectData);
          
          const content = projectData.latex_content || projectData.content || sampleLatex;
          setLatexCode(content);
          
          console.log('Project loaded:', projectData.title);
          console.log('Content length:', content.length);
        } else {
          setError('Failed to load project');
        }
      } catch (error) {
        console.error('Error loading project:', error);
        setError('Failed to load project. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadProject();
      loadDocuments();
    }
  }, [projectId]);

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

  // Save project content
  const saveProject = async (content = latexCode, title = project?.title) => {
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
  };

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
  }, [projectId, latexCode, pdfUrl, project, saveProject]);

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
  }, [isCompiling, latexCode, handleCompile, isChatCollapsed]);

  // Auto-save when content changes
  useEffect(() => {
    if (!project || loading || isInitialLoad) return;
    
    const autoSaveTimer = setTimeout(() => {
      saveProject();
    }, 2000);
    
    return () => clearTimeout(autoSaveTimer);
  }, [latexCode, project, loading, isInitialLoad, saveProject]);

  // File selection handler
  const handleFileSelect = (file) => {
    setActiveFile(file);
    
    if (file.name === 'main.tex') {
      // Keep the current content for main.tex
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
    setTempTitle(project?.title || 'Untitled Project');
  };

  const handleTitleSave = async () => {
    const newTitle = tempTitle.trim() || 'Untitled Project';
    
    if (newTitle !== project?.title) {
      await saveProject(latexCode, newTitle);
      setProject(prev => ({ ...prev, title: newTitle }));
    }
    
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setTempTitle(project?.title || 'Untitled Project');
    setIsEditingTitle(false);
  };

  // Chat integration handlers
  const handleToggleChat = () => {
    console.log('Toggling chat panel from', isChatCollapsed, 'to', !isChatCollapsed);
    setIsChatCollapsed(!isChatCollapsed);
  };

  const handleTextSelection = (text, range) => {
    console.log('Text selected:', text.length, 'characters');
    setSelectedText(text);
    setSelectionRange(range);
    
    if (text.trim() && isChatCollapsed) {
      console.log('Auto-expanding chat panel due to text selection');
      setIsChatCollapsed(false);
    }
  };

  // SIMPLIFIED: Direct text injection bypassing the ref system entirely
  const injectTextIntoEditor = (newText, range = null) => {
    console.log('🔧 LaTeXEditor: Direct text injection');
    console.log('   - newText length:', newText?.length || 0);
    console.log('   - newText preview:', newText?.substring(0, 100));
    console.log('   - range:', range);
    console.log('   - selectedText:', selectedText?.substring(0, 50));
    console.log('   - current latexCode length:', latexCode?.length || 0);
    
    if (range && range.start !== range.end && selectedText) {
      // Replace selected text
      console.log('🔄 Replacing selected text from', range.start, 'to', range.end);
      const before = latexCode.substring(0, range.start);
      const after = latexCode.substring(range.end);
      const updatedCode = before + newText + after;
      setLatexCode(updatedCode);
      console.log('✅ Selected text replaced, new length:', updatedCode.length);
    } else if (range && range.start >= 0) {
      // Insert at specific position
      console.log('🔄 Inserting at position:', range.start);
      const before = latexCode.substring(0, range.start);
      const after = latexCode.substring(range.start);
      const updatedCode = before + '\n' + newText + '\n' + after;
      setLatexCode(updatedCode);
      console.log('✅ Text inserted at position, new length:', updatedCode.length);
    } else {
      // Append to end
      console.log('🔄 Appending to end of document');
      setLatexCode(prev => {
        const currentCode = prev || '';
        const newCode = currentCode.trim() + '\n\n' + newText;
        console.log('✅ Text appended, new length:', newCode.length);
        return newCode;
      });
    }
    
    // Clear selection after injection
    setSelectedText('');
    setSelectionRange({ start: 0, end: 0 });
    console.log('🧹 Cleared selection after injection');
  };

  // ENHANCED: Manual apply with better code extraction
  const handleManualApplyText = (messageId, code) => {
    if (code) {
      console.log('🔧 LaTeXEditor: Manual apply triggered');
      injectTextIntoEditor(code, selectedText ? selectionRange : null);
      
      // Update message to show it was applied
      setChatMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, manuallyApplied: true }
          : msg
      ));
      
      console.log('✅ LaTeXEditor: Manual apply completed');
    }
  };

  // NEW: Function to manually apply any message content (not just LaTeX code)
  const handleApplyAnyContent = (messageId, content) => {
    console.log('🔧 LaTeXEditor: Applying any content');
    const processedContent = extractOrConvertLatexCode(content) || content;
    injectTextIntoEditor(processedContent, selectedText ? selectionRange : null);
    
    // Update message to show it was applied
    setChatMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, manuallyApplied: true }
        : msg
    ));
    
    console.log('✅ LaTeXEditor: Any content apply completed');
  };

  // Get editor context for chat
  const getEditorContext = () => {
    if (!selectedText || selectionRange.start === 0) {
      return latexCode;
    }
    
    const contextStart = Math.max(0, selectionRange.start - 200);
    const contextEnd = Math.min(latexCode.length, selectionRange.end + 200);
    
    return latexCode.substring(contextStart, contextEnd);
  };

  // Document management handlers
  const handleDocumentsUploaded = (newDocuments) => {
    setDocuments(prev => [...prev, ...newDocuments]);
    console.log(`Added ${newDocuments.length} new documents`);
  };

  const handleDeleteDocument = async (documentId) => {
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
  };

  const handleReprocessDocument = async (documentId) => {
    try {
      await api.post(`/documents/${projectId}/${documentId}/reprocess`);
      loadDocuments();
      console.log('Document reprocessing started');
    } catch (error) {
      console.error('Failed to reprocess document:', error);
      alert('Failed to reprocess document');
    }
  };

  // Project actions
  const handleCloneProject = async () => {
    try {
      const response = await api.post(`/projects/${projectId}/clone`, { title: `${project.title} (Copy)` });
      if (response.success) {
        navigate(`/editor/${response.project.id}`);
      }
    } catch (error) {
      console.error('Failed to clone project:', error);
    }
  };

  const handleDeleteProject = async () => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        await api.delete(`/projects/${projectId}`);
        navigate('/dashboard');
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  // Loading state
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

  // Error state
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
    onCompile: () => handleCompile(false),
    onNavigateBack: () => navigate('/dashboard'),
    onCloneProject: handleCloneProject,
    onDeleteProject: handleDeleteProject
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
    editorWidth: currentEditorWidth,
    onTextSelection: handleTextSelection,
    // REMOVED: onApplyText: applyTextRef, // Not needed anymore
    selectedText,
    selectionRange,
    isResizing,
    isChatCollapsed,
    onToggleChat: handleToggleChat,
    ragEnabled: documents.filter(doc => doc.processingStatus === 'completed').length > 0
  };
  
  // NEW: Updated ChatPanel props - now receives messages and handlers from parent
  const chatProps = {
    projectId,
    isCollapsed: isChatCollapsed,
    onToggleCollapse: handleToggleChat,
    selectedText,
    selectionRange: selectionRange,
    documents: documents,
    ragEnabled: documents.filter(doc => doc.processingStatus === 'completed').length > 0,
    width: currentChatWidth,
    // NEW: Pass chat state and handlers
    messages: chatMessages,
    isLoading: isChatLoading,
    ragMode,
    setRagMode,
    onSendMessage: sendChatMessage,
    onQuickAction: handleQuickAction,
    onSelectedTextAction: handleSelectedTextAction,
    onManualApplyText: handleManualApplyText,
    onApplyAnyContent: handleApplyAnyContent, // NEW: Apply any content
    extractLatexCode: extractOrConvertLatexCode
  };

  const previewProps = {
    pdfUrl,
    isCompiling,
    editorWidth: currentPreviewWidth
  };

  const documentUploadProps = {
    projectId,
    documents,
    onDocumentsUploaded: handleDocumentsUploaded,
    onDeleteDocument: handleDeleteDocument,
    onReprocessDocument: handleReprocessDocument
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Toolbar {...toolbarProps} />
      
      <div className="flex-1 flex overflow-hidden" ref={containerRef}>
        {/* Left Sidebar */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 ease-in-out overflow-hidden bg-white border-r border-gray-200`}>
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <FileTree {...fileTreeProps} />
            </div>
            <div className="border-t border-gray-200 p-4 space-y-4">
              <DocumentUpload {...documentUploadProps} />
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex relative">
          {/* Editor Panel */}
          <EditorPanel {...editorProps} />
          
          {/* Draggable Resize Handle */}
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
          
          {/* Chat Panel */}
          <ChatPanel {...chatProps} />
          
          {/* Draggable Resize Handle 2 */}
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
          
          {/* PDF Preview Panel */}
          <PDFPreview {...previewProps} />
        </div>
      </div>
    </div>
  );
};

export default LaTeXEditor;
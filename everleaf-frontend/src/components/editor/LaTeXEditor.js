// LaTeXEditor.js - COMPLETE UPDATED VERSION WITH NATURAL LANGUAGE RESPONSES

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// NEW: Import surgical editing service
import SurgicalEditingService from './SurgicalEditingService';

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

  // Chat messages state
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

  // NEW: Surgical editing state
  const [surgicalEditingService, setSurgicalEditingService] = useState(null);
  const [isProcessingSurgicalEdit, setIsProcessingSurgicalEdit] = useState(false);
  const [surgicalEditHistory, setSurgicalEditHistory] = useState([]);

  // Groq server configuration
  const GROQ_SERVER_URL = process.env.REACT_APP_FLASK_SERVER_URL || 'https://llm-server-production.up.railway.app';

  const [collaborators, setCollaborators] = useState([]);

  
  // NEW: Initialize surgical editing service
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

  // ENHANCED: Function to extract LaTeX code or convert plain text to LaTeX
  const extractOrConvertLatexCode = (text) => {
    if (!text || typeof text !== 'string') {
      console.log('❌ Invalid text input for extraction');
      return null;
    }
    
    // First, try to extract existing LaTeX code blocks
    const codeMatch = text.match(/```(?:latex|tex)?\s*([\s\S]*?)```/);
    if (codeMatch) {
      console.log('📄 Found LaTeX code block');
      return codeMatch[1].trim();
    }
    
    // Check for LaTeX commands in the text
    const hasLatexCommands = /\\[a-zA-Z]+|\\begin\{|\\end\{|\\section|\\subsection/.test(text);
    
    if (hasLatexCommands) {
      console.log('📄 Found LaTeX commands in text');
      return text.trim();
    }
    
    // Check if the response looks like it should be LaTeX content
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
      
      // Convert plain text to LaTeX format
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
    
    // If all else fails, return the text as-is if it's substantial
    if (text.trim().length > 10) {
      console.log('📝 Returning text as-is');
      return text.trim();
    }
    
    console.log('❌ No LaTeX code detected and content not suitable');
    return null;
  };

  // Calculate layout widths
  const getLayoutWidths = useCallback(() => {
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
  }, [editorWidth, chatWidth, isChatCollapsed]);

  const { editor: currentEditorWidth, chat: currentChatWidth, preview: currentPreviewWidth } = getLayoutWidths();

  // Initialize chat with welcome message
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
      content: `👋 Hi! I'm your **Surgical LaTeX Assistant** powered by Groq AI. I can help you:

• **Surgically edit** specific sections without affecting other content
• Write and fix LaTeX code with precision
• Explain LaTeX commands and improve document structure
• Generate equations, tables, and figures${ragStatus}

**New Surgical Editing Features:**
• Select text → I'll improve only that part
• Say "expand the intro" → I'll enhance just the introduction
• Say "delete section 3" → I'll remove exactly that section
• Full validation and rollback protection

Select text in the editor and I'll surgically improve it, or just ask me anything!`,
      timestamp: new Date().toISOString(),
      autoApplied: false
    }]);
  }, [documents]);

  // FIXED: Main function with natural language responses
  const sendChatMessage = async (message, isLatexAssist = false, assistAction = '') => {
    if (!message.trim() || isChatLoading || !surgicalEditingService) return;

    console.log('🚀 LaTeXEditor sending message with surgical editing:', message.substring(0, 50));

    setIsChatLoading(true);
    setIsProcessingSurgicalEdit(true);

    // Add user message to chat
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
      // NEW: Use surgical editing service for precise modifications
      const surgicalResult = await surgicalEditingService.performSurgicalEdit(
        latexCode,
        message,
        selectedText,
        selectionRange
      );

      console.log('🔧 Surgical editing result:', surgicalResult);

      // Create assistant message
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
        // FIXED: Show natural, conversational response
        let naturalResponse = surgicalResult.metadata.aiResponse || "I've made the changes you requested!";
        
        // Clean up any technical language that might slip through
        naturalResponse = naturalResponse
          .replace(/CONFIRMED_DELETE/g, "")
          .replace(/\*\*[^*]+\*\*/g, "") // Remove **bold** formatting
          .replace(/^✅.*?successfully\*\*/i, "")
          .trim();
        
        // If the response is too technical, make it more natural
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

        // Apply the surgical changes to the document
        console.log('🔧 Applying surgical changes to document');
        setLatexCode(surgicalResult.newDocument);

        // Add to surgical edit history
        setSurgicalEditHistory(prev => [...prev, {
          id: surgicalResult.sessionId,
          timestamp: assistantMessage.timestamp,
          message: message,
          changes: surgicalResult.changes,
          validation: surgicalResult.metadata.validation
        }]);

      } else {
        // FIXED: Natural error message
        console.log('❌ Surgical edit failed, showing natural error message');
        
        assistantMessage.content = `I'm having trouble with that request. ${surgicalResult.error}

Could you try rephrasing, or select specific text for me to work with?`;
        assistantMessage.isError = true;
        assistantMessage.autoApplied = false;
      }

      // Add assistant message to chat
      setChatMessages(prev => [...prev, assistantMessage]);

      // Clear selection after processing
      setSelectedText('');
      setSelectionRange({ start: 0, end: 0 });

    } catch (err) {
      console.error('❌ Surgical editing error:', err);
      
      // FIXED: Natural error message
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
  };

  // Quick action handlers
  const handleQuickAction = (action) => {
    const actions = {
      equation: 'Generate a mathematical equation in LaTeX',
      table: 'Create a professional table in LaTeX',
      figure: 'Create a figure with caption in LaTeX',
      references: 'Add citations and improve bibliography'
    };
    
    sendChatMessage(actions[action], true, action);
  };

  // Selected text action handlers
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
        // Dragging between editor and chat - both should adjust
        const newEditorWidth = Math.max(20, Math.min(70, startEditorWidth + deltaPercent));
        const widthDiff = newEditorWidth - startEditorWidth;
        const newChatWidth = Math.max(15, Math.min(50, startChatWidth - widthDiff));
        
        setEditorWidth(newEditorWidth);
        setChatWidth(newChatWidth);
      } else if (type === 'chat-preview') {
        // FIXED: Dragging between chat and preview - only chat width should change
        // Editor width stays the same, only chat width changes
        const newChatWidth = Math.max(15, Math.min(50, startChatWidth + deltaPercent));
        setChatWidth(newChatWidth);
        // Don't change editor width - it should stay fixed
      } else if (type === 'editor-preview') {
        // Dragging between editor and preview (when chat is collapsed)
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
      
      if (response.data.success) {
        setDocuments(response.data.documents);
        console.log(`Loaded ${response.data.documents.length} documents`);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setDocumentsLoading(false);
    }
  };

  // Load project data from API
  const loadProject = async () => {
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
  };

  // Load project data from API
  useEffect(() => {
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
  }, [projectId, latexCode, pdfUrl, project, saveProject, api]);

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

  // ENHANCED: Direct text injection bypassing the ref system entirely
  const injectTextIntoEditor = (newText, range = null) => {
    console.log('🔧 LaTeXEditor: Direct text injection');
    console.log('   - newText length:', newText?.length || 0);
    console.log('   - range:', range);
    
    if (!newText) {
      console.log('❌ No text to inject');
      return;
    }
    
    if (range && range.start !== range.end && selectedText) {
      // Replace selected text
      const before = latexCode.substring(0, range.start);
      const after = latexCode.substring(range.end);
      const updatedCode = before + newText + after;
      setLatexCode(updatedCode);
      console.log('✅ Replaced selected text');
    } else if (range && range.start >= 0) {
      // Insert at specific position
      const before = latexCode.substring(0, range.start);
      const after = latexCode.substring(range.start);
      const updatedCode = before + '\n' + newText + '\n' + after;
      setLatexCode(updatedCode);
      console.log('✅ Inserted at specific position');
    } else {
      // Smart insertion based on document structure
      const currentCode = latexCode || '';
      
      // Check if document has \end{document}
      if (currentCode.includes('\\end{document}')) {
        // Insert before \end{document}
        const endDocIndex = currentCode.lastIndexOf('\\end{document}');
        const before = currentCode.substring(0, endDocIndex);
        const after = currentCode.substring(endDocIndex);
        const updatedCode = before.trimEnd() + '\n\n' + newText + '\n\n' + after;
        setLatexCode(updatedCode);
        console.log('✅ Inserted before \\end{document}');
      } else {
        // Append to end
        const updatedCode = currentCode.trim() + '\n\n' + newText;
        setLatexCode(updatedCode);
        console.log('✅ Appended to end');
      }
    }
    
    // Clear selection after injection
    setSelectedText('');
    setSelectionRange({ start: 0, end: 0 });
  };

  // Manual apply with better code extraction
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
    }
  };

  // Function to manually apply any message content
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
  const handleDocumentsUploaded = async (newDocuments) => {
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
      if (response.data.success) {
        navigate(`/editor/${response.data.project.id}`);
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

const handleCollaboratorsChange = (newCollaborators) => {
  setCollaborators(newCollaborators);
  console.log(`👥 Collaborators updated: ${newCollaborators.length} total`);
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
    selectedText,
    selectionRange,
    isResizing,
    isChatCollapsed,
    onToggleChat: handleToggleChat,
    ragEnabled: documents.filter(doc => doc.processingStatus === 'completed').length > 0,
    // NEW: Surgical editing status
    isProcessingSurgicalEdit,
    surgicalEditHistory: surgicalEditHistory.slice(-5) // Last 5 edits
  };
  
  // Updated ChatPanel props with surgical editing support
  const chatProps = {
    projectId,
    isCollapsed: isChatCollapsed,
    onToggleCollapse: handleToggleChat,
    selectedText,
    selectionRange: selectionRange,
    documents: documents,
    ragEnabled: documents.filter(doc => doc.processingStatus === 'completed').length > 0,
    width: currentChatWidth,
    // Chat state and handlers
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
    // NEW: Surgical editing specific props
    isProcessingSurgicalEdit,
    surgicalEditHistory,
    surgicalEditingService
  };

  const previewProps = {
    pdfUrl,
    isCompiling,
    editorWidth: currentPreviewWidth,
    compileErrors // NEW: Pass compile errors to PDF preview
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
      <div className="h-screen flex flex-col bg-gray-50">
        <Toolbar 
          project={project}
          isEditingTitle={isEditingTitle}
          tempTitle={tempTitle}
          setTempTitle={setTempTitle}
          isCompiling={isCompiling}
          pdfUrl={pdfUrl}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          activeFile={activeFile}
          latexCode={latexCode}
          onTitleClick={handleTitleClick}
          onTitleSave={handleTitleSave}
          onTitleCancel={handleTitleCancel}
          onCompile={() => handleCompile(false)}
          onNavigateBack={() => navigate('/dashboard')}
          onCloneProject={handleCloneProject}
          onDeleteProject={handleDeleteProject}
          onShareProject={collaborationProps.shareProject}
          onCreateShareLink={collaborationProps.createShareLink}
          projectCollaborators={collaborationProps.collaborators}
        />
        
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
          
          {/* Main Content Area */}
          <div className="flex-1 flex relative min-w-0">
            {/* Editor Panel */}
            <EditorPanel {...editorProps} />
            
            {/* Draggable Resize Handle - Editor to Chat */}
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
            
            {/* Draggable Resize Handle - Chat to Preview */}
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
    )}
  </Collaborator>
);

}; // Don't forget the closing bracket for the LaTeXEditor component

export default LaTeXEditor;
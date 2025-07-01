import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { CodeBracketIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

const EditorPanel = ({
  activeFile,
  latexCode,
  setLatexCode,
  compileErrors,
  editorWidth,
  // New props for chat integration
  onTextSelection,
  // REMOVED: onApplyText, - Not needed since LaTeXEditor handles injection directly
  selectedText,
  selectionRange,
  isResizing, // New prop to handle resize state
  // Chat integration props
  isChatCollapsed,
  onToggleChat,
  ragEnabled
}) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null); // Store monaco reference

  // Add this as a fallback
  const defaultLatex = `\\documentclass{article}
\\begin{document}
Hello World!
\\end{document}`;

  // Debug: Log the current state
  useEffect(() => {
    console.log('EditorPanel - latexCode length:', latexCode?.length || 0);
    console.log('EditorPanel - activeFile:', activeFile?.name);
  }, [latexCode, activeFile]);

  // Handle editor resize when layout changes
  useEffect(() => {
    if (editorRef.current && !isResizing) {
      // Small delay to ensure layout has settled
      const timeout = setTimeout(() => {
        try {
          editorRef.current.layout();
        } catch (error) {
          // Ignore ResizeObserver errors
          if (!error.message.includes('ResizeObserver')) {
            console.error('Editor layout error:', error);
          }
        }
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [editorWidth, isResizing]);

  const handleEditorDidMount = (editor, monaco) => {
    console.log('Monaco Editor mounted successfully');
    editorRef.current = editor;
    monacoRef.current = monaco; // Store monaco reference
    
    try {
      // Configure LaTeX language (Monaco doesn't have built-in LaTeX support)
      if (!monaco.languages.getLanguages().find(lang => lang.id === 'latex')) {
        monaco.languages.register({ id: 'latex' });
        
        // Define LaTeX tokens for syntax highlighting
        monaco.languages.setMonarchTokensProvider('latex', {
          tokenizer: {
            root: [
              [/\\[a-zA-Z@]+/, 'keyword'],
              [/\\[^a-zA-Z@]/, 'keyword'],
              [/\{/, 'delimiter.curly'],
              [/\}/, 'delimiter.curly'],
              [/\[/, 'delimiter.square'],
              [/\]/, 'delimiter.square'],
              [/%.*$/, 'comment'],
              [/\$\$/, 'string', '@math_display'],
              [/\$/, 'string', '@math_inline'],
            ],
            math_inline: [
              [/[^$]+/, 'string'],
              [/\$/, 'string', '@pop']
            ],
            math_display: [
              [/[^$]+/, 'string'],
              [/\$\$/, 'string', '@pop']
            ]
          }
        });
      }

      // Configure editor theme
      monaco.editor.defineTheme('latex-theme', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
          { token: 'comment', foreground: '008000', fontStyle: 'italic' },
          { token: 'string', foreground: 'A31515' },
          { token: 'delimiter', foreground: '800080' }
        ],
        colors: {
          'editor.background': '#FFFFFF'
        }
      });

      monaco.editor.setTheme('latex-theme');
      console.log('LaTeX language and theme configured');

      // Add selection change listener for chat integration
      if (onTextSelection) {
        editor.onDidChangeCursorSelection((e) => {
          // Debounce selection changes to prevent excessive updates
          clearTimeout(editor._selectionTimeout);
          editor._selectionTimeout = setTimeout(() => {
            const model = editor.getModel();
            if (model) {
              const selectedText = model.getValueInRange(e.selection);
              const startPos = model.getOffsetAt(e.selection.getStartPosition());
              const endPos = model.getOffsetAt(e.selection.getEndPosition());
              
              onTextSelection(selectedText, {
                start: startPos,
                end: endPos,
                startLine: e.selection.startLineNumber,
                endLine: e.selection.endLineNumber
              });
            }
          }, 150); // 150ms debounce
        });
      }

      // Add keyboard shortcut for chat toggle (Ctrl+I)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
        // This will be handled by the parent component
        console.log('Chat toggle shortcut pressed');
      });

      // Suppress ResizeObserver error handling
      const originalConsoleError = console.error;
      console.error = (...args) => {
        if (args[0] && args[0].includes && args[0].includes('ResizeObserver')) {
          // Ignore ResizeObserver errors
          return;
        }
        originalConsoleError.apply(console, args);
      };

    } catch (error) {
      console.error('Error configuring Monaco Editor:', error);
    }
  };

  const handleEditorChange = (value) => {
    console.log('Editor content changed, length:', value?.length || 0);
    setLatexCode(value || '');
  };

  // REMOVED: applyTextToEditor function - LaTeXEditor handles injection directly now

  // REMOVED: useEffect for setting up ref - Not needed anymore

  return (
    <div 
      className="flex flex-col bg-white" 
      style={{ 
        width: `${editorWidth}%`,
        transition: isResizing ? 'none' : 'width 0.3s ease'
      }}
    >
      <div className="bg-white border-b border-gray-200 px-4 py-2 h-9">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CodeBracketIcon className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              {activeFile?.name || 'Editor'}
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Show selection info */}
            {selectedText && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  {selectedText.length} chars selected
                </span>
              </div>
            )}
            
            {/* Chat Toggle Button */}
            <button 
              className="flex items-center space-x-1 p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              onClick={onToggleChat}
              title={isChatCollapsed ? "Open AI LaTeX Assistant" : "Close AI Assistant"}
            >
              <div className="relative">
                {/* Three magical stars representing AI */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-purple-500">
                  {/* Main star */}
                  <path d="M8 2L8.5 4.5L11 5L8.5 5.5L8 8L7.5 5.5L5 5L7.5 4.5L8 2Z" fill="currentColor" opacity="0.9" />
                  {/* Top right small star */}
                  <path d="M12 3L12.25 3.75L13 4L12.25 4.25L12 5L11.75 4.25L11 4L11.75 3.75L12 3Z" fill="currentColor" opacity="0.7" />
                  {/* Bottom left small star */}
                  <path d="M4 10L4.25 10.75L5 11L4.25 11.25L4 12L3.75 11.25L3 11L3.75 10.75L4 10Z" fill="currentColor" opacity="0.6" />
                </svg>
                {ragEnabled && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" title="RAG Mode Active"></div>
                )}
              </div>
              <span className="text-xs">AI Assistant</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language="latex"
          value={latexCode || defaultLatex}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          loading={<div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading editor...</div>
          </div>}
          options={{
            fontSize: 14,
            automaticLayout: true,
            wordWrap: 'on',
            selectOnLineNumbers: true,
            roundedSelection: false,
            readOnly: false,
            cursorStyle: 'line',
            // Disable some features during resize to prevent errors
            scrollBeyondLastLine: false,
            scrollbar: {
              // Reduce scrollbar updates during resize
              alwaysConsumeMouseWheel: false
            }
          }}
        />
        
        {/* Simplified debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-10 max-w-xs">
            <div>Content: {latexCode?.length || 0}</div>
            <div>Selected: {selectedText?.length || 0}</div>
            <div>Editor Ready: {editorRef.current ? '✅' : '❌'}</div>
            {isResizing && <div className="text-yellow-300">Resizing...</div>}
          </div>
        )}
      </div>

      {/* Compile Errors */}
      {compileErrors.length > 0 && (
        <div className="bg-red-50 border-t border-red-200 p-3 max-h-32 overflow-y-auto">
          <h4 className="text-sm font-medium text-red-800 mb-2">Compilation Errors:</h4>
          <ul className="text-sm text-red-700 space-y-1">
            {compileErrors.map((error, index) => (
              <li key={index} className="font-mono text-xs">• {error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default EditorPanel;
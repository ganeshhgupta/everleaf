import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import Editor from '@monaco-editor/react';
import { 
  CodeBracketIcon, 
  ChatBubbleLeftRightIcon,
  ScissorsIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const EditorPanel = forwardRef(({
  activeFile,
  latexCode,
  setLatexCode,
  compileErrors,
  editorWidth,
  // Text selection and chat integration
  onTextSelection,
  selectedText,
  selectionRange,
  isResizing,
  // Chat integration props
  isChatCollapsed,
  onToggleChat,
  ragEnabled,
  // Surgical editing props
  isProcessingSurgicalEdit,
  surgicalEditHistory,
  // NEW: Mobile-specific props (optional)
  isMobile,
  currentScreenMode
}, ref) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const [showSurgicalStatus, setShowSurgicalStatus] = useState(false);

  // Add this as a fallback
  const defaultLatex = `\\documentclass{article}
\\begin{document}
Hello World!
\\end{document}`;

  // EXPOSE: Inject text method to parent component
  useImperativeHandle(ref, () => ({
    injectText: (newText, range = null) => {
      console.log('🔧 EditorPanel: Direct text injection via Monaco Editor');
      console.log('   - newText:', newText?.substring(0, 100));
      console.log('   - range:', range);
      console.log('   - selectedText:', selectedText?.substring(0, 50));
      
      if (!editorRef.current || !monacoRef.current) {
        console.error('❌ Editor not ready for injection');
        return false;
      }

      const editor = editorRef.current;
      const monaco = monacoRef.current;
      const model = editor.getModel();
      
      if (!model) {
        console.error('❌ Editor model not available');
        return false;
      }

      try {
        let targetRange;
        
        if (range && range.start !== range.end && selectedText) {
          // Replace selected text
          console.log('🔄 Replacing selected text');
          const startPos = model.getPositionAt(range.start);
          const endPos = model.getPositionAt(range.end);
          targetRange = new monaco.Range(
            startPos.lineNumber, startPos.column,
            endPos.lineNumber, endPos.column
          );
        } else {
          // Smart insertion based on LaTeX document structure
          console.log('🔄 Smart LaTeX document insertion');
          const currentContent = model.getValue();
          
          // Check if current document has \begin{document} and \end{document}
          const hasBeginDoc = currentContent.includes('\\begin{document}');
          const hasEndDoc = currentContent.includes('\\end{document}');
          
          if (hasBeginDoc && hasEndDoc) {
            // Find position before \end{document}
            const endDocMatch = currentContent.match(/\\end\{document\}/);
            if (endDocMatch) {
              const endDocIndex = currentContent.indexOf(endDocMatch[0]);
              const endDocPos = model.getPositionAt(endDocIndex);
              
              // Insert before \end{document} with proper spacing
              const spacing = '\n\n';
              const textToInsert = spacing + newText + '\n';
              
              targetRange = new monaco.Range(
                endDocPos.lineNumber, 1,
                endDocPos.lineNumber, 1
              );
              
              editor.executeEdits('ai-injection', [{
                range: targetRange,
                text: textToInsert
              }]);
              
              console.log('✅ Text inserted before \\end{document}');
              return true;
            }
          }
          
          // Fallback: append to end
          const lastLine = model.getLineCount();
          const lastColumn = model.getLineMaxColumn(lastLine);
          targetRange = new monaco.Range(lastLine, lastColumn, lastLine, lastColumn);
          
          const spacing = currentContent.trim() ? '\n\n' : '';
          const textToInsert = spacing + newText;
          
          editor.executeEdits('ai-injection', [{
            range: targetRange,
            text: textToInsert
          }]);
          
          console.log('✅ Text appended to end');
          return true;
        }
        
        if (targetRange) {
          // Execute the edit
          editor.executeEdits('ai-injection', [{
            range: targetRange,
            text: newText
          }]);
          
          // Move cursor to end of inserted text
          const newEndPos = model.getPositionAt(
            model.getOffsetAt(targetRange.getStartPosition()) + newText.length
          );
          editor.setPosition(newEndPos);
          editor.focus();
          
          console.log('✅ Text injection completed via Monaco Editor');
          return true;
        }
        
      } catch (error) {
        console.error('❌ Text injection failed:', error);
        return false;
      }
      
      return false;
    },
    
    // EXPOSE: Get current editor state
    getEditorState: () => ({
      content: editorRef.current?.getModel()?.getValue() || '',
      selection: editorRef.current?.getSelection(),
      position: editorRef.current?.getPosition(),
      isReady: !!editorRef.current
    }),
    
    // EXPOSE: Focus editor
    focus: () => {
      editorRef.current?.focus();
    }
  }));

  // Debug: Log the current state
  useEffect(() => {
    console.log('EditorPanel - latexCode length:', latexCode?.length || 0);
    console.log('EditorPanel - activeFile:', activeFile?.name);
    console.log('EditorPanel - isProcessingSurgicalEdit:', isProcessingSurgicalEdit);
  }, [latexCode, activeFile, isProcessingSurgicalEdit]);

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

  // Show surgical status briefly when edits occur
  useEffect(() => {
    if (surgicalEditHistory && surgicalEditHistory.length > 0) {
      setShowSurgicalStatus(true);
      const timer = setTimeout(() => setShowSurgicalStatus(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [surgicalEditHistory]);

  const handleEditorDidMount = (editor, monaco) => {
    console.log('Monaco Editor mounted successfully');
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    try {
      // Configure LaTeX language
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

      // Configure editor theme with surgical editing indicators
      monaco.editor.defineTheme('latex-surgical-theme', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
          { token: 'comment', foreground: '008000', fontStyle: 'italic' },
          { token: 'string', foreground: 'A31515' },
          { token: 'delimiter', foreground: '800080' }
        ],
        colors: {
          'editor.background': isProcessingSurgicalEdit ? '#f8f9ff' : '#FFFFFF',
          'editor.selectionBackground': isProcessingSurgicalEdit ? '#e0e7ff' : '#ADD6FF'
        }
      });

      monaco.editor.setTheme('latex-surgical-theme');
      console.log('LaTeX language and surgical theme configured');

      // Add selection change listener for chat integration (desktop only)
      if (onTextSelection && !isMobile) {
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

      // Add keyboard shortcut for chat toggle (Ctrl+I) - desktop only
      if (!isMobile) {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
          console.log('Chat toggle shortcut pressed');
        });
      }

      // NEW: Add surgical editing decorations
      if (isProcessingSurgicalEdit) {
        const model = editor.getModel();
        if (model && selectedText && selectionRange) {
          const startPos = model.getPositionAt(selectionRange.start);
          const endPos = model.getPositionAt(selectionRange.end);
          
          const decorations = editor.deltaDecorations([], [{
            range: new monaco.Range(
              startPos.lineNumber, startPos.column,
              endPos.lineNumber, endPos.column
            ),
            options: {
              className: 'surgical-edit-highlight',
              hoverMessage: { value: 'Surgical edit in progress...' },
              glyphMarginClassName: 'surgical-edit-glyph'
            }
          }]);
          
          // Store decorations for cleanup
          editor._surgicalDecorations = decorations;
        }
      } else if (editor._surgicalDecorations) {
        // Clear surgical decorations
        editor.deltaDecorations(editor._surgicalDecorations, []);
        editor._surgicalDecorations = null;
      }

      // Suppress ResizeObserver error handling
      const originalConsoleError = console.error;
      console.error = (...args) => {
        if (args[0] && args[0].includes && args[0].includes('ResizeObserver')) {
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

  // NEW: Render surgical editing status
  const renderSurgicalStatus = () => {
    if (!showSurgicalStatus && !isProcessingSurgicalEdit) return null;

    const lastEdit = surgicalEditHistory && surgicalEditHistory.length > 0 
      ? surgicalEditHistory[surgicalEditHistory.length - 1] 
      : null;

    return (
      <div className={`absolute ${isMobile ? 'top-4 left-4 right-4' : 'top-2 right-2'} z-20 p-2 rounded-lg shadow-lg transition-all duration-300 ${
        isProcessingSurgicalEdit 
          ? 'bg-blue-100 border border-blue-300'
          : lastEdit?.validation?.overallValid !== false
          ? 'bg-green-100 border border-green-300'
          : 'bg-red-100 border border-red-300'
      }`}>
        <div className="flex items-center space-x-2">
          {isProcessingSurgicalEdit ? (
            <>
              <ScissorsIcon className="w-4 h-4 text-blue-600 animate-pulse" />
              <div className="text-sm">
                <div className="font-medium text-blue-800">Surgical Edit</div>
                <div className="text-xs text-blue-600">Processing...</div>
              </div>
            </>
          ) : lastEdit ? (
            <>
              {lastEdit.validation?.overallValid !== false ? (
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
              ) : (
                <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />
              )}
              <div className="text-sm">
                <div className={`font-medium ${
                  lastEdit.validation?.overallValid !== false ? 'text-green-800' : 'text-red-800'
                }`}>
                  {lastEdit.changes.action || 'Edit'} {lastEdit.validation?.overallValid !== false ? 'Applied' : 'Failed'}
                </div>
                <div className={`text-xs ${
                  lastEdit.validation?.overallValid !== false ? 'text-green-600' : 'text-red-600'
                }`}>
                  {lastEdit.changes.deltaLength > 0 ? '+' : ''}{lastEdit.changes.deltaLength} chars
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  // NEW: Mobile-specific rendering
  if (isMobile) {
    return (
      <div className={`flex flex-col bg-white relative transition-all duration-200 h-full ${
        isProcessingSurgicalEdit ? 'bg-gradient-to-b from-blue-50 to-white' : ''
      }`}>
        {/* Mobile Editor Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <CodeBracketIcon className="w-5 h-5 text-gray-600" />
            <span className="text-lg font-semibold text-gray-900">
              {activeFile?.name || 'Editor'}
            </span>
            {/* Mobile surgical editing indicator */}
            {isProcessingSurgicalEdit && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 rounded-full text-sm">
                <ScissorsIcon className="w-4 h-4 text-blue-600 animate-pulse" />
                <span className="text-blue-800 font-medium">Surgical Edit</span>
              </div>
            )}
          </div>
          
          {/* Mobile selection info */}
          {selectedText && (
            <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
              {selectedText.length} chars selected
            </div>
          )}
        </div>
        
        {/* Mobile Editor Content */}
        <div className="flex-1 relative">
          {/* Mobile surgical editing status overlay */}
          {renderSurgicalStatus()}
          
          <Editor
            height="100%"
            language="latex"
            value={latexCode || defaultLatex}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            loading={<div className="flex items-center justify-center h-full">
              <div className="text-gray-500 text-center">
                <div className="text-lg mb-2">
                  {isProcessingSurgicalEdit ? 'Preparing surgical editing...' : 'Loading editor...'}
                </div>
              </div>
            </div>}
            options={{
              fontSize: isMobile ? 16 : 14, // Larger font on mobile
              automaticLayout: true,
              wordWrap: 'on',
              selectOnLineNumbers: true,
              roundedSelection: false,
              readOnly: isProcessingSurgicalEdit,
              cursorStyle: 'line',
              scrollBeyondLastLine: false,
              scrollbar: {
                alwaysConsumeMouseWheel: false,
                verticalScrollbarSize: isMobile ? 12 : 10, // Larger scrollbar on mobile
                horizontalScrollbarSize: isMobile ? 12 : 10
              },
              minimap: {
                enabled: false // Always disabled on mobile
              },
              lineNumbers: 'on',
              renderLineHighlight: isProcessingSurgicalEdit ? 'none' : 'line',
              selectionHighlight: !isProcessingSurgicalEdit,
              // Mobile-specific options
              contextmenu: false, // Disable context menu on mobile
              quickSuggestions: false, // Disable quick suggestions on mobile
              parameterHints: { enabled: false }, // Disable parameter hints on mobile
              suggestOnTriggerCharacters: false, // Disable auto-suggest on mobile
              acceptSuggestionOnEnter: 'off', // Disable enter to accept suggestions
              tabCompletion: 'off', // Disable tab completion
              wordBasedSuggestions: false, // Disable word-based suggestions
              links: false, // Disable clickable links
              colorDecorators: false, // Disable color decorators
              codeLens: false // Disable code lens
            }}
          />
          
          {/* Mobile surgical editing overlay */}
          {isProcessingSurgicalEdit && (
            <div className="absolute inset-0 bg-blue-50 bg-opacity-40 flex items-center justify-center pointer-events-none z-10">
              <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-200 flex flex-col items-center space-y-3 mx-4">
                <ScissorsIcon className="w-8 h-8 text-blue-600 animate-pulse" />
                <div className="text-center">
                  <div className="font-semibold text-blue-800 text-lg">Surgical Edit in Progress</div>
                  <div className="text-sm text-blue-600 mt-1">
                    Analyzing document structure and applying precise changes...
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Compile Errors */}
        {compileErrors.length > 0 && (
          <div className="bg-red-50 border-t border-red-200 p-4 max-h-40 overflow-y-auto flex-shrink-0">
            <h4 className="text-sm font-semibold text-red-800 mb-3">Compilation Errors:</h4>
            <ul className="text-sm text-red-700 space-y-2">
              {compileErrors.map((error, index) => (
                <li key={index} className="font-mono text-xs bg-red-100 p-2 rounded">
                  • {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mobile Surgical Edit History Panel */}
        {surgicalEditHistory && surgicalEditHistory.length > 0 && !isProcessingSurgicalEdit && (
          <div className="bg-gray-50 border-t border-gray-200 p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Recent Surgical Edits</span>
              <span className="text-xs text-gray-500">{surgicalEditHistory.length} total</span>
            </div>
            <div className="flex space-x-2 overflow-x-auto">
              {surgicalEditHistory.slice(-3).map((edit, index) => (
                <div 
                  key={edit.id} 
                  className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs border ${
                    edit.validation?.overallValid !== false
                      ? 'bg-green-100 border-green-300 text-green-800'
                      : 'bg-red-100 border-red-300 text-red-800'
                  }`}
                  title={`${edit.changes.action || 'Edit'}: ${edit.message}`}
                >
                  <div className="flex items-center space-x-2">
                    {edit.validation?.overallValid !== false ? (
                      <CheckCircleIcon className="w-4 h-4" />
                    ) : (
                      <ExclamationTriangleIcon className="w-4 h-4" />
                    )}
                    <div>
                      <div className="font-medium">
                        {edit.changes.action || 'Edit'}
                      </div>
                      <div className="text-xs opacity-75">
                        {edit.changes.deltaLength > 0 ? '+' : ''}{edit.changes.deltaLength}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mobile CSS for surgical editing styles */}
        <style jsx>{`
          .surgical-edit-highlight {
            background-color: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 3px;
          }
          
          .surgical-edit-glyph {
            background-color: rgba(59, 130, 246, 0.8);
            width: 3px !important;
            border-radius: 2px;
          }
          
          .surgical-edit-glyph:before {
            content: "🔪";
            font-size: 10px;
            color: white;
            position: absolute;
            left: 2px;
            top: 50%;
            transform: translateY(-50%);
          }
        `}</style>
      </div>
    );
  }

  // DESKTOP LAYOUT (unchanged from original)
  return (
    <div 
      className={`flex flex-col bg-white relative transition-all duration-200 ${
        isProcessingSurgicalEdit ? 'bg-gradient-to-b from-blue-50 to-white' : ''
      }`}
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
            {/* NEW: Surgical editing indicator */}
            {isProcessingSurgicalEdit && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 rounded text-xs">
                <ScissorsIcon className="w-3 h-3 text-blue-600 animate-pulse" />
                <span className="text-blue-800 font-medium">Surgical Edit</span>
              </div>
            )}
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
            
            {/* NEW: Surgical edit history indicator */}
            {surgicalEditHistory && surgicalEditHistory.length > 0 && (
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <ScissorsIcon className="w-3 h-3" />
                <span>{surgicalEditHistory.length} edits</span>
              </div>
            )}
            
            {/* Chat Toggle Button */}
            <button 
              className="flex items-center space-x-1 p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              onClick={onToggleChat}
              title={isChatCollapsed ? "Open AI LaTeX Assistant" : "Close AI Assistant"}
            >
              <div className="relative">
                {/* Enhanced AI icon with surgical indicator */}
                <SparklesIcon className="w-4 h-4 text-purple-500" />
                {ragEnabled && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" title="RAG Mode Active"></div>
                )}
                {isProcessingSurgicalEdit && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Surgical Edit Active"></div>
                )}
              </div>
              <span className="text-xs">
                {isProcessingSurgicalEdit ? 'Surgical AI' : 'AI Assistant'}
              </span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 relative">
        {/* NEW: Surgical editing status overlay */}
        {renderSurgicalStatus()}
        
        <Editor
          height="100%"
          language="latex"
          value={latexCode || defaultLatex}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          loading={<div className="flex items-center justify-center h-full">
            <div className="text-gray-500">
              {isProcessingSurgicalEdit ? 'Preparing surgical editing...' : 'Loading editor...'}
            </div>
          </div>}
          options={{
            fontSize: 14,
            automaticLayout: true,
            wordWrap: 'on',
            selectOnLineNumbers: true,
            roundedSelection: false,
            readOnly: isProcessingSurgicalEdit, // Prevent editing during surgical operations
            cursorStyle: 'line',
            scrollBeyondLastLine: false,
            scrollbar: {
              alwaysConsumeMouseWheel: false
            },
            // NEW: Enhanced options for surgical editing
            minimap: {
              enabled: !isProcessingSurgicalEdit // Hide minimap during surgical edits
            },
            lineNumbers: 'on',
            renderLineHighlight: isProcessingSurgicalEdit ? 'none' : 'line',
            selectionHighlight: !isProcessingSurgicalEdit
          }}
        />
        
        {/* NEW: Surgical editing overlay */}
        {isProcessingSurgicalEdit && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-30 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-white rounded-lg shadow-lg p-4 border border-blue-200 flex items-center space-x-3">
              <ScissorsIcon className="w-6 h-6 text-blue-600 animate-pulse" />
              <div>
                <div className="font-medium text-blue-800">Surgical Edit in Progress</div>
                <div className="text-sm text-blue-600">
                  Analyzing document structure and applying precise changes...
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Enhanced debug info with surgical editing status */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-10 max-w-xs">
            <div>Content: {latexCode?.length || 0}</div>
            <div>Selected: {selectedText?.length || 0}</div>
            <div>Editor Ready: {editorRef.current ? '✅' : '❌'}</div>
            {isResizing && <div className="text-yellow-300">Resizing...</div>}
            {/* NEW: Surgical editing debug info */}
            {isProcessingSurgicalEdit && (
              <div className="text-orange-300">🔪 Surgical Edit Active</div>
            )}
            {surgicalEditHistory && surgicalEditHistory.length > 0 && (
              <div className="text-green-300">
                📊 {surgicalEditHistory.length} surgical edits
              </div>
            )}
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

      {/* NEW: Surgical Edit History Panel (bottom) */}
      {surgicalEditHistory && surgicalEditHistory.length > 0 && !isProcessingSurgicalEdit && (
        <div className="bg-gray-50 border-t border-gray-200 p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-700">Recent Surgical Edits</span>
            <span className="text-xs text-gray-500">{surgicalEditHistory.length} total</span>
          </div>
          <div className="flex space-x-2 overflow-x-auto">
            {surgicalEditHistory.slice(-5).map((edit, index) => (
              <div 
                key={edit.id} 
                className={`flex-shrink-0 px-2 py-1 rounded text-xs border ${
                  edit.validation?.overallValid !== false
                    ? 'bg-green-100 border-green-300 text-green-800'
                    : 'bg-red-100 border-red-300 text-red-800'
                }`}
                title={`${edit.changes.action || 'Edit'}: ${edit.message}`}
              >
                <div className="flex items-center space-x-1">
                  {edit.validation?.overallValid !== false ? (
                    <CheckCircleIcon className="w-3 h-3" />
                  ) : (
                    <ExclamationTriangleIcon className="w-3 h-3" />
                  )}
                  <span className="font-medium">
                    {edit.changes.action || 'Edit'}
                  </span>
                  <span className="text-xs opacity-75">
                    {edit.changes.deltaLength > 0 ? '+' : ''}{edit.changes.deltaLength}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NEW: Add CSS for surgical editing styles */}
      <style jsx>{`
        .surgical-edit-highlight {
          background-color: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 3px;
        }
        
        .surgical-edit-glyph {
          background-color: rgba(59, 130, 246, 0.8);
          width: 3px !important;
          border-radius: 2px;
        }
        
        .surgical-edit-glyph:before {
          content: "🔪";
          font-size: 10px;
          color: white;
          position: absolute;
          left: 2px;
          top: 50%;
          transform: translateY(-50%);
        }
      `}</style>
    </div>
  );
});

export default EditorPanel;
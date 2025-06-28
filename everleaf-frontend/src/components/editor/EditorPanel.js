import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { CodeBracketIcon } from '@heroicons/react/24/outline';

const EditorPanel = ({
  activeFile,
  latexCode,
  setLatexCode,
  compileErrors,
  editorWidth
}) => {
  const editorRef = useRef(null);

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

  const handleEditorDidMount = (editor, monaco) => {
    console.log('Monaco Editor mounted successfully');
    editorRef.current = editor;
    
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
    } catch (error) {
      console.error('Error configuring Monaco Editor:', error);
    }
  };

  const handleEditorChange = (value) => {
    console.log('Editor content changed, length:', value?.length || 0);
    setLatexCode(value || '');
  };

  return (
    <div className="flex flex-col bg-white" style={{ width: `${editorWidth}%` }}>
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center space-x-2">
          <CodeBracketIcon className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {activeFile?.name || 'Editor'}
          </span>
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
            wordWrap: 'on'
          }}
        />
        
        {/* Debug info - remove this once working */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
            Content length: {latexCode?.length || 0}
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
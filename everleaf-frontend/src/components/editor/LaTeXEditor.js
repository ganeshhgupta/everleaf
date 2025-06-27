import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Editor from '@monaco-editor/react';
import {
  PlayIcon,
  DocumentArrowDownIcon,
  FolderOpenIcon,
  DocumentTextIcon,
  PlusIcon,
  Bars3Icon,
  XMarkIcon,
  EyeIcon,
  CodeBracketIcon,
  ShareIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

const LaTeXEditor = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
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

  // Refs
  const editorRef = useRef(null);

  // Sample LaTeX content for demo
  const sampleLatex = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{My Research Paper}
\\author{${user?.firstName} ${user?.lastName}}
\\date{\\today}

\\begin{document}

\\maketitle

\\tableofcontents
\\newpage

\\section{Introduction}
This is the introduction to my research paper. We explore the fundamental concepts and provide background information necessary for understanding our methodology.

\\section{Literature Review}
Previous work in this field has established several key principles:
\\begin{itemize}
    \\item First principle of research
    \\item Second important finding
    \\item Third major contribution
\\end{itemize}

\\section{Methodology}
Here I describe the methodology used in this research.

\\subsection{Data Collection}
The data was collected using the following methods:
\\begin{enumerate}
    \\item Surveys distributed to 500+ participants
    \\item In-depth interviews with domain experts  
    \\item Direct observations over 6-month period
\\end{enumerate}

\\subsection{Analysis Framework}
Our analysis follows a structured approach:

\\begin{equation}
\\text{Accuracy} = \\frac{TP + TN}{TP + TN + FP + FN}
\\end{equation}

Where:
\\begin{itemize}
    \\item $TP$ = True Positives
    \\item $TN$ = True Negatives  
    \\item $FP$ = False Positives
    \\item $FN$ = False Negatives
\\end{itemize}

\\section{Results}
The results of our analysis are shown below:

\\begin{equation}
E = mc^2
\\end{equation}

This fundamental equation demonstrates the relationship between energy and mass.

\\begin{table}[h]
\\centering
\\begin{tabular}{|c|c|c|}
\\hline
Method & Accuracy & Time (ms) \\\\
\\hline
Algorithm A & 94.2\\% & 1.2 \\\\
Algorithm B & 96.8\\% & 2.1 \\\\
Algorithm C & 92.1\\% & 0.8 \\\\
\\hline
\\end{tabular}
\\caption{Performance comparison of different algorithms}
\\label{tab:performance}
\\end{table}

\\section{Discussion}
The results indicate significant improvements over baseline methods. Key findings include:

\\begin{itemize}
    \\item 15\\% improvement in accuracy
    \\item 40\\% reduction in processing time
    \\item Better scalability for large datasets
\\end{itemize}

\\section{Conclusion}
In conclusion, this research demonstrates the effectiveness of our proposed approach. Future work will focus on:
\\begin{enumerate}
    \\item Extension to multi-modal data
    \\item Real-time processing capabilities
    \\item Integration with existing systems
\\end{enumerate}

\\section*{Acknowledgments}
We thank the research team and funding agencies for their support.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}`;

  const sampleBibliography = `@article{smith2023,
  title={Advanced Methods in Data Analysis},
  author={Smith, John and Doe, Jane},
  journal={Journal of Computer Science},
  volume={45},
  number={3},
  pages={123--145},
  year={2023},
  publisher={Academic Press}
}

@book{johnson2022,
  title={Machine Learning Fundamentals},
  author={Johnson, Alice},
  publisher={Tech Publications},
  year={2022},
  address={New York}
}

@inproceedings{brown2023,
  title={Scalable Algorithms for Big Data},
  author={Brown, Bob and Wilson, Carol},
  booktitle={Proceedings of the International Conference on Data Science},
  pages={78--85},
  year={2023},
  organization={IEEE}
}`;

  useEffect(() => {
    // Initialize editor with sample content
    setLatexCode(sampleLatex);
    
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
  }, [projectId, user]);

  const handleCompile = async () => {
    setIsCompiling(true);
    setCompileErrors([]);
    
    try {
      // Get token from cookies (since that's how your app stores it)
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

      console.log('🔧 Starting compilation with token:', token ? 'present' : 'missing');
      
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

      console.log('📡 Compilation response status:', response.status);

      if (response.ok) {
        // PDF compilation successful
        const blob = await response.blob();
        const pdfObjectUrl = URL.createObjectURL(blob);
        setPdfUrl(pdfObjectUrl);
        setCompileErrors([]);
        console.log('✅ PDF generated successfully');
      } else {
        // Compilation failed
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
  };

  const handleFileSelect = (file) => {
    setActiveFile(file);
    // TODO: Load file content from backend
    if (file.name === 'main.tex') {
      setLatexCode(sampleLatex);
    } else if (file.name === 'references.bib') {
      setLatexCode(sampleBibliography);
    } else if (file.name.endsWith('.tex')) {
      // Sample chapter content
      setLatexCode(`\\section{${file.name.replace('.tex', '').charAt(0).toUpperCase() + file.name.replace('.tex', '').slice(1)}}

This is the content for the ${file.name.replace('.tex', '')} section.

\\subsection{Overview}
Add your content here...

\\subsection{Details}
More detailed information...
`);
    }
  };

  const toggleFolder = (folderName) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderName)) {
      newExpanded.delete(folderName);
    } else {
      newExpanded.add(folderName);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileTree = (files, level = 0) => {
    return files.map(file => (
      <div key={file.id} style={{ paddingLeft: `${level * 12}px` }}>
        {file.type === 'folder' ? (
          <div>
            <div 
              className="flex items-center space-x-1 px-2 py-1 hover:bg-gray-100 cursor-pointer"
              onClick={() => toggleFolder(file.name)}
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
            onClick={() => handleFileSelect(file)}
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

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Configure LaTeX language (Monaco doesn't have built-in LaTeX support)
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
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span className="text-sm">Back to Dashboard</span>
            </button>
            
            <div className="h-6 w-px bg-gray-300"></div>
            
            <h1 className="text-lg font-semibold text-gray-900">
              {project?.title || 'LaTeX Editor'}
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCompile}
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
            
            <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
              <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
              Download
            </button>
            
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

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File Tree */}
        {sidebarOpen && (
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">Files</h3>
                <button className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {renderFileTree(files)}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* LaTeX Editor */}
          <div className="flex-1 flex flex-col">
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
                value={latexCode}
                onChange={setLatexCode}
                onMount={handleEditorDidMount}
                options={{
                  fontSize: 14,
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  lineHeight: 1.6,
                  wordWrap: 'on',
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  insertSpaces: true,
                  renderWhitespace: 'selection',
                  bracketPairColorization: { enabled: true }
                }}
              />
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

          {/* PDF Preview */}
          <div className="w-1/2 bg-white border-l border-gray-200 flex flex-col">
            <div className="bg-white border-b border-gray-200 px-4 py-2">
              <div className="flex items-center space-x-2">
                <EyeIcon className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Preview</span>
              </div>
            </div>
            
            <div className="flex-1 bg-gray-100 flex items-center justify-center">
              {pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border-0"
                  title="LaTeX PDF Preview"
                />
              ) : (
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <DocumentTextIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm mb-2">
                    {isCompiling ? 'Compiling LaTeX document...' : 'Click "Compile" to generate PDF preview'}
                  </p>
                  {isCompiling && (
                    <div className="w-8 h-8 border-2 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaTeXEditor;
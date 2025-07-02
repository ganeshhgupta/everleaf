const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

// Main LaTeX compilation (using direct TexLive instead of Docker)
const compileLatex = async (req, res) => {
  let workDir = null;
  
  try {
    const { files } = req.body;
    const projectId = req.params.projectId;
    
    console.log(`🔧 Starting TexLive compilation for project ${projectId}`);
    
    // Validate input
    if (!files || !files['main.tex']) {
      return res.status(400).json({
        success: false,
        errors: [{ 
          type: 'validation',
          message: 'main.tex file is required',
          line: null,
          file: 'main.tex',
          context: null,
          suggestion: 'Make sure your main LaTeX file is named "main.tex"'
        }]
      });
    }
    
    // Create unique compilation directory in temp
    const compilationId = uuidv4();
    workDir = path.join('/tmp/latex', compilationId);
    
    console.log(`📁 Creating work directory: ${workDir}`);
    await fs.mkdir(workDir, { recursive: true });
    
    // Write LaTeX files to temp directory
    console.log(`📝 Writing ${Object.keys(files).length} files to disk`);
    for (const [filename, content] of Object.entries(files)) {
      const filePath = path.join(workDir, filename);
      
      // Handle subdirectories (e.g., images/figure.png)
      const dirname = path.dirname(filePath);
      if (dirname !== workDir) {
        await fs.mkdir(dirname, { recursive: true });
      }
      
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`✅ Written: ${filename} (${content.length} chars)`);
    }
    
    // Check document complexity for multiple passes
    const mainTexContent = files['main.tex'];
    const needsMultiplePasses = isComplexDocument(mainTexContent);
    
    let compilationSuccess = false;
    let stdout = '';
    let stderr = '';
    let finalExitCode = 0;
    
    if (needsMultiplePasses) {
      console.log(`📚 Complex document detected, running multiple compilation passes`);
      
      // Run pdflatex multiple times for complex documents
      const passes = ['pdflatex', 'pdflatex', 'pdflatex'];
      
      for (let i = 0; i < passes.length; i++) {
        console.log(`🔄 Running compilation pass ${i + 1}/${passes.length}`);
        
        const result = await runDirectLatexCompilation(workDir, passes[i]);
        stdout += `\n=== PASS ${i + 1} OUTPUT ===\n` + result.stdout;
        stderr += `\n=== PASS ${i + 1} STDERR ===\n` + result.stderr;
        
        if (result.code !== 0 && i === 0) {
          // If first pass fails completely, break
          finalExitCode = result.code;
          break;
        }
        
        if (i === passes.length - 1) {
          compilationSuccess = result.code === 0;
          finalExitCode = result.code;
        }
      }
    } else {
      console.log(`📄 Simple document, running single compilation pass`);
      const result = await runDirectLatexCompilation(workDir, 'pdflatex');
      stdout = result.stdout;
      stderr = result.stderr;
      compilationSuccess = result.code === 0;
      finalExitCode = result.code;
    }
    
    // Check if PDF was generated successfully
    const pdfPath = path.join(workDir, 'main.pdf');
    const pdfExists = await fs.access(pdfPath).then(() => true).catch(() => false);
    
    if (pdfExists && compilationSuccess) {
      console.log(`✅ PDF generated successfully: ${pdfPath}`);
      
      // Read and send PDF file
      const pdfBuffer = await fs.readFile(pdfPath);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="compiled.pdf"');
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
      
    } else {
      console.log(`❌ PDF generation failed`);
      console.log(`📋 Exit code: ${finalExitCode}`);
      console.log(`📋 Stdout:`, stdout.substring(0, 1000));
      console.log(`📋 Stderr:`, stderr.substring(0, 1000));
      
      // Parse errors from log file AND stdout with improved parsing
      const logPath = path.join(workDir, 'main.log');
      let logContent = '';
      
      try {
        logContent = await fs.readFile(logPath, 'utf8');
      } catch (e) {
        logContent = stderr || stdout || 'No compilation output available';
      }
      
      // Add debug logging before parsing
      console.log('=== DEBUG: RAW LOG CONTENT ===');
      console.log('Log file exists:', !!logContent);
      console.log('Log content length:', logContent.length);
      console.log('First 500 chars of log:', logContent.substring(0, 500));
      console.log('Last 500 chars of log:', logContent.substring(Math.max(0, logContent.length - 500)));
      
      console.log('=== DEBUG: STDOUT CONTENT ===');
      console.log('Stdout length:', stdout.length);
      console.log('Stdout content:', stdout.substring(0, 1000));
      
      console.log('=== DEBUG: STDERR CONTENT ===');
      console.log('Stderr length:', stderr.length);
      console.log('Stderr content:', stderr.substring(0, 1000));

      // Improved error parsing that handles actual LaTeX log format
      const parsedErrors = parseLatexErrorsImproved(logContent, stdout, stderr, files);
      console.log(`🐛 Parsed ${parsedErrors.length} errors:`, JSON.stringify(parsedErrors, null, 2));
      
      res.status(400).json({
        success: false,
        errors: parsedErrors,
        logs: logContent.substring(0, 8000), // Increased log size
        stdout: stdout.substring(0, 3000),   // Increased stdout size
        stderr: stderr.substring(0, 3000),   // Increased stderr size
        exitCode: finalExitCode,
        suggestions: getCompilationSuggestions(mainTexContent, parsedErrors)
      });
    }
    
  } catch (error) {
    console.error('❌ LaTeX compilation error:', error);
    
    if (error.message.includes('timeout')) {
      return res.status(408).json({
        success: false,
        message: 'Compilation timeout',
        errors: [{
          type: 'timeout',
          message: 'Compilation timed out after 60 seconds',
          line: null,
          file: null,
          context: null,
          suggestion: 'Your document may be too complex or have infinite loops. Try simplifying it.'
        }]
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during compilation',
      errors: [{
        type: 'system',
        message: error.message,
        line: null,
        file: null,
        context: null,
        suggestion: 'This appears to be a server error. Please try again.'
      }]
    });
    
  } finally {
    // Cleanup temp files after delay
    if (workDir) {
      setTimeout(async () => {
        try {
          await fs.rm(workDir, { recursive: true, force: true });
          console.log(`🧹 Cleaned up work directory: ${workDir}`);
        } catch (e) {
          console.error('Failed to cleanup temp directory:', e);
        }
      }, 60000);
    }
  }
};

// System compilation (alias to main compilation)
const compileLatexSystem = async (req, res) => {
  console.log('🖥️ System compilation (using direct TexLive)');
  return compileLatex(req, res);
};

// Cloud compilation fallback (simplified)
const compileLatexCloud = async (req, res) => {
  try {
    const { files } = req.body;
    const projectId = req.params.projectId;
    
    console.log(`🌤️ Cloud compilation fallback for project ${projectId}`);
    
    // For cloud fallback, try to simplify the document first
    if (files && files['main.tex']) {
      const originalContent = files['main.tex'];
      const simplifiedContent = simplifyDocumentForCompatibility(originalContent);
      
      // Replace main.tex with simplified version
      const modifiedFiles = { ...files, 'main.tex': simplifiedContent };
      
      // Use the main compilation with simplified content
      req.body.files = modifiedFiles;
      return compileLatex(req, res);
    }
    
    return res.status(400).json({
      success: false,
      errors: [{
        type: 'validation',
        message: 'main.tex file is required for cloud compilation',
        line: null,
        file: 'main.tex',
        context: null,
        suggestion: 'Make sure your main LaTeX file is named "main.tex"'
      }]
    });
    
  } catch (error) {
    console.error('❌ Cloud compilation fallback error:', error);
    res.status(500).json({
      success: false,
      message: 'Cloud compilation fallback failed',
      errors: [{
        type: 'system',
        message: error.message,
        line: null,
        file: null,
        context: null,
        suggestion: 'Cloud compilation failed. Please try again.'
      }]
    });
  }
};

// Run direct LaTeX compilation with BOTH approaches for better error reporting
const runDirectLatexCompilation = async (workDir, command = 'pdflatex') => {
  // Use standard mode (without -file-line-error) for better error messages
  // The standard format provides more complete error information
  const args = [
    '-interaction=nonstopmode',
    '-halt-on-error',
    // Note: Removed '-file-line-error' as it can truncate error messages
    '-output-directory', workDir,
    'main.tex'
  ];
  
  console.log(`📝 Running direct TexLive: ${command} ${args.join(' ')}`);
  
  const latexProcess = spawn(command, args, {
    cwd: workDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      TEXMFHOME: '/tmp/texmf',
      TEXMFVAR: '/tmp/texmf-var',
      TEXMFCONFIG: '/tmp/texmf-config'
    }
  });
  
  let stdout = '';
  let stderr = '';
  
  latexProcess.stdout.on('data', (data) => {
    stdout += data.toString();
  });
  
  latexProcess.stderr.on('data', (data) => {
    stderr += data.toString();
  });
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      latexProcess.kill();
      reject(new Error('LaTeX compilation timeout after 60 seconds'));
    }, 60000);
    
    latexProcess.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
    
    latexProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
};

// IMPROVED ERROR PARSING - Handles actual LaTeX log format
const parseLatexErrorsImproved = (logContent, stdout, stderr, files = {}) => {
  console.log('🚀 === STARTING ERROR PARSING DEBUG ===');
  console.log('Input lengths - log:', logContent.length, 'stdout:', stdout.length, 'stderr:', stderr.length);
  
  const errors = [];
  const lines = logContent.split('\n');
  const fileLines = {};
  
  // Pre-process file contents for line context  
  Object.entries(files).forEach(([filename, content]) => {
    fileLines[filename] = content.split('\n');
    console.log(`📁 Processed file ${filename} with ${fileLines[filename].length} lines`);
  });
  
  let currentFile = 'main.tex';
  let i = 0;
  
  console.log('🔍 Starting improved error parsing...');
  console.log(`📄 Processing ${lines.length} lines of log output`);
  
  // Simple fallback: look for any lines that contain obvious error indicators
  const errorIndicators = [
    '! ',
    'Error:',
    'error:',
    'ERROR:',
    'Fatal error',
    'failed',
    'not found',
    'undefined',
    'Undefined'
  ];
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Check if this line contains any error indicators
    const hasErrorIndicator = errorIndicators.some(indicator => 
      trimmedLine.includes(indicator)
    );
    
    if (hasErrorIndicator) {
      console.log(`🚨 FOUND POTENTIAL ERROR at line ${index + 1}: "${trimmedLine}"`);
      
      // Simple error extraction
      let errorMessage = trimmedLine;
      let lineNumber = null;
      
      // Try to extract line number from various patterns
      const linePatterns = [
        /l\.(\d+)/,           // l.123
        /line (\d+)/i,        // line 123
        /:(\d+):/,            // file:123:
        /at line (\d+)/i      // at line 123
      ];
      
      for (const pattern of linePatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          lineNumber = parseInt(match[1]);
          console.log(`📍 Extracted line number: ${lineNumber}`);
          break;
        }
      }
      
      // Create simple error object
      const simpleError = {
        type: determineErrorTypeSimple(errorMessage),
        message: errorMessage,
        line: lineNumber,
        file: currentFile,
        context: lineNumber ? getLineContext(fileLines[currentFile] || [], lineNumber - 1) : null,
        suggestion: getSuggestionForError(errorMessage, null),
        rawLine: trimmedLine,
        sourceLineIndex: index + 1
      };
      
      errors.push(simpleError);
      console.log(`✅ Added simple error:`, JSON.stringify(simpleError, null, 2));
    }
  });
  
  // If still no errors, add lines containing common LaTeX error terms
  if (errors.length === 0) {
    console.log('⚠️ No obvious errors found, looking for LaTeX-specific terms...');
    
    const latexTerms = ['LaTeX', 'TeX', 'pdflatex', 'compilation'];
    const relevantLines = lines.filter(line => {
      const lowerLine = line.toLowerCase();
      return latexTerms.some(term => lowerLine.includes(term.toLowerCase())) ||
             line.trim().startsWith('!') ||
             line.includes('error') ||
             line.includes('Error');
    });
    
    console.log(`📋 Found ${relevantLines.length} potentially relevant lines:`);
    relevantLines.forEach((line, idx) => {
      console.log(`   ${idx + 1}: ${line.trim()}`);
    });
    
    if (relevantLines.length > 0) {
      errors.push({
        type: 'unknown',
        message: `Compilation failed. Relevant output: ${relevantLines.slice(0, 3).join(' | ')}`,
        line: null,
        file: 'main.tex',
        context: null,
        suggestion: 'Check the console output for more details about the compilation failure.',
        rawLine: relevantLines[0],
        allRelevantLines: relevantLines
      });
    }
  }
  
  // Also check stderr for system errors
  if (stderr && stderr.trim().length > 0) {
    console.log('🔍 Checking stderr for additional errors...');
    console.log('Stderr content:', stderr);
    
    const stderrLines = stderr.split('\n').filter(line => line.trim().length > 0);
    stderrLines.forEach(line => {
      if (line.includes('command not found') || 
          line.includes('No such file') || 
          line.includes('error') ||
          line.includes('Error')) {
        
        console.log(`🚨 Found stderr error: ${line}`);
        errors.push({
          type: 'system_error',
          message: `System error: ${line.trim()}`,
          line: null,
          file: null,
          context: null,
          suggestion: 'This appears to be a system error. Check if LaTeX is properly installed.',
          rawLine: line,
          source: 'stderr'
        });
      }
    });
  }
  
  // Final fallback - if absolutely no errors found
  if (errors.length === 0) {
    console.log('❌ NO ERRORS DETECTED - Adding generic fallback error');
    
    const lastLines = lines.slice(-10).filter(line => line.trim().length > 0);
    console.log('Last non-empty lines:', lastLines);
    
    errors.push({
      type: 'unknown',
      message: 'Compilation failed but no specific errors were detected in the log output.',
      line: null,
      file: 'main.tex',
      context: null,
      suggestion: 'Check your LaTeX syntax. The compilation process exited with an error but no clear cause was identified.',
      rawLine: 'No specific error line found',
      debugInfo: {
        logLength: logContent.length,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        lastLogLines: lastLines,
        hasLogContent: !!logContent,
        hasStdout: !!stdout,
        hasStderr: !!stderr
      }
    });
  }
  
  console.log(`🎯 FINAL RESULT: Found ${errors.length} errors`);
  errors.forEach((error, idx) => {
    console.log(`Error ${idx + 1}:`, {
      type: error.type,
      message: error.message.substring(0, 100) + (error.message.length > 100 ? '...' : ''),
      line: error.line,
      file: error.file
    });
  });
  
  console.log('🏁 === ENDING ERROR PARSING DEBUG ===');
  
  // Remove duplicates and limit
  const uniqueErrors = errors.filter((error, index, arr) => 
    arr.findIndex(e => e.message === error.message && e.line === error.line) === index
  );
  
  return uniqueErrors.slice(0, 20);
};

// Simple error type determination for debugging
const determineErrorTypeSimple = (errorMessage) => {
  const msg = errorMessage.toLowerCase();
  
  if (msg.includes('latex error:') || msg.includes('! latex error')) {
    return 'latex_error';
  }
  if (msg.includes('undefined control sequence') || msg.includes('undefined')) {
    return 'undefined_command';
  }
  if (msg.includes('missing $ inserted') || msg.includes('extra }') || msg.includes('math')) {
    return 'math_mode';
  }
  if (msg.includes('package') && msg.includes('error')) {
    return 'package_error';
  }
  if (msg.includes('environment') && msg.includes('undefined')) {
    return 'undefined_environment';
  }
  if (msg.includes('file') && (msg.includes('not found') || msg.includes('missing'))) {
    return 'missing_file';
  }
  if (msg.includes('runaway argument') || msg.includes('paragraph ended')) {
    return 'syntax';
  }
  if (msg.includes('command not found') || msg.includes('system')) {
    return 'system_error';
  }
  
  return 'compilation_error';
};

// Determine error type from error message content
const determineErrorType = (errorMessage) => {
  const msg = errorMessage.toLowerCase();
  
  if (msg.includes('latex error:')) {
    return 'latex_error';
  }
  if (msg.includes('undefined control sequence')) {
    return 'undefined_command';
  }
  if (msg.includes('missing $ inserted') || msg.includes('extra }')) {
    return 'math_mode';
  }
  if (msg.includes('package') && msg.includes('error')) {
    return 'package_error';
  }
  if (msg.includes('environment') && msg.includes('undefined')) {
    return 'undefined_environment';
  }
  if (msg.includes('file') && msg.includes('not found')) {
    return 'missing_file';
  }
  if (msg.includes('runaway argument') || msg.includes('paragraph ended')) {
    return 'syntax';
  }
  
  return 'compilation_error';
};

// Get line context around an error
const getLineContext = (fileLines, lineIndex) => {
  if (!fileLines || lineIndex < 0 || lineIndex >= fileLines.length) {
    return null;
  }
  
  const start = Math.max(0, lineIndex - 2);
  const end = Math.min(fileLines.length, lineIndex + 3);
  
  return {
    lines: fileLines.slice(start, end),
    errorLineIndex: lineIndex - start,
    startLine: start + 1
  };
};

// Get specific suggestions based on error type and content
const getSuggestionForError = (errorMsg, context) => {
  const msg = errorMsg.toLowerCase();
  
  if (msg.includes('undefined control sequence')) {
    return 'Check for typos in command names and ensure required packages are loaded.';
  }
  
  if (msg.includes('missing $ inserted') || msg.includes('math mode')) {
    return 'Wrap mathematical expressions in $ $ or use \\textunderscore for literal underscores.';
  }
  
  if (msg.includes('environment') && msg.includes('undefined')) {
    return 'Make sure you have loaded the package that defines this environment.';
  }
  
  if (msg.includes('file not found') || msg.includes('cannot find')) {
    return 'Check file paths and ensure all referenced files are uploaded.';
  }
  
  if (msg.includes('runaway argument') || msg.includes('paragraph ended')) {
    return 'Check for unmatched braces {} or missing closing brackets.';
  }
  
  if (msg.includes('missing \\begin{document}')) {
    return 'Make sure your document has \\begin{document} after the preamble.';
  }
  
  if (msg.includes('unknown graphics extension')) {
    return 'Use supported image formats: .png, .jpg, .pdf, .eps';
  }
  
  if (msg.includes('extra }') || msg.includes('extra alignment tab')) {
    return 'Check for extra closing braces } or misplaced & characters in tables.';
  }
  
  return 'Check the syntax around this line and ensure all commands are properly formatted.';
};

// Test TexLive environment (no Docker)
const testCloudServices = async (req, res) => {
  try {
    console.log('🧪 Testing direct TexLive environment...');
    
    // Test pdflatex availability
    const pdflatexTestResult = await new Promise((resolve) => {
      const latexProcess = spawn('pdflatex', ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      latexProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      latexProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      latexProcess.on('close', (code) => {
        resolve({
          success: code === 0,
          version: code === 0 ? stdout.trim() : null,
          error: code !== 0 ? (stderr || `Exit code: ${code}`) : null
        });
      });
      
      latexProcess.on('error', (error) => {
        resolve({
          success: false,
          version: null,
          error: error.message
        });
      });
    });
    
    console.log('TexLive test result:', pdflatexTestResult);
    
    // Test actual compilation with simple document
    let compilationTest = { success: false, error: 'Not tested' };
    
    if (pdflatexTestResult.success) {
      try {
        console.log('🧪 Testing actual LaTeX compilation...');
        
        // Create a simple test document
        const compilationId = uuidv4();
        const testWorkDir = path.join('/tmp/latex', 'test-' + compilationId);
        await fs.mkdir(testWorkDir, { recursive: true });
        
        const testLatex = `\\documentclass{article}
\\begin{document}
Hello World! Test compilation at ${new Date().toISOString()}
\\\\This is a test from direct TexLive integration.
\\end{document}`;
        
        await fs.writeFile(path.join(testWorkDir, 'main.tex'), testLatex, 'utf8');
        
        // Run actual TexLive compilation
        const testResult = await runDirectLatexCompilation(testWorkDir, 'pdflatex');
        
        // Check if PDF was created
        const testPdfPath = path.join(testWorkDir, 'main.pdf');
        const testPdfExists = await fs.access(testPdfPath).then(() => true).catch(() => false);
        
        if (testPdfExists && testResult.code === 0) {
          const testPdfBuffer = await fs.readFile(testPdfPath);
          compilationTest = {
            success: true,
            pdfSize: testPdfBuffer.length,
            exitCode: testResult.code
          };
          console.log(`✅ Test compilation successful, PDF size: ${testPdfBuffer.length} bytes`);
        } else {
          compilationTest = {
            success: false,
            error: `Compilation failed with exit code ${testResult.code}`,
            stdout: testResult.stdout.substring(0, 500),
            stderr: testResult.stderr.substring(0, 500)
          };
          console.log(`❌ Test compilation failed`);
        }
        
        // Cleanup test directory
        setTimeout(async () => {
          try {
            await fs.rm(testWorkDir, { recursive: true, force: true });
          } catch (e) {
            console.error('Test cleanup failed:', e);
          }
        }, 5000);
        
      } catch (error) {
        compilationTest = { success: false, error: error.message };
        console.error('❌ Test compilation error:', error);
      }
    }
    
    const overallSuccess = pdflatexTestResult.success && compilationTest.success;
    
    res.json({
      success: overallSuccess,
      environment: {
        pdflatex: pdflatexTestResult,
        compilation: compilationTest,
        platform: os.platform(),
        arch: os.arch()
      },
      message: overallSuccess 
        ? 'Direct TexLive environment is fully functional!' 
        : 'TexLive environment test completed with issues',
      recommendations: overallSuccess ? [] : [
        !pdflatexTestResult.success ? 'Ensure TexLive is properly installed' : null,
        !compilationTest.success ? 'Check TexLive installation and permissions' : null
      ].filter(Boolean)
    });
    
  } catch (error) {
    console.error('Environment test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Environment test failed',
      error: error.message
    });
  }
};

// Health check
const healthCheck = async (req, res) => {
  res.json({
    success: true,
    message: 'Direct TexLive controller is healthy',
    timestamp: new Date().toISOString(),
    compilation: 'Direct TexLive',
    version: '5.1.0',
    features: [
      'Direct TexLive compilation',
      'Multi-pass compilation for complex documents',
      'Container-native execution',
      'Improved LaTeX log parsing with line numbers',
      'Document complexity detection',
      'Contextual error suggestions',
      'Standard LaTeX error format parsing'
    ]
  });
};

// Helper Functions (keep existing ones)

// Check if document is complex and needs multiple passes
const isComplexDocument = (content) => {
  const complexFeatures = [
    '\\tableofcontents',
    '\\listoffigures',
    '\\listoftables',
    '\\bibliography',
    '\\cite{',
    '\\ref{',
    '\\label{',
    '\\pageref{',
    '\\index{',
    '\\glossary',
    '\\maketitle',
    '\\begin{figure}',
    '\\begin{table}'
  ];
  
  return complexFeatures.some(feature => content.includes(feature));
};

// Simplify document for better compatibility
const simplifyDocumentForCompatibility = (content) => {
  console.log('🔧 Simplifying document for better compatibility...');
  
  let simplified = content;
  
  // Remove problematic packages that might not be available
  const problematicPackages = [
    'hyperref', 'url', 'microtype', 'booktabs', 'longtable',
    'array', 'dcolumn', 'tabularx', 'ltxtable'
  ];
  
  problematicPackages.forEach(pkg => {
    const regex = new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{${pkg}\\}`, 'g');
    simplified = simplified.replace(regex, `% Removed ${pkg} package for compatibility`);
  });
  
  // Replace hyperref commands with simple text
  simplified = simplified.replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '$2 ($1)');
  simplified = simplified.replace(/\\url\{([^}]*)\}/g, '\\texttt{$1}');
  
  // Handle missing images gracefully
  simplified = simplified.replace(
    /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g,
    '\\textit{[Image: $1 - not available in compilation]}'
  );
  
  console.log('✅ Document simplified for compatibility');
  return simplified;
};

// Enhanced compilation suggestions based on document content and parsed errors
const getCompilationSuggestions = (content, parsedErrors = []) => {
  const suggestions = [];
  const errorTypes = parsedErrors.map(e => e.type);
  
  // Specific suggestions based on errors
  if (errorTypes.includes('missing_file')) {
    suggestions.push('📁 Upload all referenced files (images, .bib files, etc.)');
  }
  
  if (errorTypes.includes('package_error')) {
    suggestions.push('📦 Check package names and options - some packages may not be available');
  }
  
  if (errorTypes.includes('undefined_command')) {
    suggestions.push('🔧 Verify command spelling and ensure required packages are loaded');
  }
  
  if (errorTypes.includes('math_mode')) {
    suggestions.push('🧮 Check math expressions - use $ $ for inline math and $$ $$ for display math');
  }
  
  if (errorTypes.includes('syntax')) {
    suggestions.push('🔍 Check for unmatched braces, brackets, or missing delimiters');
  }
  
  // Content-based suggestions
  if (content.includes('\\includegraphics') && !suggestions.some(s => s.includes('📁'))) {
    suggestions.push('🖼️ Make sure all referenced image files are uploaded');
  }
  
  if (content.includes('\\cite{')) {
    suggestions.push('📚 Ensure bibliography files (.bib) are included');
  }
  
  if (content.includes('\\usepackage') && !suggestions.some(s => s.includes('📦'))) {
    suggestions.push('📦 Some packages may not be available - try removing non-essential packages');
  }
  
  if (content.includes('\\input{') || content.includes('\\include{')) {
    suggestions.push('📄 Make sure all referenced .tex files are uploaded');
  }
  
  if (content.includes('\\newcommand')) {
    suggestions.push('⚙️ Check custom command definitions for syntax errors');
  }
  
  // General suggestions if no specific ones
  if (suggestions.length === 0) {
    suggestions.push('🔍 Check LaTeX syntax and ensure all referenced files are available');
    suggestions.push('🧹 Try simplifying the document by removing complex packages');
    suggestions.push('📖 Look at the error details for specific line numbers and suggestions');
  }
  
  return suggestions.slice(0, 6); // Limit to 6 most relevant suggestions
};

module.exports = {
  compileLatex,
  compileLatexSystem,
  compileLatexCloud,
  testCloudServices,
  healthCheck
};
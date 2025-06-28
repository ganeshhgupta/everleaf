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
        errors: ['main.tex file is required']
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
    
    if (needsMultiplePasses) {
      console.log(`📚 Complex document detected, running multiple compilation passes`);
      
      // Run pdflatex multiple times for complex documents
      const passes = ['pdflatex', 'pdflatex', 'pdflatex'];
      
      for (let i = 0; i < passes.length; i++) {
        console.log(`🔄 Running compilation pass ${i + 1}/${passes.length}`);
        
        const result = await runDirectLatexCompilation(workDir, passes[i]);
        stdout += result.stdout;
        stderr += result.stderr;
        
        if (result.code !== 0 && i === 0) {
          // If first pass fails completely, break
          break;
        }
        
        if (i === passes.length - 1) {
          compilationSuccess = result.code === 0;
        }
      }
    } else {
      console.log(`📄 Simple document, running single compilation pass`);
      const result = await runDirectLatexCompilation(workDir, 'pdflatex');
      stdout = result.stdout;
      stderr = result.stderr;
      compilationSuccess = result.code === 0;
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
      console.log(`📋 Stdout:`, stdout.substring(0, 1000));
      console.log(`📋 Stderr:`, stderr.substring(0, 1000));
      
      // Parse errors from log or stdout/stderr
      const logPath = path.join(workDir, 'main.log');
      let logContent = '';
      
      try {
        logContent = await fs.readFile(logPath, 'utf8');
      } catch (e) {
        logContent = stderr || stdout || 'No compilation output';
      }
      
      const errors = parseLatexErrors(logContent);
      console.log(`🐛 Parsed errors:`, errors);
      
      res.status(400).json({
        success: false,
        errors: errors,
        logs: logContent.substring(0, 5000),
        stdout: stdout.substring(0, 2000),
        stderr: stderr.substring(0, 2000),
        suggestions: getCompilationSuggestions(mainTexContent)
      });
    }
    
  } catch (error) {
    console.error('❌ LaTeX compilation error:', error);
    
    if (error.message.includes('timeout')) {
      return res.status(408).json({
        success: false,
        message: 'Compilation timeout',
        errors: ['Compilation timed out after 60 seconds']
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during compilation',
      errors: [error.message]
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
      errors: ['main.tex file is required for cloud compilation']
    });
    
  } catch (error) {
    console.error('❌ Cloud compilation fallback error:', error);
    res.status(500).json({
      success: false,
      message: 'Cloud compilation fallback failed',
      errors: [error.message]
    });
  }
};

// Run direct LaTeX compilation (no Docker)
const runDirectLatexCompilation = async (workDir, command = 'pdflatex') => {
  const args = [
    '-interaction=nonstopmode',
    '-halt-on-error',
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
    version: '5.0.0',
    features: [
      'Direct TexLive compilation',
      'Multi-pass compilation for complex documents',
      'Container-native execution',
      'Comprehensive error parsing',
      'Document complexity detection'
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

const parseLatexErrors = (logContent) => {
  const errors = [];
  const lines = logContent.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // LaTeX errors
    if (line.startsWith('! ')) {
      const errorMsg = line.substring(2);
      errors.push(errorMsg);
    }
    
    // Line number errors
    if (line.match(/^l\.\d+/)) {
      const lineMatch = line.match(/^l\.(\d+)\s+(.*)$/);
      if (lineMatch) {
        errors.push(`Line ${lineMatch[1]}: ${lineMatch[2]}`);
      }
    }
    
    // LaTeX Error messages
    if (line.includes('! LaTeX Error:')) {
      errors.push(line.replace('! LaTeX Error:', 'LaTeX Error:'));
    }
    
    // Package errors
    if (line.includes('! Package')) {
      errors.push(line);
    }
    
    // Missing file errors
    if (line.includes('No such file or directory')) {
      errors.push('Missing file: ' + line);
    }
  }
  
  if (errors.length === 0) {
    errors.push('Compilation failed - check document syntax and packages');
  }
  
  return errors.slice(0, 10); // Limit to 10 most relevant errors
};

// Get compilation suggestions based on document content
const getCompilationSuggestions = (content) => {
  const suggestions = [];
  
  if (content.includes('\\includegraphics')) {
    suggestions.push('Make sure all referenced image files are uploaded');
  }
  
  if (content.includes('\\cite{')) {
    suggestions.push('Ensure bibliography files (.bib) are included');
  }
  
  if (content.includes('\\usepackage')) {
    suggestions.push('Some packages may not be available - try removing non-essential packages');
  }
  
  if (content.includes('\\input{') || content.includes('\\include{')) {
    suggestions.push('Make sure all referenced .tex files are uploaded');
  }
  
  if (content.includes('\\newcommand')) {
    suggestions.push('Check custom command definitions for syntax errors');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Check LaTeX syntax and ensure all referenced files are available');
    suggestions.push('Try simplifying the document by removing complex packages');
  }
  
  return suggestions;
};

module.exports = {
  compileLatex,
  compileLatexSystem,
  compileLatexCloud,
  testCloudServices,
  healthCheck
};
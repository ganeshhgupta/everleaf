import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  EyeIcon, 
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowLeftIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  NoSymbolIcon,
  CogIcon,
  DocumentDuplicateIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';

const PDFPreview = ({
  pdfUrl,
  isCompiling,
  editorWidth,
  compileErrors = [], // Enhanced error objects with more details
  // NEW: Mobile-specific props (optional)
  isMobile,
  mobilePreviewMode,
  onMobileClose
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [renderedPages, setRenderedPages] = useState(new Map());
  const [renderingPages, setRenderingPages] = useState(new Set());
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showErrorOverlay, setShowErrorOverlay] = useState(false);
  const [selectedErrorIndex, setSelectedErrorIndex] = useState(0); // For detailed error view
  
  // NEW: Mobile header auto-hide state
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrollTimeout, setScrollTimeout] = useState(null);
  
  const containerRef = useRef(null);
  const canvasRefs = useRef(new Map());

  // Debounced zoom to prevent flickering
  const [zoomTimeout, setZoomTimeout] = useState(null);

  // Safe error rendering function
  const safeRender = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value.toString();
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return '[Complex Object]';
      }
    }
    return String(value);
  };

  // NEW: Enhanced error categorization
  const categorizeErrors = (errors) => {
    const categories = {
      critical: [],
      syntax: [],
      warnings: [],
      missing: []
    };
    
    errors.forEach(error => {
      switch (error.type) {
        case 'latex_error':
        case 'compilation_error':
        case 'system_error':
          categories.critical.push(error);
          break;
        case 'syntax':
        case 'undefined_command':
        case 'math_mode':
          categories.syntax.push(error);
          break;
        case 'warning':
          categories.warnings.push(error);
          break;
        case 'missing_file':
        case 'package_error':
          categories.missing.push(error);
          break;
        default:
          categories.critical.push(error);
      }
    });
    
    return categories;
  };

  // Get error icon based on type
  const getErrorIcon = (errorType) => {
    switch (errorType) {
      case 'critical':
      case 'latex_error':
      case 'compilation_error':
      case 'system_error':
        return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
      case 'syntax':
      case 'undefined_command':
      case 'math_mode':
        return <CogIcon className="w-5 h-5 text-orange-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'missing_file':
      case 'package_error':
        return <NoSymbolIcon className="w-5 h-5 text-blue-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  // Get error color based on type
  const getErrorColor = (errorType) => {
    switch (errorType) {
      case 'critical':
      case 'latex_error':
      case 'compilation_error':
      case 'system_error':
        return 'red';
      case 'syntax':
      case 'undefined_command':
      case 'math_mode':
        return 'orange';
      case 'warning':
        return 'yellow';
      case 'missing_file':
      case 'package_error':
        return 'blue';
      default:
        return 'gray';
    }
  };

  // NEW: Mobile header auto-hide scroll handler
  useEffect(() => {
    if (!isMobile) return;

    const handleScroll = () => {
      const currentScrollY = containerRef.current?.scrollTop || 0;
      
      // Show header when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsHeaderVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsHeaderVisible(false);
      }
      
      setLastScrollY(currentScrollY);
      
      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Auto-show header after scroll stops
      const newTimeout = setTimeout(() => {
        setIsHeaderVisible(true);
      }, 3000);
      
      setScrollTimeout(newTimeout);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        container.removeEventListener('scroll', handleScroll);
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }
      };
    }
  }, [isMobile, lastScrollY, scrollTimeout]);

  // NEW: Auto-show header on user interaction
  const handleUserInteraction = () => {
    if (isMobile) {
      setIsHeaderVisible(true);
      
      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Auto-hide after 4 seconds of no interaction
      const newTimeout = setTimeout(() => {
        setIsHeaderVisible(false);
      }, 4000);
      
      setScrollTimeout(newTimeout);
    }
  };

  // Show error overlay when compile errors exist
  useEffect(() => {
    if (compileErrors && compileErrors.length > 0) {
      setShowErrorOverlay(true);
      setSelectedErrorIndex(0);
    } else {
      setShowErrorOverlay(false);
    }
  }, [compileErrors]);

  // Load PDF.js library
  useEffect(() => {
    const loadPdfJs = async () => {
      if (window.pdfjsLib) return;
      
      try {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        };
        document.head.appendChild(script);
      } catch (err) {
        console.error('Failed to load PDF.js:', err);
        setError('Failed to load PDF library');
      }
    };
    
    loadPdfJs();
  }, []);

  // Load PDF document
  useEffect(() => {
    const loadPdf = async () => {
      if (!pdfUrl || !window.pdfjsLib) return;
      
      setLoading(true);
      setError(null);
      setRenderedPages(new Map());
      setRenderingPages(new Set());
      setShowErrorOverlay(false);
      
      try {
        const pdf = await window.pdfjsLib.getDocument(pdfUrl).promise;
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        console.log(`PDF loaded: ${pdf.numPages} pages`);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF document');
        setPdfDocument(null);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    };
    
    loadPdf();
  }, [pdfUrl]);

  // Render a specific page
  const renderPage = useCallback(async (pageNum) => {
    if (!pdfDocument || renderingPages.has(pageNum)) return;
    
    // Check if page is already rendered at current zoom level
    const existingPageData = renderedPages.get(pageNum);
    const currentScale = zoom / 100;
    if (existingPageData && Math.abs(existingPageData.scale - currentScale) < 0.01) {
      return;
    }
    
    setRenderingPages(prev => new Set([...prev, pageNum]));
    
    try {
      const page = await pdfDocument.getPage(pageNum);
      const canvas = canvasRefs.current.get(pageNum);
      if (!canvas) return;
      
      const context = canvas.getContext('2d');
      
      // Calculate scale
      const containerWidth = containerRef.current?.clientWidth || (isMobile ? window.innerWidth - 32 : 800);
      const baseScale = Math.min(containerWidth * 0.85, 800) / page.getViewport({ scale: 1 }).width;
      const scale = baseScale * currentScale;
      
      const viewport = page.getViewport({ scale });
      
      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Clear and render
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Update rendered pages map without causing re-render
      renderedPages.set(pageNum, { scale: currentScale, timestamp: Date.now() });
      
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
    } finally {
      setRenderingPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(pageNum);
        return newSet;
      });
    }
  }, [pdfDocument, zoom, renderingPages, renderedPages, isMobile]);

  // Render visible pages with debouncing
  useEffect(() => {
    if (!pdfDocument) return;
    
    // Clear existing timeout
    if (zoomTimeout) {
      clearTimeout(zoomTimeout);
    }
    
    // Debounce rendering to prevent flickering
    const timeout = setTimeout(() => {
      const pagesToRender = [];
      
      // Render current page and nearby pages
      for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 2); i++) {
        const pageData = renderedPages.get(i);
        // Only re-render if page hasn't been rendered at current zoom level
        if (!pageData || Math.abs(pageData.scale - (zoom / 100)) > 0.01) {
          pagesToRender.push(i);
        }
      }
      
      // Render pages sequentially to avoid overwhelming the browser
      pagesToRender.forEach((pageNum, index) => {
        setTimeout(() => renderPage(pageNum), index * 100);
      });
      
    }, 150);
    
    setZoomTimeout(timeout);
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [pdfDocument, currentPage, zoom, totalPages]);

  // Zoom controls with debouncing
  const updateZoom = useCallback((newZoom) => {
    setZoom(Math.max(25, Math.min(500, newZoom)));
  }, []);

  const zoomIn = () => updateZoom(zoom + (isMobile ? 50 : 25));
  const zoomOut = () => updateZoom(zoom - (isMobile ? 50 : 25));
  const resetZoom = () => updateZoom(100);

  // Page navigation
  const goToFirstPage = () => setCurrentPage(1);
  const goToPreviousPage = () => setCurrentPage(Math.max(1, currentPage - 1));
  const goToNextPage = () => setCurrentPage(Math.min(totalPages, currentPage + 1));
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPage = (pageNum) => setCurrentPage(Math.max(1, Math.min(totalPages, parseInt(pageNum) || 1)));

  // Handle page input
  const handlePageInputChange = (e) => {
    if (e.key === 'Enter') {
      goToPage(e.target.value);
    }
  };

  // Handle mouse wheel zoom with proper event handling (desktop only)
  useEffect(() => {
    if (isMobile) return;
    
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.deltaY < 0) {
          updateZoom(zoom + 10);
        } else {
          updateZoom(zoom - 10);
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [zoom, updateZoom, isMobile]);

  // Scroll to current page
  useEffect(() => {
    if (currentPage && canvasRefs.current.has(currentPage)) {
      const canvas = canvasRefs.current.get(currentPage);
      if (canvas) {
        canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentPage]);

  // Create canvas refs for all pages
  const getCanvasRef = (pageNum) => {
    if (!canvasRefs.current.has(pageNum)) {
      canvasRefs.current.set(pageNum, React.createRef());
    }
    return canvasRefs.current.get(pageNum);
  };

  // Enhanced Error Overlay Component
  const ErrorOverlayContent = ({ errors, selectedIndex, onSelectError, onClose, isMobile = false }) => {
    const categorizedErrors = categorizeErrors(errors);
    const currentError = errors[selectedIndex];
    
    const renderCodeContext = (context) => {
      if (!context || !context.lines || !Array.isArray(context.lines)) return null;
      
      return (
        <div className="bg-gray-900 rounded-lg p-4 mt-3">
          <div className="text-xs text-gray-400 mb-2 font-mono">
            {safeRender(currentError.file) || 'main.tex'} (around line {safeRender((context.startLine || 0) + (context.errorLineIndex || 0))})
          </div>
          <pre className="text-sm font-mono overflow-x-auto">
            {context.lines.map((line, idx) => (
              <div
                key={idx}
                className={`${
                  idx === context.errorLineIndex
                    ? 'bg-red-900 bg-opacity-50 text-red-200'
                    : 'text-gray-300'
                } py-0.5 px-2 ${idx === context.errorLineIndex ? 'border-l-4 border-red-500' : ''}`}
              >
                <span className="text-gray-500 mr-3 select-none">
                  {((context.startLine || 0) + idx).toString().padStart(3)}
                </span>
                {safeRender(line) || ' '}
              </div>
            ))}
          </pre>
        </div>
      );
    };

    const renderErrorSummary = () => {
      const total = errors.length;
      const critical = categorizedErrors.critical.length;
      const syntax = categorizedErrors.syntax.length;
      const warnings = categorizedErrors.warnings.length;
      const missing = categorizedErrors.missing.length;

      return (
        <div className="flex flex-wrap gap-2 mb-4">
          {critical > 0 && (
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
              <ExclamationCircleIcon className="w-3 h-3" />
              <span>{critical} Critical</span>
            </div>
          )}
          {syntax > 0 && (
            <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
              <CogIcon className="w-3 h-3" />
              <span>{syntax} Syntax</span>
            </div>
          )}
          {missing > 0 && (
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
              <NoSymbolIcon className="w-3 h-3" />
              <span>{missing} Missing</span>
            </div>
          )}
          {warnings > 0 && (
            <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
              <ExclamationTriangleIcon className="w-3 h-3" />
              <span>{warnings} Warnings</span>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="bg-white rounded-2xl shadow-xl border border-red-200 max-w-4xl w-full max-h-[90%] overflow-hidden flex flex-col">
        {/* Enhanced Error Header */}
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-200 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-semibold text-red-800">
                LaTeX Compilation Failed
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-red-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-100"
              title="Close error overlay"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          {renderErrorSummary()}
        </div>

        {/* Error Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Error List Sidebar */}
          <div className="w-1/3 border-r border-gray-200 bg-gray-50 overflow-y-auto">
            <div className="p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                All Errors ({errors.length})
              </h4>
              <div className="space-y-2">
                {errors.map((error, index) => (
                  <button
                    key={index}
                    onClick={() => onSelectError(index)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedIndex === index
                        ? 'bg-white border-blue-300 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {getErrorIcon(error.type)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {error.type === 'latex_error' ? 'LaTeX Error' :
                           error.type === 'syntax' ? 'Syntax Error' :
                           error.type === 'missing_file' ? 'Missing File' :
                           error.type === 'package_error' ? 'Package Error' :
                           error.type === 'undefined_command' ? 'Undefined Command' :
                           error.type === 'math_mode' ? 'Math Mode Error' :
                           error.type === 'compilation_error' ? 'Compilation Error' :
                           error.type === 'pdf_error' ? 'PDF Error' :
                           error.type === 'undefined_environment' ? 'Undefined Environment' :
                           'Compilation Error'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {error.line ? `Line ${error.line}` : 'Unknown location'}
                          {error.file && error.file !== 'main.tex' ? ` in ${error.file}` : ''}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error Details */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {currentError && (
                <>
                  {/* Error Header */}
                  <div className="flex items-start space-x-3 mb-4">
                    {getErrorIcon(currentError.type)}
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {currentError.type === 'latex_error' ? 'LaTeX Error' :
                         currentError.type === 'syntax' ? 'Syntax Error' :
                         currentError.type === 'missing_file' ? 'Missing File' :
                         currentError.type === 'package_error' ? 'Package Error' :
                         currentError.type === 'undefined_command' ? 'Undefined Command' :
                         currentError.type === 'math_mode' ? 'Math Mode Error' :
                         currentError.type === 'compilation_error' ? 'Compilation Error' :
                         currentError.type === 'pdf_error' ? 'PDF Error' :
                         currentError.type === 'undefined_environment' ? 'Undefined Environment' :
                         'Compilation Error'}
                      </h4>
                      <div className="text-sm text-gray-600 mt-1">
                        {currentError.line && (
                          <span className="inline-flex items-center space-x-1">
                            <DocumentDuplicateIcon className="w-4 h-4" />
                            <span>Line {currentError.line}</span>
                            {currentError.file && currentError.file !== 'main.tex' && (
                              <span> in {currentError.file}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Error Message */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <pre className="text-sm text-red-800 font-mono whitespace-pre-wrap break-words">
                      {safeRender(currentError.message)}
                    </pre>
                  </div>

                  {/* Code Context */}
                  {currentError.context && renderCodeContext(currentError.context)}

                  {/* Suggestion */}
                  {currentError.suggestion && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                      <div className="flex items-start space-x-2">
                        <LightBulbIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-sm font-semibold text-blue-800 mb-1">
                            Suggestion
                          </h5>
                          <p className="text-sm text-blue-700">
                            {safeRender(currentError.suggestion)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Error {selectedIndex + 1} of {errors.length}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onSelectError(Math.max(0, selectedIndex - 1))}
              disabled={selectedIndex === 0}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 text-sm font-medium rounded transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => onSelectError(Math.min(errors.length - 1, selectedIndex + 1))}
              disabled={selectedIndex === errors.length - 1}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 text-sm font-medium rounded transition-colors"
            >
              Next
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // NEW: Mobile-specific rendering
  if (isMobile) {
    return (
      <div className="bg-white h-full flex flex-col relative">
        {/* Mobile Header */}
        <div className={`absolute top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm transition-transform duration-300 ease-in-out ${
          isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
        }`}>
          <div className="px-3 py-2 flex items-center justify-between">
            {/* Left: Back button and Page Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={onMobileClose}
                className="text-gray-600 hover:text-gray-800 transition-colors p-1 rounded-md hover:bg-gray-100"
                title="Back to Editor"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              
              {pdfDocument && totalPages > 0 && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => {
                      goToPreviousPage();
                      handleUserInteraction();
                    }}
                    disabled={currentPage <= 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 transition-colors"
                    title="Previous Page"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => {
                        setCurrentPage(parseInt(e.target.value) || 1);
                        handleUserInteraction();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          goToPage(e.target.value);
                          handleUserInteraction();
                        }
                      }}
                      onFocus={handleUserInteraction}
                      className="w-12 px-1 py-0.5 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <span className="text-sm text-gray-600">/ {totalPages}</span>
                  </div>
                  
                  <button
                    onClick={() => {
                      goToNextPage();
                      handleUserInteraction();
                    }}
                    disabled={currentPage >= totalPages}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 transition-colors"
                    title="Next Page"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            {/* Right: Error, Status, and Zoom Controls */}
            <div className="flex items-center space-x-2">
              {/* Enhanced Mobile Error indicator */}
              {compileErrors && compileErrors.length > 0 && (
                <button
                  onClick={() => setShowErrorOverlay(true)}
                  className="flex items-center space-x-1 px-2 py-1 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                >
                  <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-600 font-medium">
                    {compileErrors.length}
                  </span>
                </button>
              )}
              
              {/* Mobile Status */}
              {(isCompiling || loading || renderingPages.size > 0) && (
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 border border-blue-400 border-t-blue-600 rounded-full animate-spin"></div>
                  <span className="text-xs text-blue-600">
                    {isCompiling ? 'Compiling...' : loading ? 'Loading...' : 'Rendering...'}
                  </span>
                </div>
              )}
              
              {/* Mobile Zoom Controls */}
              {pdfDocument && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => {
                      zoomOut();
                      handleUserInteraction();
                    }}
                    className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                    title="Zoom Out"
                  >
                    <MagnifyingGlassMinusIcon className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      resetZoom();
                      handleUserInteraction();
                    }}
                    className="px-2 py-0.5 text-xs rounded hover:bg-gray-100 text-gray-600 min-w-[45px] transition-colors"
                    title="Reset Zoom"
                  >
                    {zoom}%
                  </button>
                  <button
                    onClick={() => {
                      zoomIn();
                      handleUserInteraction();
                    }}
                    className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                    title="Zoom In"
                  >
                    <MagnifyingGlassPlusIcon className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile PDF Content */}
        <div 
          ref={containerRef}
          className="flex-1 bg-white overflow-auto relative pt-14"
          style={{ scrollBehavior: 'smooth' }}
          onTouchStart={handleUserInteraction}
          onTouchMove={handleUserInteraction}
        >
          {error ? (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <DocumentTextIcon className="w-10 h-10 text-red-500" />
                </div>
                <p className="text-red-600 text-base mb-3 font-medium">Error loading PDF</p>
                <p className="text-gray-500 text-sm">{error}</p>
              </div>
            </div>
          ) : pdfDocument ? (
            <div className="flex flex-col items-center py-8 space-y-6 px-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <div key={pageNum} className="relative w-full max-w-4xl">
                  <canvas
                    ref={ref => {
                      if (ref) canvasRefs.current.set(pageNum, ref);
                    }}
                    className={`w-full shadow-lg border border-gray-200 bg-white ${
                      currentPage === pageNum ? 'ring-4 ring-blue-300' : ''
                    }`}
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      borderRadius: '8px',
                      display: 'block'
                    }}
                    onTouchStart={handleUserInteraction}
                  />
                  {renderingPages.has(pageNum) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
                      <div className="flex items-center space-x-3 bg-white p-4 rounded-lg shadow-lg">
                        <div className="w-5 h-5 border border-blue-400 border-t-blue-600 rounded-full animate-spin"></div>
                        <span className="text-sm text-blue-600">Rendering page {pageNum}...</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Mobile Page Number Indicator */}
                  <div className="absolute top-4 right-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm font-medium">
                    {pageNum}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <DocumentTextIcon className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-gray-700 text-base mb-3 font-medium">
                  {isCompiling ? 'Compiling LaTeX document...' : loading ? 'Loading PDF...' : 'PDF will appear here after compilation'}
                </p>
                <p className="text-gray-500 text-sm mb-6">
                  {isCompiling ? 'Please wait...' : loading ? 'Please wait...' : 'Tap "Compile" to generate preview'}
                </p>
              </div>
            </div>
          )}

          {/* Enhanced Mobile Error Overlay */}
          {showErrorOverlay && compileErrors && compileErrors.length > 0 && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl shadow-xl border border-red-200 max-w-lg w-full max-h-[90%] overflow-hidden flex flex-col">
                {/* Mobile Error Header */}
                <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                    <h3 className="text-base font-semibold text-red-800">
                      Compilation Failed
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowErrorOverlay(false)}
                    className="text-red-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-100"
                    title="Close error overlay"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Mobile Error Summary */}
                <div className="px-4 py-3 bg-red-25 border-b border-red-100">
                  <div className="text-sm text-red-600 mb-2">
                    {compileErrors.length} error{compileErrors.length !== 1 ? 's' : ''} found
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {categorizeErrors(compileErrors).critical.length > 0 && (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">
                        {categorizeErrors(compileErrors).critical.length} Critical
                      </span>
                    )}
                    {categorizeErrors(compileErrors).syntax.length > 0 && (
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">
                        {categorizeErrors(compileErrors).syntax.length} Syntax
                      </span>
                    )}
                    {categorizeErrors(compileErrors).missing.length > 0 && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                        {categorizeErrors(compileErrors).missing.length} Missing
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Mobile Error Content - Scrollable List */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4 space-y-4">
                    {compileErrors.slice(0, 10).map((error, index) => (
                      <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-start space-x-2 mb-2">
                          {getErrorIcon(error.type)}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-red-800 mb-1">
                              {error.type === 'latex_error' ? 'LaTeX Error' :
                               error.type === 'syntax' ? 'Syntax Error' :
                               error.type === 'missing_file' ? 'Missing File' :
                               error.type === 'package_error' ? 'Package Error' :
                               error.type === 'undefined_command' ? 'Undefined Command' :
                               error.type === 'math_mode' ? 'Math Mode Error' :
                               error.type === 'compilation_error' ? 'Compilation Error' :
                               error.type === 'pdf_error' ? 'PDF Error' :
                               error.type === 'undefined_environment' ? 'Undefined Environment' :
                               'Compilation Error'}
                            </div>
                            {error.line && (
                              <div className="text-xs text-red-600 mb-2">
                                Line {error.line} {error.file && error.file !== 'main.tex' ? `in ${error.file}` : ''}
                              </div>
                            )}
                            <pre className="text-sm text-red-800 font-mono whitespace-pre-wrap break-words mb-2">
                              {safeRender(error.message)}
                            </pre>
                            
                            {/* Code Context for Mobile */}
                            {error.context && error.context.lines && (
                              <div className="bg-gray-900 rounded p-2 mt-2 text-xs">
                                <div className="text-gray-400 mb-1 font-mono">
                                  {safeRender(error.file) || 'main.tex'} (around line {safeRender((error.context.startLine || 0) + (error.context.errorLineIndex || 0))})
                                </div>
                                <pre className="font-mono overflow-x-auto">
                                  {error.context.lines.map((line, idx) => (
                                    <div
                                      key={idx}
                                      className={`${
                                        idx === error.context.errorLineIndex
                                          ? 'bg-red-900 bg-opacity-50 text-red-200'
                                          : 'text-gray-300'
                                      } py-0.5 px-1 ${idx === error.context.errorLineIndex ? 'border-l-2 border-red-500' : ''}`}
                                    >
                                      <span className="text-gray-500 mr-2 select-none">
                                        {((error.context.startLine || 0) + idx).toString().padStart(2)}
                                      </span>
                                      {safeRender(line) || ' '}
                                    </div>
                                  ))}
                                </pre>
                              </div>
                            )}
                            
                            {error.suggestion && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                                <div className="flex items-start space-x-1">
                                  <LightBulbIcon className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
                                  <p className="text-xs text-blue-700">
                                    {safeRender(error.suggestion)}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {compileErrors.length > 10 && (
                      <div className="text-center py-2">
                        <span className="text-sm text-gray-500">
                          ... and {compileErrors.length - 10} more errors
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Mobile Footer */}
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex justify-end">
                  <button
                    onClick={() => setShowErrorOverlay(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // DESKTOP LAYOUT
  return (
    <div className="bg-white border-l border-gray-300 flex flex-col relative" style={{ width: `${editorWidth}%` }}>
      {/* Header with controls */}
      <div className="bg-white border-b border-gray-300 px-4 py-2 flex-shrink-0 min-h-[44px] h-11">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <EyeIcon className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-800">Preview</span>
            </div>
            
            {/* Page Navigation */}
            {pdfDocument && totalPages > 0 && (
              <>
                <div className="w-px h-4 bg-gray-300"></div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={goToFirstPage}
                    disabled={currentPage <= 1}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 transition-colors"
                    title="First Page"
                  >
                    <ChevronDoubleLeftIcon className="w-3 h-3" />
                  </button>
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage <= 1}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 transition-colors"
                    title="Previous Page"
                  >
                    <ChevronLeftIcon className="w-3 h-3" />
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => setCurrentPage(parseInt(e.target.value) || 1)}
                      onKeyDown={handlePageInputChange}
                      className="w-10 px-1 py-0.5 text-xs text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-600">/ {totalPages}</span>
                  </div>
                  
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage >= totalPages}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 transition-colors"
                    title="Next Page"
                  >
                    <ChevronRightIcon className="w-3 h-3" />
                  </button>
                  <button
                    onClick={goToLastPage}
                    disabled={currentPage >= totalPages}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 transition-colors"
                    title="Last Page"
                  >
                    <ChevronDoubleRightIcon className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Enhanced Error indicator in header */}
            {compileErrors && compileErrors.length > 0 && (
              <button
                onClick={() => setShowErrorOverlay(true)}
                className="flex items-center space-x-2 px-2 py-1 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                title="Click to view detailed errors"
              >
                <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                <span className="text-xs text-red-600 font-medium">
                  {compileErrors.length} error{compileErrors.length !== 1 ? 's' : ''}
                </span>
              </button>
            )}
            
            {/* Zoom Controls */}
            {pdfDocument && (
              <>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={zoomOut}
                    className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                    title="Zoom Out"
                  >
                    <MagnifyingGlassMinusIcon className="w-3 h-3" />
                  </button>
                  <button
                    onClick={resetZoom}
                    className="px-2 py-0.5 text-xs rounded hover:bg-gray-200 text-gray-600 min-w-[45px] transition-colors"
                    title="Reset Zoom"
                  >
                    {zoom}%
                  </button>
                  <button
                    onClick={zoomIn}
                    className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                    title="Zoom In"
                  >
                    <MagnifyingGlassPlusIcon className="w-3 h-3" />
                  </button>
                </div>
                <div className="w-px h-4 bg-gray-300"></div>
              </>
            )}
            
            {/* Status */}
            {(isCompiling || loading || renderingPages.size > 0) && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 border border-blue-400 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-xs text-blue-600">
                  {isCompiling ? 'Compiling...' : loading ? 'Loading PDF...' : 'Rendering...'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* PDF Content - Multi-page scrollable view */}
      <div 
        ref={containerRef}
        className="flex-1 bg-white overflow-auto relative"
        style={{ scrollBehavior: 'smooth' }}
      >
        {error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <DocumentTextIcon className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-red-600 text-sm mb-2">Error loading PDF</p>
              <p className="text-gray-500 text-xs">{error}</p>
            </div>
          </div>
        ) : pdfDocument ? (
          <div className="flex flex-col items-center py-6 space-y-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <div key={pageNum} className="relative">
                <canvas
                  ref={ref => {
                    if (ref) canvasRefs.current.set(pageNum, ref);
                  }}
                  className={`shadow-lg border border-gray-200 bg-white ${
                    currentPage === pageNum ? 'ring-2 ring-blue-300' : ''
                  }`}
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: '4px',
                    display: 'block'
                  }}
                />
                {renderingPages.has(pageNum) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border border-blue-400 border-t-blue-600 rounded-full animate-spin"></div>
                      <span className="text-xs text-blue-600">Rendering page {pageNum}...</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <DocumentTextIcon className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-700 text-sm mb-2">
                {isCompiling ? 'Compiling LaTeX document...' : loading ? 'Loading PDF...' : 'PDF will appear here after compilation'}
              </p>
              <p className="text-gray-500 text-xs mb-4">
                {isCompiling ? 'Please wait...' : loading ? 'Please wait...' : 'Click "Compile" or press Ctrl+S to generate preview'}
              </p>
            </div>
          </div>
        )}

        {/* Enhanced Desktop Error Overlay */}
        {showErrorOverlay && compileErrors && compileErrors.length > 0 && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center p-4 z-10">
            <ErrorOverlayContent
              errors={compileErrors}
              selectedIndex={selectedErrorIndex}
              onSelectError={setSelectedErrorIndex}
              onClose={() => setShowErrorOverlay(false)}
              isMobile={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFPreview;
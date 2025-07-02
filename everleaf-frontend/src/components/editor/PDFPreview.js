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
  XMarkIcon
} from '@heroicons/react/24/outline';

const PDFPreview = ({
  pdfUrl,
  isCompiling,
  editorWidth,
  compileErrors = [] // NEW: Added compile errors prop
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [renderedPages, setRenderedPages] = useState(new Map());
  const [renderingPages, setRenderingPages] = useState(new Set());
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showErrorOverlay, setShowErrorOverlay] = useState(false); // NEW: Error overlay state
  
  const containerRef = useRef(null);
  const canvasRefs = useRef(new Map());

  // Debounced zoom to prevent flickering
  const [zoomTimeout, setZoomTimeout] = useState(null);

  // NEW: Show error overlay when compile errors exist
  useEffect(() => {
    if (compileErrors && compileErrors.length > 0) {
      setShowErrorOverlay(true);
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
      setShowErrorOverlay(false); // NEW: Hide error overlay when loading new PDF
      
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
      return; // Already rendered at this zoom level
    }
    
    setRenderingPages(prev => new Set([...prev, pageNum]));
    
    try {
      const page = await pdfDocument.getPage(pageNum);
      const canvas = canvasRefs.current.get(pageNum);
      if (!canvas) return;
      
      const context = canvas.getContext('2d');
      
      // Calculate scale
      const containerWidth = containerRef.current?.clientWidth || 800;
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
  }, [pdfDocument, zoom, renderingPages, renderedPages]);

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
      
    }, 150); // 150ms debounce
    
    setZoomTimeout(timeout);
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [pdfDocument, currentPage, zoom, totalPages]); // Removed renderedPages dependency

  // Zoom controls with debouncing
  const updateZoom = useCallback((newZoom) => {
    setZoom(Math.max(25, Math.min(500, newZoom)));
  }, []);

  const zoomIn = () => updateZoom(zoom + 25);
  const zoomOut = () => updateZoom(zoom - 25);
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

  // Handle mouse wheel zoom with proper event handling
  useEffect(() => {
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
      // Add non-passive event listener to allow preventDefault
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [zoom, updateZoom]);

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
            {/* NEW: Error indicator in header */}
            {compileErrors && compileErrors.length > 0 && (
              <div className="flex items-center space-x-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                <span className="text-xs text-red-600 font-medium">
                  {compileErrors.length} error{compileErrors.length !== 1 ? 's' : ''}
                </span>
              </div>
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

        {/* NEW: Translucent Error Overlay */}
        {showErrorOverlay && compileErrors && compileErrors.length > 0 && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center p-4 z-10">
            <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-lg shadow-xl border border-red-200 max-w-2xl w-full max-h-[80%] overflow-hidden">
              {/* Error Header */}
              <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                  <h3 className="text-sm font-semibold text-red-800">
                    Compilation Failed ({compileErrors.length} error{compileErrors.length !== 1 ? 's' : ''})
                  </h3>
                </div>
                <button
                  onClick={() => setShowErrorOverlay(false)}
                  className="text-red-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-100"
                  title="Close error overlay"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              
              {/* Error Content */}
              <div className="p-4 max-h-96 overflow-y-auto">
                <div className="space-y-3">
                  {compileErrors.map((error, index) => (
                    <div key={index} className="bg-red-50 border border-red-200 rounded-md p-3">
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 w-5 h-5 bg-red-100 rounded-full flex items-center justify-center mt-0.5">
                          <span className="text-red-700 text-xs font-medium">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <pre className="text-sm text-red-800 font-mono whitespace-pre-wrap break-words">
                            {error}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Help Text */}
                <div className="mt-4 pt-4 border-t border-red-200">
                  <p className="text-xs text-gray-600">
                    <strong>Tip:</strong> Fix the errors in your LaTeX code and try compiling again. 
                    Common issues include missing packages, unclosed braces, or syntax errors.
                  </p>
                </div>
              </div>
              
              {/* Footer */}
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex justify-end">
                <button
                  onClick={() => setShowErrorOverlay(false)}
                  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded transition-colors"
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
};

export default PDFPreview;
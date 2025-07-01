import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  ArrowUpTrayIcon as Upload, 
  LinkIcon as Link, 
  DocumentTextIcon as FileText, 
  ExclamationCircleIcon as AlertCircle, 
  CheckCircleIcon as CheckCircle, 
  XMarkIcon as X, 
  ArrowPathIcon as RotateCcw 
} from '@heroicons/react/24/outline';

const DocumentUpload = ({ projectId, onDocumentsUploaded, documents = [], onDeleteDocument, onReprocessDocument }) => {
  const { api } = useAuth();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urls, setUrls] = useState(['']);
  const [collapsed, setCollapsed] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  
  const fileInputRef = useRef();

  // CORS Proxy configuration with fallbacks
  const CORS_PROXIES = [
    {
      name: 'CORS.lol',
      url: 'https://api.cors.lol/?url=',
      maxSize: 10 * 1024 * 1024, // 10MB
      rateLimit: '100/hour'
    },
    {
      name: 'CodeTabs',
      url: 'https://api.codetabs.com/v1/proxy?quest=',
      maxSize: 5 * 1024 * 1024, // 5MB
      rateLimit: '5/second'
    },
    {
      name: 'HTMLDriven',
      url: 'https://cors-proxy.htmldriven.com/?url=',
      maxSize: 50 * 1024 * 1024, // 50MB
      rateLimit: 'Unknown'
    }
  ];

  // Utility function to validate PDF URLs
  const validatePdfUrl = (url) => {
    try {
      const urlObj = new URL(url);
      
      // Check if it's a valid HTTP/HTTPS URL
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
      }
      
      // Check for common PDF indicators
      const isPdfUrl = url.toLowerCase().includes('.pdf') || 
                      url.includes('application/pdf') ||
                      url.includes('arxiv.org/pdf/') ||
                      url.includes('export=download');
      
      if (!isPdfUrl) {
        console.warn(`⚠️ URL may not be a PDF: ${url}`);
      }
      
      return { valid: true, isPdfUrl };
    } catch (error) {
      return { valid: false, error: 'Invalid URL format' };
    }
  };

  // Function to download PDF through CORS proxy with fallback
  const downloadPdfThroughProxy = async (url, proxyIndex = 0) => {
    if (proxyIndex >= CORS_PROXIES.length) {
      throw new Error('All CORS proxies failed');
    }
    
    const proxy = CORS_PROXIES[proxyIndex];
    const proxiedUrl = proxy.url + encodeURIComponent(url);
    
    console.log(`🔄 Attempting download via ${proxy.name}: ${proxiedUrl}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(proxiedUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/pdf,*/*',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Check content type
      const contentType = response.headers.get('content-type');
      console.log(`📄 Content-Type: ${contentType}`);
      
      // Get content length for size validation
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > proxy.maxSize) {
        throw new Error(`File too large: ${contentLength} bytes (max: ${proxy.maxSize})`);
      }
      
      const blob = await response.blob();
      
      // Validate blob size
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      if (blob.size > proxy.maxSize) {
        throw new Error(`File too large: ${blob.size} bytes (max: ${proxy.maxSize})`);
      }
      
      console.log(`✅ Successfully downloaded via ${proxy.name}: ${blob.size} bytes`);
      return { blob, proxy: proxy.name };
      
    } catch (error) {
      console.warn(`❌ ${proxy.name} failed: ${error.message}`);
      
      // If this proxy failed, try the next one
      if (error.name === 'AbortError') {
        console.warn(`⏰ ${proxy.name} timed out, trying next proxy...`);
      } else if (error.message.includes('CORS') || error.message.includes('Network')) {
        console.warn(`🌐 ${proxy.name} network/CORS error, trying next proxy...`);
      }
      
      // Try next proxy
      return await downloadPdfThroughProxy(url, proxyIndex + 1);
    }
  };

  // Convert blob to File object
  const blobToFile = (blob, filename, lastModified = Date.now()) => {
    const file = new File([blob], filename, {
      type: blob.type || 'application/pdf',
      lastModified: lastModified
    });
    return file;
  };

  // Extract filename from URL
  const getFilenameFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      let filename = urlObj.pathname.split('/').pop();
      
      // Handle special cases
      if (url.includes('arxiv.org/pdf/')) {
        const match = url.match(/arxiv\.org\/pdf\/([^/?]+)/);
        if (match) {
          filename = `arxiv_${match[1]}.pdf`;
        }
      }
      
      // Ensure .pdf extension
      if (!filename.toLowerCase().endsWith('.pdf')) {
        filename += '.pdf';
      }
      
      // Sanitize filename
      filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      
      return filename || 'document.pdf';
    } catch {
      return 'document.pdf';
    }
  };

  // Updated uploadFiles function (unchanged)
  const uploadFiles = useCallback(async (files) => {
    console.log('📤 Starting file upload process...', files.length, 'files');
    setUploading(true);
    
    try {
      console.log('🔄 Creating FormData...');
      const formData = new FormData();
      files.forEach((file, index) => {
        console.log(`📄 Adding file ${index + 1}: ${file.name} (${file.size} bytes)`);
        formData.append('documents', file);
      });

      console.log('🌐 Sending upload request to server...');
      const response = await api.post(`/documents/${projectId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      console.log('📨 Upload response status:', response.status);
      console.log('📨 Upload response data:', response.data);
      
      if (response.data.success) {
        console.log('✅ Upload successful, notifying parent component...');
        onDocumentsUploaded && onDocumentsUploaded(response.data.documents);
      } else {
        console.error('❌ Upload failed:', response.data.message);
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
    } finally {
      console.log('🏁 Upload process completed');
      setUploading(false);
    }
  }, [projectId, onDocumentsUploaded, api]);

  // Updated handleFiles function (unchanged)
  const handleFiles = useCallback(async (fileList) => {
    console.log('📁 Processing file list...', fileList.length, 'files');
    const files = Array.from(fileList);
    
    // Validate files
    console.log('🔍 Validating files...');
    const validFiles = files.filter(file => {
      console.log(`📄 Checking file: ${file.name}, type: ${file.type}, size: ${file.size}`);
      if (file.type !== 'application/pdf') {
        console.warn(`❌ ${file.name} is not a PDF file (type: ${file.type})`);
        return false;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        console.warn(`❌ ${file.name} is too large: ${file.size} bytes`);
        return false;
      }
      console.log(`✅ ${file.name} passed validation`);
      return true;
    });

    console.log(`📊 Validation results: ${validFiles.length}/${files.length} files valid`);

    if (validFiles.length === 0) {
      console.log('❌ No valid files to upload');
      return;
    }
    if (validFiles.length > 10) {
      console.warn('❌ Too many files selected');
      return;
    }

    console.log('🚀 Proceeding with upload...');
    await uploadFiles(validFiles);
  }, [uploadFiles]);

  // Handle file input change (unchanged)
  const handleFileInputChange = useCallback((e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  }, [handleFiles]);

  // Handle file drops (unchanged)
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  // Handle drag events (unchanged)
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // NEW: Enhanced uploadFromUrls function with CORS proxy support
  const uploadFromUrls = async () => {
    const validUrls = urls.filter(url => url.trim());
    
    console.log('🔗 Starting URL upload process...', validUrls.length, 'URLs');
    
    if (validUrls.length === 0) {
      console.warn('❌ No valid URLs provided');
      return;
    }

    // Validate URLs first
    const urlValidations = validUrls.map(url => ({
      url,
      ...validatePdfUrl(url)
    }));

    const invalidUrls = urlValidations.filter(v => !v.valid);
    if (invalidUrls.length > 0) {
      console.error('❌ Invalid URLs:', invalidUrls);
      return;
    }

    console.log('📋 URLs to upload:', validUrls);
    setUploading(true);
    
    const results = {
      successful: [],
      failed: []
    };

    try {
      // Process URLs sequentially to avoid overwhelming proxies
      for (let i = 0; i < validUrls.length; i++) {
        const url = validUrls[i];
        console.log(`🔄 Processing URL ${i + 1}/${validUrls.length}: ${url}`);
        
        try {
          // Download through CORS proxy
          const { blob, proxy } = await downloadPdfThroughProxy(url);
          
          // Convert to File object
          const filename = getFilenameFromUrl(url);
          const file = blobToFile(blob, filename);
          
          console.log(`✅ Downloaded ${filename} via ${proxy}: ${file.size} bytes`);
          results.successful.push({
            url,
            file,
            proxy,
            filename
          });
          
          // Add small delay between requests to respect rate limits
          if (i < validUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (error) {
          console.error(`❌ Failed to download ${url}:`, error.message);
          results.failed.push({
            url,
            error: error.message
          });
        }
      }

      console.log(`📊 Download results: ${results.successful.length} successful, ${results.failed.length} failed`);

      // Upload successful downloads
      if (results.successful.length > 0) {
        const files = results.successful.map(r => r.file);
        console.log('🚀 Uploading downloaded files to server...');
        
        await uploadFiles(files);
        
        // Log success info (no alert)
        const proxyInfo = results.successful.map(r => `${r.filename} (via ${r.proxy})`).join('\n');
        console.log('✅ Successfully uploaded via proxies:\n' + proxyInfo);
      }

      // Log failed downloads (no alert)
      if (results.failed.length > 0) {
        const failedInfo = results.failed.map(r => `${r.url}: ${r.error}`).join('\n');
        console.warn('⚠️ Some downloads failed:\n' + failedInfo);
      }

      // Close dialog on any successful upload
      if (results.successful.length > 0) {
        setShowUrlDialog(false);
        setUrls(['']);
      }

    } catch (error) {
      console.error('❌ URL upload process error:', error);
    } finally {
      console.log('🏁 URL upload process completed');
      setUploading(false);
    }
  };

  // Handle document deletion
  const handleDeleteDocument = (doc) => {
    setDocumentToDelete(doc);
    setShowDeleteDialog(true);
  };

  const confirmDeleteDocument = () => {
    if (documentToDelete && onDeleteDocument) {
      onDeleteDocument(documentToDelete.id);
    }
    setShowDeleteDialog(false);
    setDocumentToDelete(null);
  };

  const cancelDeleteDocument = () => {
    setShowDeleteDialog(false);
    setDocumentToDelete(null);
  };

  // Rest of the component functions remain unchanged...
  const addUrlField = () => {
    if (urls.length < 10) {
      setUrls([...urls, '']);
    }
  };

  const updateUrl = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const removeUrl = (index) => {
    if (urls.length > 1) {
      setUrls(urls.filter((_, i) => i !== index));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Uploaded';
      case 'processing':
        return 'Generating embeddings';
      case 'completed':
        return 'Embedding generated';
      case 'failed':
        return 'Failed';
      default:
        return 'Uploading';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'processing':
        return 'text-blue-600 bg-blue-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white border-t border-gray-200">
      {/* Header */}
      <div 
        className="px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Reference Documents</span>
            {documents.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {documents.length}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {documents.filter(d => d.processingStatus === 'completed').length > 0 && (
              <div className="w-2 h-2 bg-green-500 rounded-full" title="RAG Ready" />
            )}
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* Upload Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-md text-sm font-medium transition-all ${
                dragActive 
                  ? 'border-blue-400 bg-blue-50 text-blue-700' 
                  : 'border-gray-300 text-gray-700 bg-white hover:border-gray-400 hover:bg-gray-50'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-6 h-6 mb-2" />
              <span className="font-medium">
                {dragActive ? 'Drop files here' : 'Upload'}
              </span>
              <span className="text-xs text-gray-500 mt-1 text-center">
                or drag & drop PDFs
              </span>
            </button>
            <button
              onClick={() => setShowUrlDialog(true)}
              disabled={uploading}
              className="flex flex-col items-center justify-center aspect-square border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Link className="w-6 h-6 mb-2" />
              <span className="font-medium">Links</span>
              <span className="text-xs text-gray-500 mt-1">
                from URLs
              </span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Document List */}
          {documents.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Documents ({documents.length})
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                      doc.processingStatus === 'completed' 
                        ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                        : doc.processingStatus === 'processing'
                        ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                        : doc.processingStatus === 'failed'
                        ? 'bg-red-50 border-red-200 hover:bg-red-100'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center flex-1 min-w-0 space-x-3">
                      {getStatusIcon(doc.processingStatus)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {doc.originalFilename || 'Untitled Document'}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center space-x-2">
                          <span>{formatFileSize(doc.fileSize)}</span>
                          {doc.chunkCount && doc.chunkCount > 0 && (
                            <>
                              <span>•</span>
                              <span>{doc.chunkCount} chunks</span>
                            </>
                          )}
                          {doc.uploadType === 'url' && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                URL
                              </span>
                            </>
                          )}
                        </div>
                        {doc.errorMessage && (
                          <div className="text-xs text-red-600 mt-1">
                            {doc.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      {doc.processingStatus === 'failed' && (
                        <button
                          onClick={() => onReprocessDocument && onReprocessDocument(doc.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Reprocess"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteDocument(doc)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enhanced URL Dialog with CORS proxy info */}
      {showUrlDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Upload from URLs</h3>
                <button
                  onClick={() => setShowUrlDialog(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Downloads PDFs via CORS proxy with automatic fallback
              </p>
            </div>
            
            <div className="px-6 py-4">
              <div className="space-y-3">
                {urls.map((url, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => updateUrl(index, e.target.value)}
                      placeholder="https://arxiv.org/pdf/2009.08020"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    {urls.length > 1 && (
                      <button
                        onClick={() => removeUrl(index)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={addUrlField}
                  disabled={urls.length >= 10}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add another URL
                </button>
                <span className="text-xs text-gray-500">
                  {urls.length}/10 URLs
                </span>
              </div>


            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3 rounded-b-lg">
              <button
                onClick={() => setShowUrlDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={uploadFromUrls}
                disabled={uploading || urls.every(url => !url.trim())}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Downloading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && documentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Delete Document</h3>
                <button
                  onClick={cancelDeleteDocument}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 mb-2">
                    Are you sure you want to delete this document? This will also remove all embeddings.
                  </p>
                  <div className="bg-gray-50 rounded-md p-3">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {documentToDelete.originalFilename || 'Untitled Document'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatFileSize(documentToDelete.fileSize)}
                      {documentToDelete.chunkCount && documentToDelete.chunkCount > 0 && (
                        <span> • {documentToDelete.chunkCount} chunks</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3 rounded-b-lg">
              <button
                onClick={cancelDeleteDocument}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteDocument}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
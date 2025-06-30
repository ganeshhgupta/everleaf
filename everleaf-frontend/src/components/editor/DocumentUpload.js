import React, { useState, useRef, useCallback } from 'react';
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
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urls, setUrls] = useState(['']);
  const [collapsed, setCollapsed] = useState(false);
  
  const fileInputRef = useRef();

  // Define uploadFiles first
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
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/documents/${projectId}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      console.log('📨 Upload response status:', response.status);
      const result = await response.json();
      console.log('📨 Upload response data:', result);
      
      if (result.success) {
        console.log('✅ Upload successful, notifying parent component...');
        onDocumentsUploaded && onDocumentsUploaded(result.documents);
      } else {
        console.error('❌ Upload failed:', result.message);
        alert(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      console.log('🏁 Upload process completed');
      setUploading(false);
    }
  }, [projectId, onDocumentsUploaded]);

  // Now handleFiles can reference uploadFiles
  const handleFiles = useCallback(async (fileList) => {
    console.log('📁 Processing file list...', fileList.length, 'files');
    const files = Array.from(fileList);
    
    // Validate files
    console.log('🔍 Validating files...');
    const validFiles = files.filter(file => {
      console.log(`📄 Checking file: ${file.name}, type: ${file.type}, size: ${file.size}`);
      if (file.type !== 'application/pdf') {
        console.warn(`❌ ${file.name} is not a PDF file (type: ${file.type})`);
        alert(`${file.name} is not a PDF file`);
        return false;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        console.warn(`❌ ${file.name} is too large: ${file.size} bytes`);
        alert(`${file.name} is too large (max 50MB)`);
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
      alert('Maximum 10 files allowed per upload');
      return;
    }

    console.log('🚀 Proceeding with upload...');
    await uploadFiles(validFiles);
  }, [uploadFiles]);

  // Handle file input change
  const handleFileInputChange = useCallback((e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset the input value so the same file can be selected again
    e.target.value = '';
  }, [handleFiles]);

  // Handle file drops
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const uploadFromUrls = async () => {
    const validUrls = urls.filter(url => url.trim());
    
    console.log('🔗 Starting URL upload process...', validUrls.length, 'URLs');
    
    if (validUrls.length === 0) {
      console.warn('❌ No valid URLs provided');
      alert('Please enter at least one URL');
      return;
    }

    console.log('📋 URLs to upload:', validUrls);
    setUploading(true);
    
    try {
      console.log('🌐 Sending URL upload request to server...');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/documents/${projectId}/upload-urls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ urls: validUrls }),
        credentials: 'include'
      });

      console.log('📨 URL upload response status:', response.status);
      const result = await response.json();
      console.log('📨 URL upload response data:', result);
      
      if (result.success) {
        console.log('✅ URL upload successful');
        onDocumentsUploaded && onDocumentsUploaded(result.documents);
        if (result.failed && result.failed.length > 0) {
          console.warn(`⚠️ Some URLs failed: ${result.failed.length}`);
          alert(`${result.documents.length} documents uploaded successfully. ${result.failed.length} URLs failed.`);
        }
        setShowUrlDialog(false);
        setUrls(['']);
      } else {
        console.error('❌ URL upload failed:', result.message);
        alert(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ URL upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      console.log('🏁 URL upload process completed');
      setUploading(false);
    }
  };

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
              className="flex flex-col items-center justify-center px-3 py-3 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Upload className="w-5 h-5 mb-1" />
              Upload
            </button>
            <button
              onClick={() => setShowUrlDialog(true)}
              disabled={uploading}
              className="flex flex-col items-center justify-center px-3 py-3 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Link className="w-5 h-5 mb-1" />
              Links
            </button>
          </div>

          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
              dragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-1">
              Drop PDF files here or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-gray-500">
              Up to 10 PDFs, 50MB each
            </p>
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
                        onClick={() => onDeleteDocument && onDeleteDocument(doc.id)}
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

      {/* URL Dialog */}
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
            </div>
            
            <div className="px-6 py-4">
              <div className="space-y-3">
                {urls.map((url, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => updateUrl(index, e.target.value)}
                      placeholder="https://example.com/document.pdf"
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
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
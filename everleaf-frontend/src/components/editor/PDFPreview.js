import React from 'react';
import { EyeIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const PDFPreview = ({
  pdfUrl,
  isCompiling,
  editorWidth
}) => {
  return (
    <div className="bg-white border-l border-gray-200 flex flex-col" style={{ width: `${100 - editorWidth}%` }}>
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <EyeIcon className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Preview</span>
          </div>
          {isCompiling && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 border border-green-300 border-t-green-600 rounded-full animate-spin"></div>
              <span className="text-xs text-green-600">Compiling...</span>
            </div>
          )}
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
              {isCompiling ? 'Compiling LaTeX document...' : 'PDF will appear here after compilation'}
            </p>
            <p className="text-gray-400 text-xs mb-4">
              {isCompiling ? 'Please wait...' : 'Click "Compile" or press Ctrl+S to generate preview'}
            </p>
            {isCompiling && (
              <div className="w-8 h-8 border-2 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFPreview;
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { query } = require('../config/database');
const Project = require('../models/Project');
const { logActivity } = require('../utils/activityLogger');

// DEBUG: Test ragProcessor import
console.log('🔍 Testing ragProcessor import...');
try {
    const ragProcessor = require('../utils/ragProcessor');
    console.log('✅ ragProcessor module loaded');
    console.log('📊 Available exports:', Object.keys(ragProcessor));
    console.log('📊 processDocument type:', typeof ragProcessor.processDocument);
    console.log('📊 deleteDocumentEmbeddings type:', typeof ragProcessor.deleteDocumentEmbeddings);
    
    // Import the functions
    const { processDocument, deleteDocumentEmbeddings } = ragProcessor;
    console.log('✅ Functions imported successfully');
    
} catch (error) {
    console.error('❌ ragProcessor import failed:', error.message);
    console.error('❌ Full error:', error);
}

const { processDocument, deleteDocumentEmbeddings } = require('../utils/ragProcessor');

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.params.projectId || req.body.projectId;
    const uploadPath = path.join('uploads', 'documents', projectId);
    
    fs.mkdir(uploadPath, { recursive: true })
      .then(() => cb(null, uploadPath))
      .catch(err => cb(err));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Only allow PDF files for RAG
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed for document upload'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for PDFs
    files: 10 // Maximum 10 PDFs per upload
  },
  fileFilter: fileFilter
});

// Upload PDF documents to project
const uploadDocuments = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    
    // DEBUG: Check if processDocument is available
    console.log('🔍 DEBUG: processDocument type at upload time:', typeof processDocument);
    
    // Check if user has edit access to the project
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel || accessLevel === 'view') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to upload documents to this project'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No PDF files uploaded'
      });
    }

    const uploadedDocuments = [];

    // Save document information to database and start processing
    for (const file of req.files) {
      const result = await query(`
        INSERT INTO project_documents (
          project_id, filename, original_filename, file_path, file_size, 
          mime_type, upload_type, uploaded_by, pinecone_namespace
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, filename, original_filename, file_size, processing_status, upload_date
      `, [
        projectId,
        path.basename(file.filename),
        file.originalname,
        file.path,
        file.size,
        file.mimetype,
        'file',
        req.user.id,
        `project_${projectId}_doc_${Date.now()}`
      ]);

      const document = result.rows[0];
      uploadedDocuments.push(document);

      // DEBUG: Check processDocument before calling
      console.log('🔍 About to call processDocument for document:', document.id);
      console.log('🔍 processDocument type:', typeof processDocument);
      
      if (typeof processDocument !== 'function') {
        throw new Error(`processDocument is not a function, it's ${typeof processDocument}`);
      }

      // Start background processing
      processDocument(document.id, file.path)
        .catch(error => {
          console.error(`Failed to process document ${document.id}:`, error);
        });
    }

    // Log activity
    await logActivity(req.user.id, projectId, 'documents_uploaded', {
      documentCount: uploadedDocuments.length,
      documentNames: uploadedDocuments.map(d => d.original_filename)
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: `${uploadedDocuments.length} document(s) uploaded successfully and processing started`,
      documents: uploadedDocuments
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload documents'
    });
  }
};

// Upload documents from URLs
const uploadDocumentsFromUrls = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { urls } = req.body;
    
    // Check if user has edit access to the project
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel || accessLevel === 'view') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to upload documents to this project'
      });
    }

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'URLs array is required'
      });
    }

    if (urls.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 URLs allowed per request'
      });
    }

    const uploadedDocuments = [];
    const failedUrls = [];

    for (const url of urls) {
      try {
        // Validate URL
        const urlObj = new URL(url);
        if (!url.toLowerCase().endsWith('.pdf')) {
          failedUrls.push({ url, error: 'URL must point to a PDF file' });
          continue;
        }

        // Download the PDF
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000,
          maxContentLength: 50 * 1024 * 1024 // 50MB limit
        });

        // Generate filename from URL
        const urlPath = urlObj.pathname;
        const originalFilename = path.basename(urlPath) || `document_${Date.now()}.pdf`;
        const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${originalFilename}`;
        
        // Save file to disk
        const uploadPath = path.join('uploads', 'documents', projectId);
        await fs.mkdir(uploadPath, { recursive: true });
        const filePath = path.join(uploadPath, filename);
        await fs.writeFile(filePath, response.data);

        // Save to database
        const result = await query(`
          INSERT INTO project_documents (
            project_id, filename, original_filename, file_path, file_url, file_size, 
            mime_type, upload_type, uploaded_by, pinecone_namespace
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, filename, original_filename, file_size, processing_status, upload_date
        `, [
          projectId,
          filename,
          originalFilename,
          filePath,
          url,
          response.data.length,
          'application/pdf',
          'url',
          req.user.id,
          `project_${projectId}_doc_${Date.now()}`
        ]);

        const document = result.rows[0];
        uploadedDocuments.push(document);

        // Start background processing
        processDocument(document.id, filePath)
          .catch(error => {
            console.error(`Failed to process document ${document.id}:`, error);
          });

      } catch (error) {
        console.error(`Failed to process URL ${url}:`, error);
        failedUrls.push({ 
          url, 
          error: error.message || 'Failed to download or process PDF'
        });
      }
    }

    // Log activity
    if (uploadedDocuments.length > 0) {
      await logActivity(req.user.id, projectId, 'documents_uploaded_from_urls', {
        documentCount: uploadedDocuments.length,
        successfulUrls: uploadedDocuments.map(d => d.original_filename),
        failedUrls: failedUrls.length
      }, req.ip, req.get('User-Agent'));
    }

    res.json({
      success: true,
      message: `${uploadedDocuments.length} document(s) uploaded successfully`,
      documents: uploadedDocuments,
      failed: failedUrls
    });

  } catch (error) {
    console.error('URL upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload documents from URLs'
    });
  }
};

// Get project documents
const getProjectDocuments = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    
    // Check if user has access to the project
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this project'
      });
    }

    const result = await query(`
      SELECT pd.id, pd.filename, pd.original_filename, pd.file_size, pd.upload_type,
             pd.processing_status, pd.upload_date, pd.processed_date, pd.page_count,
             pd.error_message, u.first_name, u.last_name, u.email,
             COUNT(dc.id) as chunk_count
      FROM project_documents pd
      LEFT JOIN users u ON pd.uploaded_by = u.id
      LEFT JOIN document_chunks dc ON pd.id = dc.document_id
      WHERE pd.project_id = $1
      GROUP BY pd.id, u.first_name, u.last_name, u.email
      ORDER BY pd.upload_date DESC
    `, [projectId]);

    const documents = result.rows.map(row => ({
      id: row.id,
      filename: row.filename,
      originalFilename: row.original_filename,
      fileSize: row.file_size,
      uploadType: row.upload_type,
      processingStatus: row.processing_status,
      uploadDate: row.upload_date,
      processedDate: row.processed_date,
      pageCount: row.page_count,
      chunkCount: parseInt(row.chunk_count),
      errorMessage: row.error_message,
      uploadedBy: row.first_name ? {
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email
      } : null
    }));

    res.json({
      success: true,
      documents
    });

  } catch (error) {
    console.error('Get project documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get project documents'
    });
  }
};

// Delete project document
const deleteDocument = async (req, res) => {
  try {
    const { projectId, documentId } = req.params;
    
    // Check if user has edit access to the project
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel || accessLevel === 'view') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete documents from this project'
      });
    }

    // Get document information
    const result = await query(`
      SELECT pd.*, u.id as uploader_id
      FROM project_documents pd
      LEFT JOIN users u ON pd.uploaded_by = u.id
      WHERE pd.id = $1 AND pd.project_id = $2
    `, [documentId, projectId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = result.rows[0];

    // Only document uploader or project owner can delete
    if (document.uploader_id !== req.user.id && accessLevel !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete documents you uploaded'
      });
    }

    // Delete embeddings from Pinecone
    if (document.pinecone_namespace) {
      try {
        await deleteDocumentEmbeddings(document.pinecone_namespace, documentId);
      } catch (error) {
        console.error('Failed to delete embeddings:', error);
        // Continue with database deletion even if Pinecone fails
      }
    }

    // Delete from database (chunks will be deleted by CASCADE)
    await query(`
      DELETE FROM project_documents
      WHERE id = $1 AND project_id = $2
    `, [documentId, projectId]);

    // Delete file from disk
    if (document.file_path) {
      try {
        await fs.unlink(document.file_path);
      } catch (error) {
        console.error('Failed to delete file from disk:', error);
        // Continue anyway since document is deleted from database
      }
    }

    // Log activity
    await logActivity(req.user.id, projectId, 'document_deleted', {
      documentName: document.original_filename,
      documentId: documentId
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document'
    });
  }
};

// Reprocess document (if processing failed)
const reprocessDocument = async (req, res) => {
  try {
    const { projectId, documentId } = req.params;
    
    // Check if user has edit access to the project
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel || accessLevel === 'view') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to reprocess documents'
      });
    }

    // Get document information
    const result = await query(`
      SELECT file_path, processing_status
      FROM project_documents
      WHERE id = $1 AND project_id = $2
    `, [documentId, projectId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = result.rows[0];

    if (document.processing_status === 'processing') {
      return res.status(400).json({
        success: false,
        message: 'Document is already being processed'
      });
    }

    // Reset status to pending
    await query(`
      UPDATE project_documents 
      SET processing_status = 'pending', error_message = NULL
      WHERE id = $1
    `, [documentId]);

    // Start reprocessing
    processDocument(documentId, document.file_path)
      .catch(error => {
        console.error(`Failed to reprocess document ${documentId}:`, error);
      });

    res.json({
      success: true,
      message: 'Document reprocessing started'
    });

  } catch (error) {
    console.error('Reprocess document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start document reprocessing'
    });
  }
};

module.exports = {
  upload,
  uploadDocuments,
  uploadDocumentsFromUrls,
  getProjectDocuments,
  deleteDocument,
  reprocessDocument
};
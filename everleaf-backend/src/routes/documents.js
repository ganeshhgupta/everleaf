const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { verifyToken } = require('../middleware/auth');
const { validateId } = require('../middleware/validation');

// All document routes require authentication
router.use(verifyToken);

// Upload documents (files)
router.post('/:projectId/upload', 
  documentController.upload.array('documents', 10), 
  documentController.uploadDocuments
);

// Upload documents from URLs
router.post('/:projectId/upload-urls', 
  validateId('projectId'),
  documentController.uploadDocumentsFromUrls
);

// Get project documents
router.get('/:projectId', 
  validateId('projectId'),
  documentController.getProjectDocuments
);

// Delete document
router.delete('/:projectId/:documentId', 
  validateId('projectId'),
  validateId('documentId'),
  documentController.deleteDocument
);

// Reprocess document
router.post('/:projectId/:documentId/reprocess', 
  validateId('projectId'),
  validateId('documentId'),
  documentController.reprocessDocument
);

module.exports = router;
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fileController = require('../controllers/fileController');
const { verifyToken } = require('../middleware/auth');
const { validateId } = require('../middleware/validation');

// Configure multer for ZIP file imports
const importUpload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for ZIP files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  }
});

// All routes require authentication
router.use(verifyToken);

// Project file operations
router.post('/projects/:projectId/upload', 
  validateId('projectId'),
  fileController.upload.array('files', 10),
  fileController.uploadProjectFiles
);

router.get('/projects/:projectId/files',
  validateId('projectId'),
  fileController.getProjectFiles
);

router.get('/projects/:projectId/files/:fileId/download',
  validateId('projectId'),
  validateId('fileId'),
  fileController.downloadProjectFile
);

router.delete('/projects/:projectId/files/:fileId',
  validateId('projectId'),
  validateId('fileId'),
  fileController.deleteProjectFile
);

// LaTeX project import
router.post('/import/latex',
  importUpload.single('zipFile'),
  fileController.importLatexProject
);

module.exports = router;
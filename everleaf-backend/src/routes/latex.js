const express = require('express');
const router = express.Router();
const latexController = require('../controllers/latexController');
const { verifyToken } = require('../middleware/auth');

// Public health check (no auth required)
router.get('/health', latexController.healthCheck);

// Test endpoint (no auth required for testing)
router.get('/test', latexController.testCloudServices);

// All other routes require authentication
router.use(verifyToken);

// LaTeX compilation endpoints
router.post('/projects/:projectId/compile', latexController.compileLatex);
router.post('/projects/:projectId/compile/system', latexController.compileLatexSystem);
router.post('/projects/:projectId/compile/cloud', latexController.compileLatexCloud);

module.exports = router;
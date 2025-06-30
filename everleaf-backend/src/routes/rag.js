// Create: everleaf-backend/routes/rag.js

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { validateId } = require('../middleware/validation');
const { getRelevantContext } = require('../utils/ragProcessor');
const Project = require('../models/Project');

// All RAG routes require authentication
router.use(verifyToken);

// Query RAG for relevant context
router.post('/query', async (req, res) => {
  try {
    const { projectId, query, maxChunks = 5 } = req.body;
    
    if (!projectId || !query) {
      return res.status(400).json({
        success: false,
        message: 'Project ID and query are required'
      });
    }

    // Check if user has access to the project
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this project'
      });
    }

    // Get relevant context using RAG
    const context = await getRelevantContext(projectId, query, maxChunks);
    
    res.json({
      success: true,
      context,
      message: `Found ${context.chunks.length} relevant chunks`
    });

  } catch (error) {
    console.error('RAG query error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to query documents'
    });
  }
});

module.exports = router;
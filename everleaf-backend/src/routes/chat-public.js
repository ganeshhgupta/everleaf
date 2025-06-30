const express = require('express');
const router = express.Router();

// ==============================================
// PUBLIC CHAT ROUTES (NO AUTHENTICATION)
// ==============================================

// Basic ping test
router.get('/ping', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Public chat routes are working',
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'Chat API is running',
        timestamp: new Date().toISOString(),
        services: {
            status: 'healthy'
        }
    });
});

// Debug endpoint
router.get('/debug', (req, res) => {
    res.json({
        success: true,
        message: 'Debug endpoint - no auth required',
        requestInfo: {
            method: req.method,
            path: req.path,
            hasAuthHeader: !!req.headers.authorization
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
const express = require('express');
const router = express.Router();

// Import chat controller with error handling
let chatController;
try {
    chatController = require('../controllers/chatController');
    console.log('✅ Chat controller loaded successfully');
} catch (error) {
    console.error('❌ Chat controller not found, creating placeholder:', error.message);
    
    // Placeholder controller for testing
    chatController = {
        testConnection: (req, res) => {
            res.status(501).json({ 
                success: false, 
                error: 'Chat controller not implemented yet',
                message: 'Please create controllers/chatController.js' 
            });
        },
        getOrCreateConversation: (req, res) => {
            res.status(501).json({ 
                success: false, 
                error: 'Chat controller not implemented yet',
                message: 'Please create controllers/chatController.js' 
            });
        },
        getConversationHistory: (req, res) => {
            res.status(501).json({ 
                success: false, 
                error: 'Chat controller not implemented yet' 
            });
        },
        sendMessage: (req, res) => {
            res.status(501).json({ 
                success: false, 
                error: 'Chat controller not implemented yet' 
            });
        },
        latexAssist: (req, res) => {
            res.status(501).json({ 
                success: false, 
                error: 'Chat controller not implemented yet' 
            });
        },
        markChangesApplied: (req, res) => {
            res.status(501).json({ 
                success: false, 
                error: 'Chat controller not implemented yet' 
            });
        },
        getUserConversations: (req, res) => {
            res.status(501).json({ 
                success: false, 
                error: 'Chat controller not implemented yet' 
            });
        },
        queryContext: (req, res) => {
            res.status(501).json({ 
                success: false, 
                error: 'RAG functionality not implemented yet',
                message: 'Please update controllers/chatController.js with RAG support'
            });
        }
    };
}

// Import auth middleware with error handling
let auth;
try {
    const authModule = require('../middleware/auth');
    
    // Check different possible exports
    if (typeof authModule === 'function') {
        auth = authModule;
        console.log('✅ Auth middleware loaded (direct function)');
    } else if (authModule.authenticateToken) {
        auth = authModule.authenticateToken;
        console.log('✅ Auth middleware loaded (authenticateToken)');
    } else if (authModule.verifyToken) {
        auth = authModule.verifyToken;
        console.log('✅ Auth middleware loaded (verifyToken)');
    } else if (authModule.default) {
        auth = authModule.default;
        console.log('✅ Auth middleware loaded (default export)');
    } else if (authModule.auth) {
        auth = authModule.auth;
        console.log('✅ Auth middleware loaded (auth property)');
    } else {
        throw new Error('No auth function found in middleware/auth.js');
    }
} catch (error) {
    console.warn('⚠️  Auth middleware not found, using fallback:', error.message);
    
    // Fallback auth middleware for testing
    auth = (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1] || 
                     req.cookies?.token || 
                     req.headers['x-auth-token'];
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required',
                message: 'Please provide a valid token in Authorization header, cookie, or x-auth-token header' 
            });
        }
        
        // For testing purposes - replace with your actual token validation
        try {
            // Mock user - replace this with your actual JWT verification logic
            req.user = { 
                id: 1, 
                email: 'test@example.com',
                firstName: 'Test',
                lastName: 'User'
            };
            console.log('🔐 Using fallback auth - user authenticated:', req.user.email);
            next();
        } catch (err) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid token' 
            });
        }
    };
}

// ==============================================
// TEMPORARY: RAG ROUTE WITHOUT AUTH (FOR TESTING)
// ==============================================

// Query RAG context for a project (TEMP: no auth for testing)
// Query RAG context for a project (TEMP: no auth for testing)
router.post('/projects/:projectId/query-context', (req, res, next) => {
    console.log('🧪 RAG route hit - bypassing auth for testing');
    console.log('📊 Request body:', req.body);
    console.log('📊 Project ID:', req.params.projectId);
    
    // Mock user for testing
    req.user = { 
        id: 1, 
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
    };
    next();
}, (req, res, next) => {
    console.log('🎯 About to call chatController.queryContext');
    next();
}, chatController.queryContext);

// ==============================================
// ALL OTHER ROUTES REQUIRE AUTHENTICATION
// ==============================================
// Note: Public routes are handled in routes/chat-public.js

// Apply authentication to ALL routes below this point
router.use(auth);

// ==============================================
// TEST AND DEBUG ROUTES
// ==============================================

// Test endpoint to verify everything is working (with auth)
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Authenticated chat routes are working!',
        user: req.user,
        chatController: chatController ? 'loaded' : 'placeholder',
        timestamp: new Date().toISOString(),
        availableRoutes: [
            'GET /api/chat-public/health (no auth)',
            'GET /api/chat/test (auth required)',
            'GET /api/chat/projects/:projectId/conversation',
            'GET /api/chat/conversations/:conversationId/history',
            'POST /api/chat/conversations/:conversationId/messages',
            'POST /api/chat/conversations/:conversationId/latex-assist',
            'PATCH /api/chat/messages/:messageId/applied',
            'GET /api/chat/conversations',
            'POST /api/chat/projects/:projectId/query-context [RAG]'
        ]
    });
});

// Test database connection (authenticated)
router.get('/db-test', chatController.testConnection);

// ==============================================
// CORE CHAT ROUTES
// ==============================================

// Get or create conversation for a project
router.get('/projects/:projectId/conversation', chatController.getOrCreateConversation);

// Get conversation history
router.get('/conversations/:conversationId/history', chatController.getConversationHistory);

// Send message to conversation
router.post('/conversations/:conversationId/messages', chatController.sendMessage);

// LaTeX-specific assistance
router.post('/conversations/:conversationId/latex-assist', chatController.latexAssist);

// Mark message changes as applied
router.patch('/messages/:messageId/applied', chatController.markChangesApplied);

// Get all conversations for authenticated user
router.get('/conversations', chatController.getUserConversations);

// ==============================================
// RAG-ENHANCED ROUTES (MOVED TO TOP FOR TESTING)
// ==============================================

// RAG route is now above, with temporary auth bypass

// ==============================================
// UTILITY ROUTES
// ==============================================

// Get project chat statistics
router.get('/projects/:projectId/stats', (req, res) => {
    res.json({
        success: true,
        message: 'Chat stats endpoint - not yet implemented',
        projectId: req.params.projectId
    });
});

// Clear conversation history (admin/testing)
router.delete('/conversations/:conversationId', (req, res) => {
    res.json({
        success: true,
        message: 'Clear conversation endpoint - not yet implemented',
        conversationId: req.params.conversationId
    });
});

// ==============================================
// ERROR HANDLING
// ==============================================

// Error handling middleware for chat routes
router.use((error, req, res, next) => {
    console.error('Chat route error:', error);
    
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: error.message
        });
    }
    
    if (error.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            error: 'Authentication failed',
            details: error.message
        });
    }
    
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

module.exports = router;
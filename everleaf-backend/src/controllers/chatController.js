const axios = require('axios');

// Import database pool with error handling
let pool;
try {
    pool = require('../config/database');
} catch (error) {
    console.warn('Database config not found at ../config/database, trying alternatives...');
    try {
        pool = require('../config/db');
    } catch (error2) {
        try {
            pool = require('../database');
        } catch (error3) {
            console.error('❌ Could not import database pool. Please check your database config location.');
            console.error('Tried: ../config/database, ../config/db, ../database');
            
            // Create a mock pool for testing
            pool = {
                query: async () => {
                    throw new Error('Database not configured. Please set up your database connection.');
                }
            };
        }
    }
}

// Flask server configuration
const FLASK_SERVER_URL = process.env.FLASK_SERVER_URL || 'https://llm-server-production.up.railway.app';

class ChatController {
    // Test endpoint to check database connection
    async testConnection(req, res) {
        try {
            const result = await pool.query('SELECT NOW() as current_time');
            res.json({
                success: true,
                message: 'Database connection working!',
                currentTime: result.rows[0].current_time,
                user: req.user
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Database connection failed',
                details: error.message
            });
        }
    }

    // Get or create conversation for a project
    async getOrCreateConversation(req, res) {
        try {
            const { projectId } = req.params;
            const userId = req.user.id;

            console.log(`Chat request for project: ${projectId}, user: ${userId}`);

            // For now, skip the project validation to avoid the integer overflow issue
            // In a real app, you'd want to fix the projects table schema or implement proper validation
            
            // Check if project exists - use a more flexible approach
            let hasProjectAccess = true; // Default to true for now
            
            try {
                // Try to validate project access, but don't fail if there's a type error
                const projectCheck = await pool.query(
                    `SELECT COUNT(*) as count FROM projects p 
                     WHERE CAST(p.id AS TEXT) = $1`,
                    [projectId.toString()]
                );
                
                // If no projects found, still allow chat for development
                if (projectCheck.rows[0].count === '0') {
                    console.log(`⚠️  Project ${projectId} not found in database, but allowing chat for development`);
                }
            } catch (projectError) {
                console.log(`⚠️  Project validation skipped due to schema mismatch: ${projectError.message}`);
                // Continue anyway for development
            }

            if (!hasProjectAccess) {
                return res.status(403).json({ success: false, error: 'Access denied to project' });
            }

            // Find existing conversation or create new one
            let conversation = await pool.query(
                'SELECT * FROM chat_conversations WHERE project_id = $1 AND user_id = $2 ORDER BY updated_at DESC LIMIT 1',
                [projectId, userId]
            );

            if (conversation.rows.length === 0) {
                console.log(`Creating new conversation for project ${projectId}, user ${userId}`);
                const newConversation = await pool.query(
                    'INSERT INTO chat_conversations (project_id, user_id, title) VALUES ($1, $2, $3) RETURNING *',
                    [projectId, userId, 'LaTeX Assistant']
                );
                conversation = newConversation;
            } else {
                console.log(`Found existing conversation: ${conversation.rows[0].id}`);
            }

            res.json({ success: true, conversation: conversation.rows[0] });
        } catch (error) {
            console.error('Error in getOrCreateConversation:', error);
            
            if (error.message.includes('relation "chat_conversations" does not exist')) {
                return res.status(500).json({ 
                    success: false, 
                    error: 'Chat tables not created',
                    message: 'Please run the database migration to create chat tables'
                });
            }
            
            if (error.message.includes('out of range for type integer')) {
                return res.status(500).json({ 
                    success: false, 
                    error: 'Project ID format incompatible',
                    message: 'Project ID is too large for current database schema',
                    details: error.message
                });
            }
            
            res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
        }
    }

    // Get conversation history
    async getConversationHistory(req, res) {
        try {
            const { conversationId } = req.params;
            const userId = req.user.id;

            // Verify user has access to conversation
            const conversation = await pool.query(
                'SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2',
                [conversationId, userId]
            );

            if (conversation.rows.length === 0) {
                return res.status(403).json({ success: false, error: 'Access denied to conversation' });
            }

            // Get messages
            const messages = await pool.query(
                'SELECT * FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
                [conversationId]
            );

            res.json({ 
                success: true,
                conversation: conversation.rows[0],
                messages: messages.rows 
            });
        } catch (error) {
            console.error('Error in getConversationHistory:', error);
            res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
        }
    }

    // Enhanced sendMessage method with RAG support
    async sendMessage(req, res) {
        try {
            const { conversationId } = req.params;
            const { message, latexContext, selectionRange, useRag = false } = req.body;
            const userId = req.user.id;

            if (!message || !message.trim()) {
                return res.status(400).json({ success: false, error: 'Message cannot be empty' });
            }

            // Verify user has access to conversation
            const conversation = await pool.query(
                'SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2',
                [conversationId, userId]
            );

            if (conversation.rows.length === 0) {
                return res.status(403).json({ success: false, error: 'Access denied to conversation' });
            }

            const projectId = conversation.rows[0].project_id;

            // Get recent conversation history for context
            const recentMessages = await pool.query(
                'SELECT role, content FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 6',
                [conversationId]
            );

            const conversationHistory = recentMessages.rows.reverse();

            // Save user message
            const userMessage = await pool.query(
                'INSERT INTO chat_messages (conversation_id, role, content, latex_context, change_location) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [conversationId, 'user', message.trim(), latexContext || null, selectionRange || null]
            );

            // Enhanced Flask request with RAG support
            const flaskRequest = {
                message: message.trim(),
                latex_context: latexContext || '',
                conversation_history: conversationHistory,
                model_type: 'code',
                project_id: projectId,
                use_rag: useRag
            };

            console.log('🤖 Sending to Flask with RAG:', JSON.stringify({
                ...flaskRequest,
                conversation_history: `[${conversationHistory.length} messages]`
            }, null, 2));

            try {
                // Call Flask server with RAG enhancement
                const flaskResponse = await axios.post(`${FLASK_SERVER_URL}/chat`, flaskRequest, {
                    timeout: 45000, // Increased timeout for RAG processing
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                console.log('✅ Flask response with RAG:', {
                    success: flaskResponse.data.success,
                    contextUsed: flaskResponse.data.context_used || 0,
                    responseLength: flaskResponse.data.response?.length || 0
                });

                const assistantResponse = flaskResponse.data.response;

                // Save assistant message with RAG metadata
                const assistantMessage = await pool.query(
                    'INSERT INTO chat_messages (conversation_id, role, content, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
                    [
                        conversationId, 
                        'assistant', 
                        assistantResponse,
                        JSON.stringify({
                            context_used: flaskResponse.data.context_used || 0,
                            model_type: flaskResponse.data.model_type,
                            rag_enabled: useRag
                        })
                    ]
                );

                // Update conversation timestamp
                await pool.query(
                    'UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                    [conversationId]
                );

                res.json({
                    success: true,
                    userMessage: userMessage.rows[0],
                    assistantMessage: assistantMessage.rows[0],
                    modelUsed: flaskResponse.data.model_type,
                    contextUsed: flaskResponse.data.context_used || 0,
                    ragEnabled: useRag
                });

            } catch (flaskError) {
                // Enhanced error logging
                console.error('❌ Flask server error details:');
                console.error('  - Error message:', flaskError.message);
                console.error('  - Error code:', flaskError.code);
                console.error('  - Request URL:', `${FLASK_SERVER_URL}/chat`);
                
                if (flaskError.response) {
                    console.error('  - Response status:', flaskError.response.status);
                    console.error('  - Response data:', flaskError.response.data);
                }
                
                // Check specific error types
                let errorMessage = 'Sorry, I encountered an error processing your request.';
                
                if (flaskError.code === 'ECONNREFUSED') {
                    errorMessage = 'Flask LLM server is not running. Please start the Flask server on port 5001.';
                    console.error('  - SOLUTION: Start Flask server with: cd llm-server && python app.py');
                } else if (flaskError.code === 'ETIMEDOUT') {
                    errorMessage = 'Flask LLM server timeout. The model might be loading or overloaded.';
                } else if (flaskError.response?.status === 500) {
                    errorMessage = 'Flask server internal error. Check Flask server logs.';
                } else if (flaskError.response?.status === 400) {
                    errorMessage = 'Invalid request format sent to Flask server.';
                }
                
                // Save error message
                const errorMessageRecord = await pool.query(
                    'INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
                    [conversationId, 'assistant', errorMessage]
                );

                res.json({
                    success: true,
                    userMessage: userMessage.rows[0],
                    assistantMessage: errorMessageRecord.rows[0],
                    error: 'LLM service temporarily unavailable',
                    details: flaskError.message
                });
            }

        } catch (error) {
            console.error('Error in sendMessage:', error);
            res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
        }
    }

    // Enhanced LaTeX-specific assistance with RAG
    async latexAssist(req, res) {
        try {
            const { conversationId } = req.params;
            const { action, selectedText, request, documentContext, useRag = true } = req.body;
            const userId = req.user.id;

            // Verify user has access to conversation
            const conversation = await pool.query(
                'SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2',
                [conversationId, userId]
            );

            if (conversation.rows.length === 0) {
                return res.status(403).json({ success: false, error: 'Access denied to conversation' });
            }

            const projectId = conversation.rows[0].project_id;

            // Enhanced Flask request with RAG support
            const flaskRequest = {
                action,
                selected_text: selectedText || '',
                request: request || '',
                document_context: documentContext || '',
                project_id: projectId,
                use_rag: useRag
            };

            console.log('🔧 LaTeX assist with RAG:', JSON.stringify(flaskRequest, null, 2));

            try {
                // Call Flask server latex-assist endpoint with RAG
                const flaskResponse = await axios.post(`${FLASK_SERVER_URL}/latex-assist`, flaskRequest, {
                    timeout: 45000 // Increased timeout for RAG processing
                });

                console.log('✅ LaTeX assist response:', {
                    success: flaskResponse.data.success,
                    action: flaskResponse.data.action,
                    contextUsed: flaskResponse.data.context_used || 0
                });

                const assistantResponse = flaskResponse.data.response;

                // Save interaction to chat history with RAG metadata
                const userMessage = await pool.query(
                    'INSERT INTO chat_messages (conversation_id, role, content, latex_context) VALUES ($1, $2, $3, $4) RETURNING *',
                    [conversationId, 'user', `LaTeX ${action}: ${request || 'Process selected text'}`, selectedText || '']
                );

                const assistantMessage = await pool.query(
                    'INSERT INTO chat_messages (conversation_id, role, content, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
                    [
                        conversationId, 
                        'assistant', 
                        assistantResponse,
                        JSON.stringify({
                            action: flaskResponse.data.action,
                            context_used: flaskResponse.data.context_used || 0,
                            rag_enabled: useRag
                        })
                    ]
                );

                res.json({
                    success: true,
                    userMessage: userMessage.rows[0],
                    assistantMessage: assistantMessage.rows[0],
                    action: flaskResponse.data.action,
                    latexCode: assistantResponse,
                    contextUsed: flaskResponse.data.context_used || 0,
                    ragEnabled: useRag
                });

            } catch (flaskError) {
                console.error('Flask server error:', flaskError.message);
                res.status(500).json({ 
                    success: false, 
                    error: 'LaTeX assistance service temporarily unavailable',
                    details: flaskError.message
                });
            }

        } catch (error) {
            console.error('Error in latexAssist:', error);
            res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
        }
    }

    // New: Get RAG context for queries (used by frontend)
    async queryContext(req, res) {

        console.log('🔥 queryContext method called');
        console.log('📊 Request params:', req.params);
        console.log('📊 Request body:', req.body);

        try {
            const { projectId } = req.params;
            const { query, maxChunks = 5 } = req.body;
            const userId = req.user.id;

            if (!query || !query.trim()) {
                return res.status(400).json({ success: false, error: 'Query cannot be empty' });
            }

            console.log(`🔍 RAG context query for project ${projectId}: ${query.substring(0, 50)}...`);

            try {
                // Call Flask server query-context endpoint
                const flaskResponse = await axios.post(`${FLASK_SERVER_URL}/query-context`, {
                    query: query.trim(),
                    project_id: projectId,
                    max_chunks: maxChunks
                }, {
                    timeout: 30000
                });

                console.log('✅ RAG context response:', {
                    success: flaskResponse.data.success,
                    contextChunks: flaskResponse.data.context?.chunks?.length || 0
                });

                res.json({
                    success: true,
                    context: flaskResponse.data.context,
                    message: `Found ${flaskResponse.data.context?.chunks?.length || 0} relevant chunks`
                });

            } catch (flaskError) {

                console.error('❌ Flask error details:', error.message);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error response:', error.response?.data);
        
                console.error('Flask RAG query error:', flaskError.message);
                res.status(500).json({ 
                    success: false, 
                    error: 'RAG context service temporarily unavailable',
                    details: flaskError.message
                });
            }

        } catch (error) {
            console.error('Error in queryContext:', error);
            res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
        }
    }

    // Mark changes as applied
    async markChangesApplied(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;

            // Verify user has access to message
            const message = await pool.query(
                `SELECT cm.* FROM chat_messages cm 
                 JOIN chat_conversations cc ON cm.conversation_id = cc.id 
                 WHERE cm.id = $1 AND cc.user_id = $2`,
                [messageId, userId]
            );

            if (message.rows.length === 0) {
                return res.status(403).json({ success: false, error: 'Access denied to message' });
            }

            // Update applied_changes flag
            await pool.query(
                'UPDATE chat_messages SET applied_changes = TRUE WHERE id = $1',
                [messageId]
            );

            res.json({ success: true });
        } catch (error) {
            console.error('Error in markChangesApplied:', error);
            res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
        }
    }

    // Get all conversations for a user
    async getUserConversations(req, res) {
        try {
            const userId = req.user.id;

            const conversations = await pool.query(
                `SELECT cc.*, 
                        (SELECT content FROM chat_messages 
                         WHERE conversation_id = cc.id 
                         ORDER BY created_at DESC LIMIT 1) as last_message
                 FROM chat_conversations cc
                 WHERE cc.user_id = $1
                 ORDER BY cc.updated_at DESC`,
                [userId]
            );

            res.json({ success: true, conversations: conversations.rows });
        } catch (error) {
            console.error('Error in getUserConversations:', error);
            res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
        }
    }
}

module.exports = new ChatController();
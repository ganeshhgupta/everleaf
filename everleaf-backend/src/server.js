const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const http = require('http');
const multer = require('multer');
const axios = require('axios'); // For Flask server health checks
require('dotenv').config();

// Import configurations and utilities
const { cleanExpiredSessions } = require('./middleware/auth');
const { testConnection: testDbConnection } = require('./config/database');
const WebSocketManager = require('./utils/websocket');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const fileRoutes = require('./routes/files');
const aiRoutes = require('./routes/ai');
const latexRoutes = require('./routes/latex');
const chatRoutes = require('./routes/chat');
const chatPublicRoutes = require('./routes/chat-public'); // ADD THIS LINE
const documentRoutes = require('./routes/documents');
const ragRoutes = require('./routes/rag');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Flask LLM Server configuration
const FLASK_SERVER_URL = process.env.FLASK_SERVER_URL || 'https://llm-server-production.up.railway.app';

// Initialize WebSocket manager
let wsManager;

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Configure CORS for production and development
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL, // Your main production URL
      'http://localhost:3000',  // Local development
      'http://127.0.0.1:3000'   // Local development alternative
    ];
    
    // Add production Vercel URLs
    const vercelPatterns = [
      /^https:\/\/.*\.vercel\.app$/,  // Any Vercel subdomain
      /^https:\/\/everleaf.*\.vercel\.app$/, // Your specific app pattern
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check exact matches first
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // Check Vercel pattern matches
    const isVercelOrigin = vercelPatterns.some(pattern => pattern.test(origin));
    if (isVercelOrigin) {
      return callback(null, true);
    }
    
    // Log rejected origins for debugging
    console.log('CORS rejected origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// Stricter rate limiting for chat endpoints
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 chat requests per minute
  message: {
    success: false,
    message: 'Too many chat requests, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'production') {
  // Create logs directory if it doesn't exist
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Log to file in production
  const accessLogStream = fs.createWriteStream(
    path.join(logDir, 'access.log'),
    { flags: 'a' }
  );
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  // Console logging in development
  app.use(morgan('dev'));
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Flask server health check utility
const checkFlaskServer = async () => {
  try {
    const response = await axios.get(`${FLASK_SERVER_URL}/health`, { timeout: 5000 });
    return { status: 'connected', data: response.data };
  } catch (error) {
    return { 
      status: 'disconnected', 
      error: error.code || error.message || 'Unknown error' 
    };
  }
};

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  const flaskStatus = await checkFlaskServer();
  
  res.json({
    success: true,
    message: 'Everleaf API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    services: {
      database: 'connected', // You might want to add actual DB health check
      flask_llm: flaskStatus
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/latex', latexRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/chat-public', chatPublicRoutes); // ADD THIS LINE - Mount public routes first
app.use('/api/chat', chatLimiter, chatRoutes); // Keep existing chat routes

// WebSocket status endpoint
app.get('/api/ws/status', (req, res) => {
  if (wsManager) {
    res.json({
      success: true,
      stats: wsManager.getStats()
    });
  } else {
    res.status(503).json({
      success: false,
      message: 'WebSocket manager not initialized'
    });
  }
});

// 404 handler for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: 'API endpoint not found'
    });
  }
  next();
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // Multer file upload errors
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large'
      });
    }
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.errors
    });
  }

  // Database errors
  if (error.code === '23505') { // PostgreSQL unique constraint
    return res.status(400).json({
      success: false,
      message: 'Resource already exists'
    });
  }

  if (error.code === '23503') { // PostgreSQL foreign key constraint
    return res.status(400).json({
      success: false,
      message: 'Referenced resource not found'
    });
  }

  // Default error response
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Create upload directories
const createUploadDirectories = () => {
  const uploadDirs = [
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../uploads/avatars'),
    path.join(__dirname, '../uploads/projects'),
    path.join(__dirname, '../uploads/files'),
    path.join(__dirname, '../uploads/temp')
  ];

  uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created upload directory: ${dir}`);
    }
  });
};

// Cleanup function
const cleanup = async () => {
  console.log('🧹 Running cleanup tasks...');
  
  try {
    // Clean expired sessions
    await cleanExpiredSessions();
    console.log('✅ Cleaned expired sessions');
  } catch (error) {
    console.error('❌ Failed to clean expired sessions:', error);
  }
};

// Schedule cleanup tasks
const scheduleCleanup = () => {
  // Run cleanup every hour
  setInterval(cleanup, 60 * 60 * 1000);
  
  // Run cleanup once on startup
  setTimeout(cleanup, 10000); // Wait 10 seconds after startup
};

// Check Flask server on startup
const checkFlaskServerOnStartup = async () => {
  console.log('🔍 Checking Flask LLM Server connection...');
  const flaskStatus = await checkFlaskServer();
  
  if (flaskStatus.status === 'connected') {
    console.log('✅ Flask LLM Server is running and accessible');
    console.log(`🔗 Flask Server URL: ${FLASK_SERVER_URL}`);
  } else {
    console.log('⚠️  Flask LLM Server is not accessible');
    console.log(`❌ Flask Server URL: ${FLASK_SERVER_URL}`);
    console.log(`❌ Error: ${flaskStatus.error}`);
    console.log('💡 Chat features will not work until Flask server is started');
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`
🚀 To start the Flask LLM Server:
   1. Navigate to your llm-server directory
   2. Activate virtual environment: source venv/bin/activate
   3. Install dependencies: pip install -r requirements.txt
   4. Start server: python app.py
      `);
    }
  }
};

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testDbConnection();
    
    // Create upload directories
    createUploadDirectories();
    
    // Initialize WebSocket manager
    wsManager = new WebSocketManager(server);
    console.log('🔌 WebSocket manager initialized');
    
    // Schedule cleanup tasks
    scheduleCleanup();
    
    // Check Flask server
    await checkFlaskServerOnStartup();
    
    // Start listening
    server.listen(PORT, '0.0.0.0', () => {

      console.log(`
🚀 Everleaf Backend Server Started!
📍 Environment: ${process.env.NODE_ENV || 'development'}
🌐 Server running on: http://localhost:${PORT}
📊 Health check: http://localhost:${PORT}/health
🔗 API base URL: http://localhost:${PORT}/api
🔌 WebSocket support: ENABLED
🤖 Chat integration: ENABLED
      `);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`
📝 API Endpoints:
   • POST /api/auth/signup - User registration
   • POST /api/auth/login - User login
   • POST /api/auth/admin/login - Admin login
   • GET  /api/auth/verify - Verify token
   • GET  /api/users/profile - Get user profile
   • POST /api/projects - Create project
   • GET  /api/projects/my-projects - Get user projects
   • POST /api/files/projects/:id/upload - Upload files
   • GET  /api/ws/status - WebSocket status
   
🤖 Chat API Endpoints:
   • GET  /api/chat/conversation/project/:projectId - Get/create conversation
   • GET  /api/chat/conversation/:conversationId/messages - Get messages
   • POST /api/chat/conversation/:conversationId/message - Send message
   • POST /api/chat/conversation/:conversationId/latex-assist - LaTeX assistance
   • GET  /api/chat/conversations - Get user conversations
        `);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;
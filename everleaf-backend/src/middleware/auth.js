const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { query } = require('../config/database');


// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided, access denied' 
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token exists in sessions table (for logout functionality)
    const sessionResult = await query(`
      SELECT s.*, u.id, u.email, u.first_name, u.last_name, u.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP
    `, [token]);

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token is invalid or expired' 
      });
    }

    const user = sessionResult.rows[0];
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    };

    // Update last activity
    await User.updateLastLogin(user.id);

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during authentication' 
    });
  }
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  next();
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies.token;
  
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      };
    } else {
      req.user = null;
    }
  } catch (error) {
    req.user = null;
  }

  next();
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Store session in database
const storeSession = async (userId, token, userAgent, ipAddress) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  await query(`
    INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_address)
    VALUES ($1, $2, $3, $4, $5)
  `, [userId, token, expiresAt, userAgent, ipAddress]);
};

// Remove session from database (logout)
const removeSession = async (token) => {
  await query(`
    DELETE FROM sessions WHERE token_hash = $1
  `, [token]);
};

// Clean expired sessions
const cleanExpiredSessions = async () => {
  await query(`
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP
  `);
};

// Rate limiting for sensitive operations
const sensitiveRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = req.ip + (req.user ? req.user.id : '');
    const now = Date.now();
    
    if (!attempts.has(key)) {
      attempts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const attempt = attempts.get(key);
    
    if (now > attempt.resetTime) {
      attempt.count = 1;
      attempt.resetTime = now + windowMs;
      return next();
    }

    if (attempt.count >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many attempts, please try again later',
        retryAfter: Math.ceil((attempt.resetTime - now) / 1000)
      });
    }

    attempt.count++;
    next();
  };
};

module.exports = {
  verifyToken,
  requireAdmin,
  optionalAuth,
  generateToken,
  storeSession,
  removeSession,
  cleanExpiredSessions,
  sensitiveRateLimit
};
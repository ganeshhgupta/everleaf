const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  signup,
  login,
  adminLogin,
  logout,
  verifyToken,
  forgotPassword,
  resetPassword,
  googleLogin,
  changePassword
} = require('../controllers/authController');

// Regular auth routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/logout', logout);
router.get('/verify', authenticateToken, verifyToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authenticateToken, changePassword);

// NEW: Google OAuth route
router.post('/google', googleLogin);

module.exports = router;
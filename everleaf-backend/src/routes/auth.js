const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Auth routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/admin/login', authController.adminLogin);
router.get('/verify', verifyToken, authController.verifyToken);
router.post('/logout', verifyToken, authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/google', authController.googleLogin);
router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;
const express = require('express');
const router = express.Router();

// Direct import test
const authController = require('../controllers/authController');

router.post('/signup', authController.signup);

module.exports = router;
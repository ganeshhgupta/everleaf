const { body, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User registration validation
const validateUserRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
  
  body('institution')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Institution name must be less than 255 characters'),
  
  handleValidationErrors
];

// User login validation
const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

// Password reset request validation
const validatePasswordResetRequest = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  handleValidationErrors
];

// Password reset validation
const validatePasswordReset = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  handleValidationErrors
];

// Project creation validation
const validateProjectCreation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Project title must be between 1 and 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('content')
    .optional()
    .isLength({ max: 50000 })
    .withMessage('Content must be less than 50,000 characters'),
  
  body('latexContent')
    .optional()
    .isLength({ max: 50000 })
    .withMessage('LaTeX content must be less than 50,000 characters'),
  
  body('isTemplate')
    .optional()
    .isBoolean()
    .withMessage('isTemplate must be a boolean value'),
  
  body('templateCategory')
    .optional()
    .trim()
    .isIn(['research-paper', 'thesis', 'presentation', 'article', 'book', 'report', 'other'])
    .withMessage('Invalid template category'),
  
  handleValidationErrors
];

// Project update validation
const validateProjectUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Project title must be between 1 and 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('content')
    .optional()
    .isLength({ max: 50000 })
    .withMessage('Content must be less than 50,000 characters'),
  
  body('latexContent')
    .optional()
    .isLength({ max: 50000 })
    .withMessage('LaTeX content must be less than 50,000 characters'),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean value'),
  
  handleValidationErrors
];

// Collaboration invitation validation
const validateCollaborationInvite = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('permission')
    .isIn(['view', 'edit', 'admin'])
    .withMessage('Permission must be either view, edit, or admin'),
  
  handleValidationErrors
];

// User profile update validation
const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
  
  body('institution')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Institution name must be less than 255 characters'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  handleValidationErrors
];

// Search validation
const validateSearch = [
  body('query')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  
  handleValidationErrors
];

// Generic ID parameter validation
const validateId = (paramName = 'id') => [
  (req, res, next) => {
    const id = req.params[paramName];
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} parameter`
      });
    }
    next();
  }
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validatePasswordResetRequest,
  validatePasswordReset,
  validateProjectCreation,
  validateProjectUpdate,
  validateCollaborationInvite,
  validateProfileUpdate,
  validateSearch,
  validateId
};
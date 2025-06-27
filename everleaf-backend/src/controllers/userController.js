const User = require('../models/User');

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user statistics
    const stats = await User.getStats(req.user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        institution: user.institution,
        role: user.role,
        emailVerified: user.email_verified,
        avatarUrl: user.avatar_url,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      stats
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const updates = {};
    const allowedFields = ['first_name', 'last_name', 'institution'];
    
    // Map frontend field names to database field names
    const fieldMapping = {
      firstName: 'first_name',
      lastName: 'last_name',
      institution: 'institution'
    };

    Object.keys(req.body).forEach(key => {
      const dbField = fieldMapping[key] || key;
      if (allowedFields.includes(dbField)) {
        updates[dbField] = req.body[key];
      }
    });

    // Handle email updates separately (requires verification)
    if (req.body.email && req.body.email !== req.user.email) {
      // Check if email is already taken
      const existingUser = await User.findByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email address is already in use'
        });
      }
      
      updates.email = req.body.email;
      updates.email_verified = false; // Reset email verification
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const updatedUser = await User.update(req.user.id, updates);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        institution: updatedUser.institution,
        role: updatedUser.role,
        emailVerified: updatedUser.email_verified,
        avatarUrl: updatedUser.avatar_url
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// Upload user avatar
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, and GIF are allowed.'
      });
    }

    // Validate file size (5MB max)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }

    // Update user avatar URL
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const updatedUser = await User.update(req.user.id, { avatar_url: avatarUrl });

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatarUrl: avatarUrl
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload avatar'
    });
  }
};

// Delete user account
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    // Get user with password hash for verification
    const user = await User.findByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password before deletion (if user has password)
    if (user.password_hash) {
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password required to delete account'
        });
      }

      const isPasswordValid = await User.verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }
    }

    // Delete user account (CASCADE will handle related records)
    const deletedUser = await User.delete(req.user.id);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account'
    });
  }
};

// Get user's dashboard data
const getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user statistics
    const stats = await User.getStats(userId);

    // You can add more dashboard-specific data here
    // For now, we'll just return basic stats
    res.json({
      success: true,
      dashboard: {
        stats,
        user: {
          id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
          role: req.user.role
        }
      }
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard data'
    });
  }
};

// Admin: Get all users
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const users = await User.getAllUsers(limit, offset);

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        hasMore: users.length === limit
      }
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users'
    });
  }
};

// Admin: Get user by ID
const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const stats = await User.getStats(userId);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        institution: user.institution,
        role: user.role,
        emailVerified: user.email_verified,
        avatarUrl: user.avatar_url,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      stats
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user'
    });
  }
};

// Admin: Update user role
const updateUserRole = async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be either "user" or "admin"'
      });
    }

    const updatedUser = await User.update(userId, { role });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User role updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAccount,
  getDashboard,
  getAllUsers,
  getUserById,
  updateUserRole
};
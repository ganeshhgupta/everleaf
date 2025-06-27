const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  // Create a new project
  // Create a new user
  static async create(userData) {
    const { email, password, firstName, lastName, institution, googleId } = userData;
    
    // Hash password if provided (not needed for Google OAuth)
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    const result = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name, institution, google_id, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, first_name, last_name, institution, role, google_id, email_verified, created_at
    `, [email, passwordHash, firstName, lastName, institution, googleId, googleId ? true : false]);

    return result.rows[0];
  }

  // Find user by email
  static async findByEmail(email) {
    const result = await query(`
      SELECT id, email, password_hash, first_name, last_name, institution, role, 
            google_id, email_verified, last_login, created_at, updated_at
      FROM users 
      WHERE email = $1
    `, [email]);

    return result.rows[0];
  }

  // Find user by ID
  static async findById(id) {
    const result = await query(`
      SELECT id, email, first_name, last_name, institution, role, 
             google_id, email_verified, last_login, created_at, updated_at
      FROM users 
      WHERE id = $1
    `, [id]);

    return result.rows[0];
  }

  // Find user by Google ID
  static async findByGoogleId(googleId) {
    const result = await query(`
      SELECT id, email, first_name, last_name, institution, role, 
             google_id, email_verified, last_login, created_at, updated_at
      FROM users 
      WHERE google_id = $1
    `, [googleId]);

    return result.rows[0];
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Update user's last login
  static async updateLastLogin(userId) {
    await query(`
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [userId]);
  }

  // Set password reset token
  static async setResetToken(email, token, expiresAt) {
    const result = await query(`
      UPDATE users 
      SET reset_token = $1, reset_token_expires = $2 
      WHERE email = $3
      RETURNING id, email, first_name, last_name
    `, [token, expiresAt, email]);

    return result.rows[0];
  }

  // Find user by reset token
  static async findByResetToken(token) {
    const result = await query(`
      SELECT id, email, first_name, last_name, reset_token_expires
      FROM users 
      WHERE reset_token = $1 AND reset_token_expires > CURRENT_TIMESTAMP
    `, [token]);

    return result.rows[0];
  }

  // Reset password
  static async resetPassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    await query(`
      UPDATE users 
      SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL 
      WHERE id = $2
    `, [passwordHash, userId]);
  }

  // Update user profile
  static async update(userId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) return null;

    values.push(userId);
    const result = await query(`
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, institution, role, email_verified
    `, values);

    return result.rows[0];
  }

  // Verify email
  static async verifyEmail(userId) {
    const result = await query(`
      UPDATE users 
      SET email_verified = true 
      WHERE id = $1
      RETURNING id, email, first_name, last_name
    `, [userId]);

    return result.rows[0];
  }

  // Get user statistics
  static async getStats(userId) {
    const result = await query(`
      SELECT 
        COUNT(DISTINCT p.id) as project_count,
        COUNT(DISTINCT pc.project_id) as collaborations_count,
        COUNT(DISTINCT af.id) as files_count
      FROM users u
      LEFT JOIN projects p ON u.id = p.owner_id
      LEFT JOIN project_collaborators pc ON u.id = pc.user_id
      LEFT JOIN project_files af ON p.id = af.project_id
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

    return result.rows[0] || { project_count: 0, collaborations_count: 0, files_count: 0 };
  }

  // Get all users (admin only)
  static async getAllUsers(limit = 50, offset = 0) {
    const result = await query(`
      SELECT id, email, first_name, last_name, institution, role, 
             email_verified, last_login, created_at
      FROM users 
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return result.rows;
  }

  // Delete user
  static async delete(userId) {
    const result = await query(`
      DELETE FROM users 
      WHERE id = $1
      RETURNING id, email
    `, [userId]);

    return result.rows[0];
  }

  // Check if email exists
  static async emailExists(email) {
    const result = await query(`
      SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)
    `, [email]);

    return result.rows[0].exists;
  }
}

module.exports = User;
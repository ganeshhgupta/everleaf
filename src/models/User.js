const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { email, password, firstName, lastName, institution, googleId } = userData;
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

  static async findByEmail(email) {
    const result = await query(`
      SELECT id, email, password_hash, first_name, last_name, institution, role, 
             google_id, avatar_url, email_verified, last_login, created_at, updated_at
      FROM users 
      WHERE email = $1
    `, [email]);

    return result.rows[0];
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = User;
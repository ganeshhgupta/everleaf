const fs = require('fs');
const path = require('path');

// Create directories
const dirs = [
  'src/config',
  'src/controllers', 
  'src/middleware',
  'src/models',
  'src/routes',
  'src/utils',
  'uploads/avatars',
  'uploads/projects', 
  'uploads/files',
  'uploads/temp',
  'logs'
];

console.log('🚀 Setting up Everleaf backend structure...');

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Create minimal files for migration to work
const minimalFiles = {
  'src/models/User.js': `const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { email, password, firstName, lastName, institution, googleId } = userData;
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    const result = await query(\`
      INSERT INTO users (email, password_hash, first_name, last_name, institution, google_id, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, first_name, last_name, institution, role, google_id, email_verified, created_at
    \`, [email, passwordHash, firstName, lastName, institution, googleId, googleId ? true : false]);

    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await query(\`
      SELECT id, email, password_hash, first_name, last_name, institution, role, 
             google_id, avatar_url, email_verified, last_login, created_at, updated_at
      FROM users 
      WHERE email = $1
    \`, [email]);

    return result.rows[0];
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = User;`,

  'src/middleware/auth.js': `const jwt = require('jsonwebtoken');

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

const cleanExpiredSessions = async () => {
  // Placeholder for now
  console.log('Cleaning expired sessions...');
};

module.exports = {
  generateToken,
  cleanExpiredSessions
};`
};

Object.entries(minimalFiles).forEach(([filePath, content]) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Created file: ${filePath}`);
  }
});

console.log('🎉 Setup complete! You can now run: npm run migrate');
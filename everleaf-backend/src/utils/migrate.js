const { query, testConnection } = require('.../config/database');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const createTables = async () => {
  console.log('🚀 Starting database migration...');

  try {
    // Test connection first
    await testConnection();

    // Create Users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        institution VARCHAR(255),
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        google_id VARCHAR(255),
        avatar_url VARCHAR(500),
        email_verified BOOLEAN DEFAULT FALSE,
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Create Projects table
    await query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        content TEXT DEFAULT '',
        latex_content TEXT DEFAULT '',
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        is_public BOOLEAN DEFAULT FALSE,
        is_template BOOLEAN DEFAULT FALSE,
        template_category VARCHAR(100),
        last_compiled TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Projects table created');

    // Create Project Collaborators table
    await query(`
      CREATE TABLE IF NOT EXISTS project_collaborators (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        permission VARCHAR(20) DEFAULT 'edit' CHECK (permission IN ('view', 'edit', 'admin')),
        invited_by INTEGER REFERENCES users(id),
        invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accepted_at TIMESTAMP,
        UNIQUE(project_id, user_id)
      )
    `);
    console.log('✅ Project collaborators table created');

    // Create Sessions table for JWT token management
    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        user_agent TEXT,
        ip_address INET,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Sessions table created');

    // Create Project Files table
    await query(`
      CREATE TABLE IF NOT EXISTS project_files (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        uploaded_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Project files table created');

    // Create Activity Log table
    await query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Activity logs table created');

    // Create AI Generations table
    await query(`
      CREATE TABLE IF NOT EXISTS ai_generations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        prompt TEXT NOT NULL,
        generated_content TEXT,
        model_used VARCHAR(100),
        tokens_used INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ AI generations table created');

    // Create indexes for better performance
    await query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await query('CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_collaborators_project ON project_collaborators(project_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_collaborators_user ON project_collaborators(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)');
    await query('CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_logs(project_id)');
    console.log('✅ Database indexes created');

    // Create trigger for updating updated_at column
    await query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await query(`
      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await query(`
      CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Database triggers created');

    console.log('🎉 Database migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
};

// Create default admin user
const createAdminUser = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@everleaf.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';

    // Check if admin already exists
    const existingAdmin = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    
    if (existingAdmin.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      await query(`
        INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [adminEmail, hashedPassword, 'Admin', 'User', 'admin', true]);
      
      console.log('✅ Default admin user created');
      console.log(`📧 Admin email: ${adminEmail}`);
      console.log(`🔑 Admin password: ${adminPassword}`);
    } else {
      console.log('ℹ️ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
  }
};

// Run migration
const runMigration = async () => {
  await createTables();
  await createAdminUser();
  process.exit(0);
};

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { createTables, createAdminUser };
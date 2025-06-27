const fs = require('fs');
const path = require('path');

// Check if all required files exist
const requiredFiles = [
  'src/config/database.js',
  'src/middleware/auth.js',
  'src/middleware/validation.js',
  'src/models/User.js',
  'src/models/Project.js',
  'src/controllers/authController.js',
  'src/controllers/userController.js',
  'src/controllers/projectController.js',
  'src/controllers/fileController.js',
  'src/controllers/aiController.js',
  'src/routes/auth.js',
  'src/routes/users.js',
  'src/routes/projects.js',
  'src/routes/files.js',
  'src/routes/ai.js',
  'src/utils/email.js',
  'src/utils/activityLogger.js',
  'src/utils/websocket.js',
  'src/utils/aiService.js',
  'src/utils/migrate.js'
];

const requiredDirs = [
  'src',
  'src/config',
  'src/middleware',
  'src/models',
  'src/controllers',
  'src/routes',
  'src/utils',
  'uploads',
  'uploads/avatars',
  'uploads/projects',
  'uploads/files',
  'uploads/temp',
  'logs'
];

console.log('🔍 Checking Everleaf Backend Setup...\n');

// Check directories
console.log('📁 Checking directories:');
let missingDirs = [];
requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir}`);
  } else {
    console.log(`❌ ${dir} (MISSING)`);
    missingDirs.push(dir);
  }
});

// Check files
console.log('\n📄 Checking files:');
let missingFiles = [];
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} (MISSING)`);
    missingFiles.push(file);
  }
});

// Create missing directories
if (missingDirs.length > 0) {
  console.log('\n🛠️ Creating missing directories...');
  missingDirs.forEach(dir => {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created: ${dir}`);
  });
}

// Check .env file
console.log('\n🔧 Checking configuration:');
if (fs.existsSync('.env')) {
  console.log('✅ .env file exists');
} else {
  console.log('❌ .env file missing');
  console.log('📝 Please create .env file with the configuration from the setup instructions');
}

// Check package.json dependencies
if (fs.existsSync('package.json')) {
  console.log('✅ package.json exists');
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = [
      'express', 'cors', 'helmet', 'morgan', 'compression',
      'pg', 'bcryptjs', 'jsonwebtoken', 'nodemailer',
      'multer', 'socket.io', 'express-rate-limit', 'dotenv',
      'express-validator', 'cookie-parser'
    ];
    
    console.log('\n📦 Checking dependencies:');
    let missingDeps = [];
    requiredDeps.forEach(dep => {
      if (pkg.dependencies && pkg.dependencies[dep]) {
        console.log(`✅ ${dep}`);
      } else {
        console.log(`❌ ${dep} (MISSING)`);
        missingDeps.push(dep);
      }
    });
    
    if (missingDeps.length > 0) {
      console.log(`\n⚠️ Missing dependencies: ${missingDeps.join(', ')}`);
      console.log('Run: npm install');
    }
  } catch (error) {
    console.log('❌ Error reading package.json');
  }
} else {
  console.log('❌ package.json missing');
}

// Summary
console.log('\n📊 Setup Summary:');
console.log(`Directories: ${requiredDirs.length - missingDirs.length}/${requiredDirs.length} ✅`);
console.log(`Files: ${requiredFiles.length - missingFiles.length}/${requiredFiles.length} ✅`);

if (missingFiles.length > 0) {
  console.log('\n⚠️ Missing files detected!');
  console.log('Please ensure all backend component files are created as per the setup instructions.');
  console.log('\nMissing files:');
  missingFiles.forEach(file => console.log(`   - ${file}`));
} else if (missingDirs.length === 0) {
  console.log('\n🎉 All required files and directories are present!');
  console.log('💡 Next steps:');
  console.log('   1. Ensure .env file is configured');
  console.log('   2. Run: npm install');
  console.log('   3. Run: npm run migrate');
  console.log('   4. Run: npm run dev');
}

module.exports = {
  requiredFiles,
  requiredDirs
};
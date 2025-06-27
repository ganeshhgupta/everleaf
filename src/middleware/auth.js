const jwt = require('jsonwebtoken');

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
};
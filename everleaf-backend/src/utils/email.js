const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Send password reset email
const sendPasswordResetEmail = async (to, firstName, resetToken) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@everleaf.com',
      to: to,
      subject: 'Reset Your Everleaf Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🍃 Everleaf</h1>
              <p>Password Reset Request</p>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>We received a request to reset your password for your Everleaf account.</p>
              <p>Click the button below to reset your password:</p>
              <a href="${resetUrl}" class="button">Reset Password</a>
              <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 4px;">${resetUrl}</p>
              <p><strong>This link will expire in 1 hour.</strong></p>
              <p>If you didn't request this password reset, you can safely ignore this email.</p>
              <p>Best regards,<br>The Everleaf Team</p>
            </div>
            <div class="footer">
              <p>© 2024 Everleaf. All rights reserved.</p>
              <p>This is an automated email, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', result.messageId);
    return result;

  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
};

// Send welcome email
const sendWelcomeEmail = async (to, firstName) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@everleaf.com',
      to: to,
      subject: 'Welcome to Everleaf! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Everleaf</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .feature { margin: 20px 0; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #22c55e; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🍃 Welcome to Everleaf!</h1>
              <p>Your AI-powered LaTeX writing companion</p>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>Welcome to Everleaf! We're excited to have you join our community of researchers and writers.</p>
              
              <div class="feature">
                <h3>✨ AI-Powered Writing</h3>
                <p>Get intelligent suggestions and automated formatting with our AI copilot.</p>
              </div>
              
              <div class="feature">
                <h3>🤝 Real-time Collaboration</h3>
                <p>Work together seamlessly with your team in real-time.</p>
              </div>
              
              <div class="feature">
                <h3>☁️ Cloud Sync</h3>
                <p>Access your projects anywhere with automatic synchronization.</p>
              </div>
              
              <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Start Writing</a>
              
              <p>If you have any questions or need help getting started, don't hesitate to reach out to our support team.</p>
              
              <p>Happy writing!<br>The Everleaf Team</p>
            </div>
            <div class="footer">
              <p>© 2024 Everleaf. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', result.messageId);
    return result;

  } catch (error) {
    console.error('Failed to send welcome email:', error);
    throw error;
  }
};

// Send collaboration invitation email
const sendCollaborationInvite = async (to, projectTitle, inviterName, projectId) => {
  try {
    const transporter = createTransporter();
    
    const inviteUrl = `${process.env.FRONTEND_URL}/projects/${projectId}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@everleaf.com',
      to: to,
      subject: `You've been invited to collaborate on "${projectTitle}"`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Collaboration Invitation</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .project-title { background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #22c55e; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🍃 Everleaf</h1>
              <p>Collaboration Invitation</p>
            </div>
            <div class="content">
              <h2>You've been invited to collaborate!</h2>
              <p><strong>${inviterName}</strong> has invited you to collaborate on their project:</p>
              
              <div class="project-title">
                <h3>${projectTitle}</h3>
              </div>
              
              <p>Join the project to start collaborating with real-time editing, comments, and more.</p>
              
              <a href="${inviteUrl}" class="button">View Project</a>
              
              <p>Click the link above to accept the invitation and start collaborating.</p>
              
              <p>Best regards,<br>The Everleaf Team</p>
            </div>
            <div class="footer">
              <p>© 2024 Everleaf. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Collaboration invite sent:', result.messageId);
    return result;

  } catch (error) {
    console.error('Failed to send collaboration invite:', error);
    throw error;
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendCollaborationInvite
};
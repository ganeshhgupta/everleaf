const { query } = require('../config/database');

// Log user activity
const logActivity = async (userId, projectId, action, details = null, ipAddress = null, userAgent = null) => {
  try {
    await query(`
      INSERT INTO activity_logs (user_id, project_id, action, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, projectId, action, details ? JSON.stringify(details) : null, ipAddress, userAgent]);

    console.log(`Activity logged: ${action} by user ${userId}`);
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw error to avoid breaking the main functionality
  }
};

// Get user activity history
const getUserActivity = async (userId, limit = 50, offset = 0) => {
  try {
    const result = await query(`
      SELECT al.id, al.action, al.details, al.created_at, al.ip_address,
             p.title as project_title, p.id as project_id
      FROM activity_logs al
      LEFT JOIN projects p ON al.project_id = p.id
      WHERE al.user_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    return result.rows.map(row => ({
      id: row.id,
      action: row.action,
      details: row.details ? JSON.parse(row.details) : null,
      createdAt: row.created_at,
      ipAddress: row.ip_address,
      project: row.project_id ? {
        id: row.project_id,
        title: row.project_title
      } : null
    }));
  } catch (error) {
    console.error('Failed to get user activity:', error);
    return [];
  }
};

// Get project activity history
const getProjectActivity = async (projectId, limit = 50, offset = 0) => {
  try {
    const result = await query(`
      SELECT al.id, al.action, al.details, al.created_at,
             u.first_name, u.last_name, u.email, u.avatar_url
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.project_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2 OFFSET $3
    `, [projectId, limit, offset]);

    return result.rows.map(row => ({
      id: row.id,
      action: row.action,
      details: row.details ? JSON.parse(row.details) : null,
      createdAt: row.created_at,
      user: row.first_name ? {
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        avatarUrl: row.avatar_url
      } : null
    }));
  } catch (error) {
    console.error('Failed to get project activity:', error);
    return [];
  }
};

// Get system-wide activity (admin only)
const getSystemActivity = async (limit = 100, offset = 0, actionFilter = null) => {
  try {
    let queryText = `
      SELECT al.id, al.action, al.details, al.created_at, al.ip_address,
             u.first_name, u.last_name, u.email,
             p.title as project_title, p.id as project_id
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN projects p ON al.project_id = p.id
    `;

    const params = [];
    let paramCount = 1;

    if (actionFilter) {
      queryText += ` WHERE al.action = $${paramCount}`;
      params.push(actionFilter);
      paramCount++;
    }

    queryText += ` ORDER BY al.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    return result.rows.map(row => ({
      id: row.id,
      action: row.action,
      details: row.details ? JSON.parse(row.details) : null,
      createdAt: row.created_at,
      ipAddress: row.ip_address,
      user: row.first_name ? {
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email
      } : null,
      project: row.project_id ? {
        id: row.project_id,
        title: row.project_title
      } : null
    }));
  } catch (error) {
    console.error('Failed to get system activity:', error);
    return [];
  }
};

// Clean old activity logs (run periodically)
const cleanOldLogs = async (daysToKeep = 90) => {
  try {
    const result = await query(`
      DELETE FROM activity_logs 
      WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'
    `);

    console.log(`Cleaned ${result.rowCount} old activity logs`);
    return result.rowCount;
  } catch (error) {
    console.error('Failed to clean old logs:', error);
    return 0;
  }
};

// Get activity statistics
const getActivityStats = async (userId = null, projectId = null, days = 30) => {
  try {
    let whereClause = `WHERE al.created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'`;
    const params = [];
    let paramCount = 1;

    if (userId) {
      whereClause += ` AND al.user_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (projectId) {
      whereClause += ` AND al.project_id = $${paramCount}`;
      params.push(projectId);
      paramCount++;
    }

    const result = await query(`
      SELECT 
        al.action,
        COUNT(*) as count,
        DATE_TRUNC('day', al.created_at) as date
      FROM activity_logs al
      ${whereClause}
      GROUP BY al.action, DATE_TRUNC('day', al.created_at)
      ORDER BY date DESC, count DESC
    `, params);

    return result.rows;
  } catch (error) {
    console.error('Failed to get activity stats:', error);
    return [];
  }
};

// Activity types enum
const ACTIVITY_TYPES = {
  // Authentication
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  PASSWORD_RESET: 'password_reset',
  
  // Profile
  PROFILE_UPDATED: 'profile_updated',
  AVATAR_UPLOADED: 'avatar_uploaded',
  
  // Projects
  PROJECT_CREATED: 'project_created',
  PROJECT_VIEWED: 'project_viewed',
  PROJECT_UPDATED: 'project_updated',
  PROJECT_DELETED: 'project_deleted',
  PROJECT_CLONED: 'project_cloned',
  
  // Collaboration
  COLLABORATOR_ADDED: 'collaborator_added',
  COLLABORATOR_REMOVED: 'collaborator_removed',
  COLLABORATION_ACCEPTED: 'collaboration_accepted',
  COLLABORATION_REJECTED: 'collaboration_rejected',
  
  // Files
  FILE_UPLOADED: 'file_uploaded',
  FILE_DELETED: 'file_deleted',
  
  // AI
  AI_GENERATION: 'ai_generation',
  AI_SUGGESTION_ACCEPTED: 'ai_suggestion_accepted',
  
  // Admin
  USER_ROLE_CHANGED: 'user_role_changed',
  USER_BANNED: 'user_banned',
  USER_UNBANNED: 'user_unbanned'
};

module.exports = {
  logActivity,
  getUserActivity,
  getProjectActivity,
  getSystemActivity,
  cleanOldLogs,
  getActivityStats,
  ACTIVITY_TYPES
};
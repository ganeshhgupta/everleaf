const { query } = require('../config/database');

class Project {
  // Create a new project
  static async create(projectData) {
    const { title, description, content, latexContent, ownerId, isTemplate, templateCategory } = projectData;
    
    const result = await query(`
      INSERT INTO projects (title, description, content, latex_content, owner_id, is_template, template_category)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, title, description, content, latex_content, owner_id, is_public, is_template, 
                template_category, created_at, updated_at
    `, [title, description, content || '', latexContent || '', ownerId, isTemplate || false, templateCategory]);

    return result.rows[0];
  }

  // Find project by ID
  static async findById(projectId) {
    const result = await query(`
      SELECT p.*, 
             u.first_name as owner_first_name, 
             u.last_name as owner_last_name,
             u.email as owner_email
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      WHERE p.id = $1
    `, [projectId]);

    return result.rows[0];
  }

  // Get user's projects
  static async getUserProjects(userId, limit = 20, offset = 0) {
    const result = await query(`
      SELECT p.id, p.title, p.description, p.is_public, p.is_template, 
             p.template_category, p.created_at, p.updated_at,
             COUNT(pc.user_id) as collaborator_count
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.owner_id = $1
      GROUP BY p.id
      ORDER BY p.updated_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    return result.rows;
  }

  // Get projects where user is a collaborator
  static async getCollaboratedProjects(userId, limit = 20, offset = 0) {
    const result = await query(`
      SELECT p.id, p.title, p.description, p.is_public, p.created_at, p.updated_at,
             u.first_name as owner_first_name, u.last_name as owner_last_name,
             pc.permission, pc.accepted_at
      FROM projects p
      JOIN project_collaborators pc ON p.id = pc.project_id
      JOIN users u ON p.owner_id = u.id
      WHERE pc.user_id = $1 AND pc.accepted_at IS NOT NULL
      ORDER BY p.updated_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    return result.rows;
  }

  // Update project
  static async update(projectId, updates, userId) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Only allow certain fields to be updated
    const allowedFields = ['title', 'description', 'content', 'latex_content', 'is_public'];
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) return null;

    values.push(projectId, userId);
    const result = await query(`
      UPDATE projects 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND owner_id = $${paramCount + 1}
      RETURNING id, title, description, content, latex_content, is_public, updated_at
    `, values);

    return result.rows[0];
  }

  // Delete project
  static async delete(projectId, userId) {
    const result = await query(`
      DELETE FROM projects 
      WHERE id = $1 AND owner_id = $2
      RETURNING id, title
    `, [projectId, userId]);

    return result.rows[0];
  }

  // Add collaborator to project
  static async addCollaborator(projectId, userId, invitedBy, permission = 'edit') {
    const result = await query(`
      INSERT INTO project_collaborators (project_id, user_id, invited_by, permission)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (project_id, user_id) 
      DO UPDATE SET permission = EXCLUDED.permission, invited_at = CURRENT_TIMESTAMP
      RETURNING id, project_id, user_id, permission, invited_at
    `, [projectId, userId, invitedBy, permission]);

    return result.rows[0];
  }

  // Accept collaboration invitation
  static async acceptCollaboration(projectId, userId) {
    const result = await query(`
      UPDATE project_collaborators 
      SET accepted_at = CURRENT_TIMESTAMP 
      WHERE project_id = $1 AND user_id = $2
      RETURNING id, project_id, user_id, permission, accepted_at
    `, [projectId, userId]);

    return result.rows[0];
  }

  // Remove collaborator
  static async removeCollaborator(projectId, userId, removedBy) {
    // Check if the person removing is the owner or admin
    const ownerCheck = await query(`
      SELECT owner_id FROM projects WHERE id = $1
    `, [projectId]);

    if (!ownerCheck.rows[0] || ownerCheck.rows[0].owner_id !== removedBy) {
      throw new Error('Only project owner can remove collaborators');
    }

    const result = await query(`
      DELETE FROM project_collaborators 
      WHERE project_id = $1 AND user_id = $2
      RETURNING id, project_id, user_id
    `, [projectId, userId]);

    return result.rows[0];
  }

  // Get project collaborators
  static async getCollaborators(projectId) {
    const result = await query(`
      SELECT pc.id, pc.permission, pc.invited_at, pc.accepted_at,
             u.id as user_id, u.first_name, u.last_name, u.email, u.avatar_url
      FROM project_collaborators pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.project_id = $1
      ORDER BY pc.accepted_at DESC NULLS LAST, pc.invited_at DESC
    `, [projectId]);

    return result.rows;
  }

  // Check if user has access to project
  static async checkAccess(projectId, userId) {
    const result = await query(`
      SELECT 
        CASE 
          WHEN p.owner_id = $2 THEN 'owner'
          WHEN pc.user_id = $2 AND pc.accepted_at IS NOT NULL THEN pc.permission
          WHEN p.is_public = true THEN 'view'
          ELSE NULL
        END as access_level
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE p.id = $1
    `, [projectId, userId]);

    return result.rows[0]?.access_level || null;
  }

  // Get public projects (templates)
  static async getPublicProjects(category = null, limit = 20, offset = 0) {
    let query_text = `
      SELECT p.id, p.title, p.description, p.template_category, p.created_at, p.updated_at,
             u.first_name as owner_first_name, u.last_name as owner_last_name,
             COUNT(pc.user_id) as usage_count
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.is_public = true AND p.is_template = true
    `;
    
    const params = [];
    let paramCount = 1;

    if (category) {
      query_text += ` AND p.template_category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    query_text += `
      GROUP BY p.id, u.first_name, u.last_name
      ORDER BY p.updated_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    
    params.push(limit, offset);

    const result = await query(query_text, params);
    return result.rows;
  }

  // Clone project (for templates)
  static async clone(projectId, userId, newTitle) {
    const original = await this.findById(projectId);
    if (!original) throw new Error('Project not found');

    const result = await query(`
      INSERT INTO projects (title, description, content, latex_content, owner_id)
      SELECT $1, description, content, latex_content, $2
      FROM projects 
      WHERE id = $3
      RETURNING id, title, description, content, latex_content, owner_id, created_at, updated_at
    `, [newTitle, userId, projectId]);

    return result.rows[0];
  }

  // Search projects
  static async search(searchTerm, userId, limit = 20, offset = 0) {
    const result = await query(`
      SELECT p.id, p.title, p.description, p.is_public, p.created_at, p.updated_at,
             u.first_name as owner_first_name, u.last_name as owner_last_name,
             CASE WHEN p.owner_id = $2 THEN 'owner' ELSE 'collaborator' END as relationship
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE (p.owner_id = $2 OR pc.user_id = $2 OR p.is_public = true)
        AND (p.title ILIKE $1 OR p.description ILIKE $1)
      GROUP BY p.id, u.first_name, u.last_name
      ORDER BY p.updated_at DESC
      LIMIT $3 OFFSET $4
    `, [`%${searchTerm}%`, userId, limit, offset]);

    return result.rows;
  }

  // Get project activity
  static async getActivity(projectId, limit = 50) {
    const result = await query(`
      SELECT al.id, al.action, al.details, al.created_at,
             u.first_name, u.last_name, u.email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.project_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2
    `, [projectId, limit]);

    return result.rows;
  }
}

module.exports = Project;
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { query } = require('../config/database');
const Project = require('../models/Project');
const { logActivity } = require('../utils/activityLogger');

// Configure multer for project file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.params.projectId || req.body.projectId;
    const uploadPath = path.join('uploads', 'projects', projectId);
    
    // Create directory if it doesn't exist
    fs.mkdir(uploadPath, { recursive: true })
      .then(() => cb(null, uploadPath))
      .catch(err => cb(err));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow LaTeX related files
  const allowedTypes = [
    '.tex', '.bib', '.cls', '.sty', '.bst', '.pdf', '.png', '.jpg', '.jpeg', '.gif',
    '.eps', '.svg', '.tiff', '.bmp', '.csv', '.dat', '.txt', '.md'
  ];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} not allowed. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 10 // Maximum 10 files per upload
  },
  fileFilter: fileFilter
});

// Upload files to project
const uploadProjectFiles = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    
    // Check if user has edit access to the project
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel || accessLevel === 'view') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to upload files to this project'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadedFiles = [];

    // Save file information to database
    for (const file of req.files) {
      const result = await query(`
        INSERT INTO project_files (project_id, filename, file_path, file_size, mime_type, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, filename, file_path, file_size, mime_type, created_at
      `, [
        projectId,
        file.originalname,
        file.path,
        file.size,
        file.mimetype,
        req.user.id
      ]);

      uploadedFiles.push(result.rows[0]);
    }

    // Log activity
    await logActivity(req.user.id, projectId, 'files_uploaded', {
      fileCount: uploadedFiles.length,
      fileNames: uploadedFiles.map(f => f.filename)
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload files'
    });
  }
};

// Get project files
const getProjectFiles = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    
    // Check if user has access to the project
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this project'
      });
    }

    const result = await query(`
      SELECT pf.id, pf.filename, pf.file_size, pf.mime_type, pf.created_at,
             u.first_name, u.last_name, u.email
      FROM project_files pf
      JOIN users u ON pf.uploaded_by = u.id
      WHERE pf.project_id = $1
      ORDER BY pf.created_at DESC
    `, [projectId]);

    const files = result.rows.map(row => ({
      id: row.id,
      filename: row.filename,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      createdAt: row.created_at,
      uploadedBy: {
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email
      }
    }));

    res.json({
      success: true,
      files
    });

  } catch (error) {
    console.error('Get project files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get project files'
    });
  }
};

// Download project file
const downloadProjectFile = async (req, res) => {
  try {
    const { projectId, fileId } = req.params;
    
    // Check if user has access to the project
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this project'
      });
    }

    // Get file information from database
    const result = await query(`
      SELECT filename, file_path, mime_type
      FROM project_files
      WHERE id = $1 AND project_id = $2
    `, [fileId, projectId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = result.rows[0];
    const filePath = path.resolve(file.file_path);

    // Check if file exists on disk
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found on disk'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);

    // Send file
    res.sendFile(filePath);

    // Log activity
    await logActivity(req.user.id, projectId, 'file_downloaded', {
      filename: file.filename,
      fileId: fileId
    }, req.ip, req.get('User-Agent'));

  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
};

// Delete project file
const deleteProjectFile = async (req, res) => {
  try {
    const { projectId, fileId } = req.params;
    
    // Check if user has edit access to the project
    const accessLevel = await Project.checkAccess(projectId, req.user.id);
    if (!accessLevel || accessLevel === 'view') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete files from this project'
      });
    }

    // Get file information from database
    const result = await query(`
      SELECT filename, file_path, uploaded_by
      FROM project_files
      WHERE id = $1 AND project_id = $2
    `, [fileId, projectId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = result.rows[0];

    // Only file uploader or project owner can delete
    if (file.uploaded_by !== req.user.id && accessLevel !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete files you uploaded'
      });
    }

    // Delete file from database
    await query(`
      DELETE FROM project_files
      WHERE id = $1 AND project_id = $2
    `, [fileId, projectId]);

    // Delete file from disk
    try {
      await fs.unlink(file.file_path);
    } catch (error) {
      console.error('Failed to delete file from disk:', error);
      // Continue anyway since file is deleted from database
    }

    // Log activity
    await logActivity(req.user.id, projectId, 'file_deleted', {
      filename: file.filename,
      fileId: fileId
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
};

// Import LaTeX project from ZIP file
const importLatexProject = async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No ZIP file uploaded'
      });
    }

    // Validate file type
    if (req.file.mimetype !== 'application/zip') {
      return res.status(400).json({
        success: false,
        message: 'Only ZIP files are allowed'
      });
    }

    // TODO: Implement ZIP extraction and LaTeX project import
    // For now, create a basic project
    const project = await Project.create({
      title: title || 'Imported LaTeX Project',
      description: description || 'Imported from ZIP file',
      content: '% LaTeX project imported from ZIP file\n\\documentclass{article}\n\\begin{document}\nImported project content will be extracted here.\n\\end{document}',
      latexContent: '',
      ownerId: req.user.id
    });

    // Log activity
    await logActivity(req.user.id, project.id, 'project_imported', {
      filename: req.file.originalname,
      fileSize: req.file.size
    }, req.ip, req.get('User-Agent'));

    res.status(201).json({
      success: true,
      message: 'LaTeX project imported successfully',
      project
    });

  } catch (error) {
    console.error('Import project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import LaTeX project'
    });
  }
};

module.exports = {
  upload,
  uploadProjectFiles,
  getProjectFiles,
  downloadProjectFile,
  deleteProjectFile,
  importLatexProject
};
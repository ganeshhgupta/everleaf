const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const {
  validateProjectCreation,
  validateProjectUpdate,
  validateCollaborationInvite,
  validateId
} = require('../middleware/validation');

// Public routes (no authentication required)
router.get('/public', optionalAuth, projectController.getPublicProjects);

// Protected routes (authentication required)
router.use(verifyToken);

// Project CRUD operations
router.post('/', validateProjectCreation, projectController.createProject);
router.get('/my-projects', projectController.getUserProjects);
router.get('/collaborated', projectController.getCollaboratedProjects);
router.get('/search', projectController.searchProjects);

// Individual project operations
router.get('/:id', validateId('id'), projectController.getProject);
router.put('/:id', validateId('id'), validateProjectUpdate, projectController.updateProject);
router.delete('/:id', validateId('id'), projectController.deleteProject);

// Project cloning
router.post('/:id/clone', validateId('id'), projectController.cloneProject);

// Collaboration management
router.get('/:id/collaborators', validateId('id'), projectController.getCollaborators);
router.post('/:id/collaborators', validateId('id'), validateCollaborationInvite, projectController.addCollaborator);
router.post('/:id/accept', validateId('id'), projectController.acceptCollaboration);
router.delete('/:id/collaborators/:collaboratorId', 
  validateId('id'), 
  validateId('collaboratorId'), 
  projectController.removeCollaborator
);

// Project activity/history
router.get('/:id/activity', validateId('id'), projectController.getProjectActivity);

module.exports = router;
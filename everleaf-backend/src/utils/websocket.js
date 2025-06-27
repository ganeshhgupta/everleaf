const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Project = require('../models/Project');
const { logActivity } = require('./activityLogger');

class WebSocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          process.env.FRONTEND_URL,
          'http://localhost:3000',
          'http://127.0.0.1:3000'
        ],
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.projectRooms = new Map(); // projectId -> Set of socket IDs
    this.userSockets = new Map(); // userId -> Set of socket IDs
    this.socketUsers = new Map(); // socketId -> user data

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.use(this.authenticateSocket.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));
  }

  // Authenticate socket connection
  async authenticateSocket(socket, next) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.user = {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        avatarUrl: user.avatar_url
      };

      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  }

  // Handle new socket connection
  handleConnection(socket) {
    console.log(`✅ User ${socket.user.firstName} connected (${socket.id})`);

    // Track user socket
    if (!this.userSockets.has(socket.userId)) {
      this.userSockets.set(socket.userId, new Set());
    }
    this.userSockets.get(socket.userId).add(socket.id);
    this.socketUsers.set(socket.id, socket.user);

    // Socket event handlers
    socket.on('join-project', (data) => this.handleJoinProject(socket, data));
    socket.on('leave-project', (data) => this.handleLeaveProject(socket, data));
    socket.on('project-edit', (data) => this.handleProjectEdit(socket, data));
    socket.on('cursor-position', (data) => this.handleCursorPosition(socket, data));
    socket.on('user-typing', (data) => this.handleUserTyping(socket, data));
    socket.on('project-compile', (data) => this.handleProjectCompile(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));

    // Send initial connection confirmation
    socket.emit('connected', {
      message: 'Connected to Everleaf',
      user: socket.user
    });
  }

  // Handle joining a project room
  async handleJoinProject(socket, { projectId }) {
    try {
      // Check if user has access to the project
      const accessLevel = await Project.checkAccess(projectId, socket.userId);
      if (!accessLevel) {
        socket.emit('error', { message: 'Access denied to project' });
        return;
      }

      // Join the project room
      socket.join(`project-${projectId}`);
      socket.currentProject = projectId;

      // Track project room membership
      if (!this.projectRooms.has(projectId)) {
        this.projectRooms.set(projectId, new Set());
      }
      this.projectRooms.get(projectId).add(socket.id);

      // Get current project collaborators in the room
      const activeUsers = this.getProjectActiveUsers(projectId);

      // Notify others that user joined
      socket.to(`project-${projectId}`).emit('user-joined', {
        user: socket.user,
        activeUsers
      });

      // Send current active users to the joining user
      socket.emit('project-joined', {
        projectId,
        accessLevel,
        activeUsers
      });

      // Log activity
      await logActivity(socket.userId, projectId, 'project_joined_realtime', null, socket.handshake.address);

      console.log(`👥 User ${socket.user.firstName} joined project ${projectId}`);

    } catch (error) {
      console.error('Join project error:', error);
      socket.emit('error', { message: 'Failed to join project' });
    }
  }

  // Handle leaving a project room
  handleLeaveProject(socket, { projectId }) {
    if (socket.currentProject === projectId) {
      this.leaveProjectRoom(socket, projectId);
    }
  }

  // Handle real-time project edits
  async handleProjectEdit(socket, { projectId, content, latexContent, cursor, operation }) {
    try {
      // Verify access
      const accessLevel = await Project.checkAccess(projectId, socket.userId);
      if (!accessLevel || accessLevel === 'view') {
        socket.emit('error', { message: 'No edit permission' });
        return;
      }

      // Broadcast the edit to other users in the project
      socket.to(`project-${projectId}`).emit('project-updated', {
        content,
        latexContent,
        cursor,
        operation,
        user: socket.user,
        timestamp: new Date().toISOString()
      });

      // Update project in database (debounced - actual implementation would batch updates)
      // For now, we'll just broadcast the changes
      console.log(`📝 Project ${projectId} edited by ${socket.user.firstName}`);

    } catch (error) {
      console.error('Project edit error:', error);
      socket.emit('error', { message: 'Failed to process edit' });
    }
  }

  // Handle cursor position updates
  handleCursorPosition(socket, { projectId, position, selection }) {
    socket.to(`project-${projectId}`).emit('cursor-update', {
      user: socket.user,
      position,
      selection,
      timestamp: new Date().toISOString()
    });
  }

  // Handle user typing indicators
  handleUserTyping(socket, { projectId, isTyping }) {
    socket.to(`project-${projectId}`).emit('user-typing-update', {
      user: socket.user,
      isTyping,
      timestamp: new Date().toISOString()
    });
  }

  // Handle project compilation requests
  async handleProjectCompile(socket, { projectId, content, latexContent }) {
    try {
      // Verify access
      const accessLevel = await Project.checkAccess(projectId, socket.userId);
      if (!accessLevel) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Broadcast compilation start to all users in project
      this.io.to(`project-${projectId}`).emit('compilation-started', {
        user: socket.user,
        timestamp: new Date().toISOString()
      });

      // TODO: Implement actual LaTeX compilation
      // For now, simulate compilation
      setTimeout(() => {
        const success = Math.random() > 0.2; // 80% success rate for demo
        
        if (success) {
          this.io.to(`project-${projectId}`).emit('compilation-success', {
            user: socket.user,
            pdfUrl: `/api/projects/${projectId}/pdf`,
            timestamp: new Date().toISOString()
          });
        } else {
          this.io.to(`project-${projectId}`).emit('compilation-error', {
            user: socket.user,
            error: 'LaTeX compilation failed: Undefined control sequence on line 42',
            timestamp: new Date().toISOString()
          });
        }
      }, 2000);

      // Log activity
      await logActivity(socket.userId, projectId, 'project_compiled', null, socket.handshake.address);

    } catch (error) {
      console.error('Project compile error:', error);
      socket.emit('error', { message: 'Compilation failed' });
    }
  }

  // Handle socket disconnection
  handleDisconnect(socket) {
    console.log(`❌ User ${socket.user.firstName} disconnected (${socket.id})`);

    // Leave current project room
    if (socket.currentProject) {
      this.leaveProjectRoom(socket, socket.currentProject);
    }

    // Clean up tracking maps
    this.socketUsers.delete(socket.id);
    
    if (this.userSockets.has(socket.userId)) {
      this.userSockets.get(socket.userId).delete(socket.id);
      if (this.userSockets.get(socket.userId).size === 0) {
        this.userSockets.delete(socket.userId);
      }
    }
  }

  // Helper method to leave project room
  leaveProjectRoom(socket, projectId) {
    socket.leave(`project-${projectId}`);
    
    if (this.projectRooms.has(projectId)) {
      this.projectRooms.get(projectId).delete(socket.id);
      if (this.projectRooms.get(projectId).size === 0) {
        this.projectRooms.delete(projectId);
      }
    }

    // Notify others that user left
    socket.to(`project-${projectId}`).emit('user-left', {
      user: socket.user,
      activeUsers: this.getProjectActiveUsers(projectId)
    });

    socket.currentProject = null;
    console.log(`👋 User ${socket.user.firstName} left project ${projectId}`);
  }

  // Get active users in a project
  getProjectActiveUsers(projectId) {
    const activeUsers = [];
    const projectSockets = this.projectRooms.get(projectId) || new Set();
    
    for (const socketId of projectSockets) {
      const user = this.socketUsers.get(socketId);
      if (user) {
        activeUsers.push(user);
      }
    }
    
    return activeUsers;
  }

  // Public methods for external use

  // Send notification to user
  sendToUser(userId, event, data) {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      for (const socketId of userSockets) {
        this.io.to(socketId).emit(event, data);
      }
    }
  }

  // Send notification to project
  sendToProject(projectId, event, data) {
    this.io.to(`project-${projectId}`).emit(event, data);
  }

  // Broadcast to all connected users
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  // Get connection statistics
  getStats() {
    return {
      totalConnections: this.io.engine.clientsCount,
      activeProjects: this.projectRooms.size,
      activeUsers: this.userSockets.size,
      projectRooms: Array.from(this.projectRooms.keys()),
      userCount: this.userSockets.size
    };
  }
}

module.exports = WebSocketManager;
const aiService = require('../utils/aiService');
const Project = require('../models/Project');

// Generate LaTeX content from prompt
const generateLatex = async (req, res) => {
  try {
    const { prompt, projectId } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    // Check if AI service is enabled
    if (!aiService.isEnabled()) {
      return res.status(503).json({
        success: false,
        message: 'AI service is not available. Please configure AI_API_KEY in environment variables.'
      });
    }

    // If projectId provided, check access
    if (projectId) {
      const accessLevel = await Project.checkAccess(projectId, req.user.id);
      if (!accessLevel) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this project'
        });
      }
    }

    const result = await aiService.generateLatex(prompt, req.user.id, projectId);

    if (result.success) {
      res.json({
        success: true,
        content: result.content,
        explanation: result.explanation,
        tokensUsed: result.tokensUsed
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error
      });
    }

  } catch (error) {
    console.error('Generate LaTeX error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate LaTeX content'
    });
  }
};

// Get improvement suggestions for document
const getSuggestions = async (req, res) => {
  try {
    const { content, projectId } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    // Check if AI service is enabled
    if (!aiService.isEnabled()) {
      return res.status(503).json({
        success: false,
        message: 'AI service is not available'
      });
    }

    // Check project access if provided
    if (projectId) {
      const accessLevel = await Project.checkAccess(projectId, req.user.id);
      if (!accessLevel) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this project'
        });
      }
    }

    const result = await aiService.suggestImprovements(content, req.user.id, projectId);

    if (result.success) {
      res.json({
        success: true,
        suggestions: result.suggestions
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error
      });
    }

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions'
    });
  }
};

// Fix LaTeX errors
const fixLatexErrors = async (req, res) => {
  try {
    const { content, errors, projectId } = req.body;

    if (!content || !errors || errors.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Content and errors are required'
      });
    }

    // Check if AI service is enabled
    if (!aiService.isEnabled()) {
      return res.status(503).json({
        success: false,
        message: 'AI service is not available'
      });
    }

    // Check project access if provided
    if (projectId) {
      const accessLevel = await Project.checkAccess(projectId, req.user.id);
      if (!accessLevel || accessLevel === 'view') {
        return res.status(403).json({
          success: false,
          message: 'Edit access required'
        });
      }
    }

    const result = await aiService.fixLatexErrors(content, errors, req.user.id, projectId);

    if (result.success) {
      res.json({
        success: true,
        fixes: result.fixes
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error
      });
    }

  } catch (error) {
    console.error('Fix LaTeX errors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix LaTeX errors'
    });
  }
};

// Generate citation
const generateCitation = async (req, res) => {
  try {
    const { source, style = 'apa', projectId } = req.body;

    if (!source || source.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Source (DOI, URL, or reference) is required'
      });
    }

    // Check if AI service is enabled
    if (!aiService.isEnabled()) {
      return res.status(503).json({
        success: false,
        message: 'AI service is not available'
      });
    }

    const validStyles = ['apa', 'mla', 'chicago', 'harvard', 'ieee'];
    if (!validStyles.includes(style.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid citation style. Supported styles: ${validStyles.join(', ')}`
      });
    }

    const result = await aiService.generateCitation(source, style.toLowerCase(), req.user.id, projectId);

    if (result.success) {
      res.json({
        success: true,
        citation: result.citation
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error
      });
    }

  } catch (error) {
    console.error('Generate citation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate citation'
    });
  }
};

// Convert natural language to LaTeX math
const convertToMath = async (req, res) => {
  try {
    const { text, projectId } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text description is required'
      });
    }

    // Check if AI service is enabled
    if (!aiService.isEnabled()) {
      return res.status(503).json({
        success: false,
        message: 'AI service is not available'
      });
    }

    const result = await aiService.convertToLatexMath(text, req.user.id, projectId);

    if (result.success) {
      res.json({
        success: true,
        latex: result.latex
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error
      });
    }

  } catch (error) {
    console.error('Convert to math error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert to LaTeX math'
    });
  }
};

// Get AI usage statistics
const getAIStats = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const stats = await aiService.getUserAIStats(req.user.id, days);

    res.json({
      success: true,
      stats: {
        totalGenerations: parseInt(stats.total_generations) || 0,
        totalTokens: parseInt(stats.total_tokens) || 0,
        recentPrompts: stats.recent_prompts || [],
        period: `${days} days`,
        aiEnabled: aiService.isEnabled()
      }
    });

  } catch (error) {
    console.error('Get AI stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI statistics'
    });
  }
};

// Check AI service status
const getAIStatus = async (req, res) => {
  try {
    res.json({
      success: true,
      status: {
        enabled: aiService.isEnabled(),
        model: aiService.model,
        features: [
          'latex_generation',
          'improvement_suggestions',
          'error_fixing',
          'citation_generation',
          'math_conversion'
        ]
      }
    });

  } catch (error) {
    console.error('Get AI status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI status'
    });
  }
};

module.exports = {
  generateLatex,
  getSuggestions,
  fixLatexErrors,
  generateCitation,
  convertToMath,
  getAIStats,
  getAIStatus
};
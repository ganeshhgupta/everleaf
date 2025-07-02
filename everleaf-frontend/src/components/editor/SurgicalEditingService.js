// SurgicalEditingService.js - FIXED VERSION - NO DUPLICATE SECTIONS
// Main orchestrator for surgical LaTeX editing

import { 
  LaTeXParser, 
  detectUserAction, 
  detectInsertionPoint, 
  extractTargetSection,
  createEnhancedPrompt,
  addContentToSection,
  deleteSection,
  replaceSection,
  extractLatexCode,
  shouldCreateNewSection // NEW IMPORT
} from './latexProcessor.js';

/**
 * Advanced Surgical Editing Service - FIXED VERSION - NO DUPLICATES
 * Integrates AI responses with precise document manipulation
 */
export class SurgicalEditingService {
  constructor(llmClient, options = {}) {
    this.llm = llmClient;
    this.options = {
      maxRetries: 3,
      validationEnabled: true,
      debugMode: process.env.NODE_ENV === 'development',
      ...options
    };
    
    this.lastParser = null;
    this.editHistory = [];
    this.debugLog = [];
  }

  /**
   * Main surgical editing method - ENHANCED
   * Analyzes intent, applies changes, validates results
   */
  async performSurgicalEdit(document, userInstruction, selectedText = '', selectionRange = null) {
    const editSession = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      userInstruction,
      selectedText,
      selectionRange,
      originalDocument: document,
      steps: []
    };

    try {
      this.log('🚀 Starting surgical edit session', editSession.id);
      
      // Step 1: Parse document structure
      editSession.steps.push(await this.parseDocumentStructure(document));
      
      // Step 2: Analyze user intent
      editSession.steps.push(await this.analyzeUserIntent(userInstruction, selectedText));
      
      // Step 3: Generate enhanced prompt for AI
      editSession.steps.push(await this.createContextualPrompt(document, userInstruction, selectedText, selectionRange));
      
      // Step 4: Get AI response
      editSession.steps.push(await this.getAIResponse(editSession.steps[2].enhancedPrompt));
      
      // Step 5: Apply surgical changes - FIXED
      editSession.steps.push(await this.applySurgicalChanges(document, editSession));
      
      // Step 6: Validate results
      if (this.options.validationEnabled) {
        editSession.steps.push(await this.validateChanges(editSession));
      }
      
      // Store in history
      this.editHistory.push(editSession);
      
      const result = editSession.steps[4]; // Surgical changes result
      this.log('✅ Surgical edit completed successfully');
      
      return {
        success: true,
        newDocument: result.newDocument,
        changes: result.changes,
        metadata: {
          editType: editSession.steps[1].action,
          targetSection: editSession.steps[1].targetSection,
          aiResponse: editSession.steps[3].response,
          validation: editSession.steps[5] || null
        },
        sessionId: editSession.id
      };
      
    } catch (error) {
      this.log('❌ Surgical edit failed:', error.message);
      editSession.error = error.message;
      
      return {
        success: false,
        error: error.message,
        fallbackDocument: document,
        sessionId: editSession.id,
        debugInfo: this.options.debugMode ? editSession : null
      };
    }
  }

  /**
   * Step 1: Parse document structure
   */
  async parseDocumentStructure(document) {
    this.log('📊 Parsing document structure...');
    
    const parser = new LaTeXParser(document);
    this.lastParser = parser;
    
    const structure = {
      totalElements: parser.documentTree.children.length,
      sections: parser.documentTree.children.filter(e => e.type === 'section'),
      environments: parser.documentTree.children.filter(e => e.type.includes('environment')),
      documentEndMarkers: parser.documentTree.children.filter(e => e.type === 'document_end_marker')
    };
    
    this.log(`📊 Structure: ${structure.sections.length} sections, ${structure.environments.length} environments`);
    
    return {
      step: 'parse_structure',
      parser,
      structure,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Step 2: Analyze user intent
   */
  async analyzeUserIntent(userInstruction, selectedText) {
    this.log('🎯 Analyzing user intent...');
    
    const action = detectUserAction(userInstruction);
    const targetSection = extractTargetSection(userInstruction);
    const insertionPoint = detectInsertionPoint(userInstruction);
    
    // Enhanced intent analysis
    const intentAnalysis = {
      action,
      targetSection,
      insertionPoint,
      hasSelectedText: !!selectedText && selectedText.trim().length > 0,
      isStructuralChange: ['delete', 'replace', 'add'].includes(action) && targetSection,
      isContentExpansion: action === 'expand' || action === 'add',
      requiresValidation: ['delete', 'replace'].includes(action),
      complexity: this.assessComplexity(userInstruction, selectedText)
    };
    
    this.log(`🎯 Intent: ${action} on ${targetSection || 'selected text'} (${intentAnalysis.complexity} complexity)`);
    
    return {
      step: 'analyze_intent',
      ...intentAnalysis,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Step 3: Create contextual prompt for AI
   */
  async createContextualPrompt(document, userInstruction, selectedText, selectionRange) {
    this.log('📝 Creating enhanced prompt...');
    
    const editorContext = this.getEditorContext(document, selectionRange);
    const targetSection = extractTargetSection(userInstruction);
    const action = detectUserAction(userInstruction);
    const insertionPoint = detectInsertionPoint(userInstruction);
    
    // Use the enhanced prompt creator from latexProcessor
    const enhancedPrompt = createEnhancedPrompt(
      userInstruction,
      selectedText,
      editorContext,
      targetSection,
      action,
      insertionPoint
    );
    
    // Add surgical editing specific instructions
    const surgicalInstructions = this.createSurgicalInstructions(action, targetSection, selectedText);
    const finalPrompt = `${enhancedPrompt}\n\n${surgicalInstructions}`;
    
    this.log('📝 Enhanced prompt created with surgical instructions');
    
    return {
      step: 'create_prompt',
      enhancedPrompt: finalPrompt,
      editorContext,
      surgicalInstructions,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Step 4: Get AI response
   */
  async getAIResponse(prompt) {
    this.log('🤖 Getting AI response...');
    
    let attempts = 0;
    let lastError = null;
    
    while (attempts < this.options.maxRetries) {
      try {
        // Call your LLM client (Groq in this case)
        const response = await this.llm(prompt);
        
        if (response && response.trim().length > 0) {
          this.log(`🤖 AI response received (${response.length} chars)`);
          
          return {
            step: 'get_ai_response',
            response: response.trim(),
            attempts: attempts + 1,
            timestamp: new Date().toISOString()
          };
        }
        
        throw new Error('Empty response from AI');
        
      } catch (error) {
        attempts++;
        lastError = error;
        this.log(`🤖 AI attempt ${attempts} failed: ${error.message}`);
        
        if (attempts < this.options.maxRetries) {
          await this.delay(1000 * attempts); // Exponential backoff
        }
      }
    }
    
    throw new Error(`AI failed after ${this.options.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Step 5: Apply surgical changes - FIXED TO PREVENT DUPLICATES
   */
  async applySurgicalChanges(originalDocument, editSession) {
    this.log('🔧 Applying surgical changes...');
    
    const intentStep = editSession.steps.find(s => s.step === 'analyze_intent');
    const aiStep = editSession.steps.find(s => s.step === 'get_ai_response');
    
    const { action, targetSection, hasSelectedText, insertionPoint } = intentStep;
    const aiResponse = aiStep.response;
    const selectedText = editSession.selectedText;
    const selectionRange = editSession.selectionRange;
    const userInstruction = editSession.userInstruction;
    
    this.log(`🔧 Surgical operation: ${action} on ${targetSection || 'selection'}`);
    
    // Extract LaTeX code from AI response
    const extractedCode = extractLatexCode(aiResponse);
    
    let result = null;
    
    try {
      if (targetSection && this.lastParser) {
        // ENHANCED: Check if this is a creation request for a non-existent section
        const sectionExists = this.lastParser.findSection(targetSection) !== null;
        const isCreationRequest = shouldCreateNewSection(userInstruction, originalDocument, targetSection);
        
        this.log(`🎯 Section "${targetSection}" exists: ${sectionExists}, Creation request: ${isCreationRequest}`);
        
        if (!sectionExists && (action === 'add' || isCreationRequest)) {
          // NEW SECTION CREATION - FIXED TO PREVENT DUPLICATES
          this.log(`🆕 Creating new section: "${targetSection}"`);
          
          const contentToUse = extractedCode || aiResponse;
          
          // FIXED: Check if AI response already contains section header
          const hasExistingSectionHeader = this.checkForSectionHeader(contentToUse, targetSection);
          
          let finalSectionContent;
          if (hasExistingSectionHeader) {
            // AI already provided complete section - use as-is
            this.log('✅ AI provided complete section with header');
            finalSectionContent = contentToUse;
          } else {
            // Add section header ourselves
            this.log('➕ Adding section header to AI content');
            const sectionTitle = this.formatSectionTitle(targetSection);
            finalSectionContent = `\\section{${sectionTitle}}\n\n${contentToUse}`;
          }
          
          result = this.insertNewSection(originalDocument, finalSectionContent);
          
          if (!result) {
            throw new Error(`Failed to create new section "${targetSection}"`);
          }
        } else if (sectionExists) {
          // EXISTING SECTION MODIFICATION
          this.log(`🎯 Section-based operation: ${action} on existing "${targetSection}"`);
          
          switch (action) {
            case 'delete':
              result = deleteSection(originalDocument, targetSection);
              if (!result) {
                throw new Error(`Could not find section "${targetSection}" to delete`);
              }
              break;
              
            case 'replace':
              if (!extractedCode) {
                throw new Error('No LaTeX code found in AI response for replacement');
              }
              result = replaceSection(originalDocument, targetSection, extractedCode);
              if (!result) {
                throw new Error(`Could not find section "${targetSection}" to replace`);
              }
              break;
              
            case 'add':
            case 'expand':
              if (!extractedCode) {
                const convertedCode = this.convertPlainTextToLatex(aiResponse, action);
                if (convertedCode) {
                  result = addContentToSection(originalDocument, targetSection, convertedCode, insertionPoint);
                } else {
                  throw new Error('No usable content found in AI response for addition');
                }
              } else {
                result = addContentToSection(originalDocument, targetSection, extractedCode, insertionPoint);
              }
              if (!result) {
                throw new Error(`Could not find section "${targetSection}" to add content to`);
              }
              break;
              
            case 'improve':
            case 'fix':
              if (!extractedCode) {
                throw new Error('No LaTeX code found in AI response for improvement');
              }
              result = replaceSection(originalDocument, targetSection, extractedCode);
              if (!result) {
                throw new Error(`Could not find section "${targetSection}" to improve`);
              }
              break;
              
            default:
              throw new Error(`Unsupported section action: ${action}`);
          }
        } else {
          // Section not found and not a creation request
          throw new Error(`Section "${targetSection}" not found. Use "write a ${targetSection}" to create a new section.`);
        }
      } else if (hasSelectedText && selectionRange) {
        // Selected text operations
        this.log(`✂️ Selection-based operation: ${action} on selected text`);
        result = this.applyToSelectedText(originalDocument, extractedCode || aiResponse, action, selectionRange);
      } else {
        // General content addition (no specific section or selection)
        this.log(`📍 General content addition`);
        result = this.applyToCursorPosition(originalDocument, extractedCode || aiResponse);
      }
      
      if (!result || !result.newDocument) {
        throw new Error('Surgical operation failed to produce result');
      }
      
      this.log(`🔧 Applied ${action} successfully - ${result.newDocument.length - originalDocument.length} chars changed`);
      
      return {
        step: 'apply_surgical_changes',
        newDocument: result.newDocument,
        changes: {
          action,
          targetSection,
          originalLength: originalDocument.length,
          newLength: result.newDocument.length,
          deltaLength: result.newDocument.length - originalDocument.length,
          appliedCode: extractedCode || aiResponse,
          ...result
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.log(`🔧 Surgical application failed: ${error.message}`);
      throw new Error(`Surgical editing failed: ${error.message}`);
    }
  }

  /**
   * NEW: Check if AI response already contains section header
   */
  checkForSectionHeader(content, targetSection) {
    // Check for exact section matches
    const sectionRegex = new RegExp(`\\\\section\\*?\\{[^}]*${targetSection}[^}]*\\}`, 'i');
    if (sectionRegex.test(content)) {
      return true;
    }
    
    // Check for any section header at the beginning
    const anySectionRegex = /^\s*\\section\*?\{[^}]+\}/;
    return anySectionRegex.test(content.trim());
  }

  /**
   * NEW: Format section title properly
   */
  formatSectionTitle(targetSection) {
    // Handle special cases
    const titleMap = {
      'intro': 'Introduction',
      'introduction': 'Introduction',
      'conclusion': 'Conclusion',
      'methodology': 'Methodology',
      'results': 'Results',
      'discussion': 'Discussion'
    };
    
    if (titleMap[targetSection.toLowerCase()]) {
      return titleMap[targetSection.toLowerCase()];
    }
    
    // Default: capitalize first letter
    return targetSection.charAt(0).toUpperCase() + targetSection.slice(1);
  }

  /**
   * Helper method to insert new sections at appropriate locations
   */
  insertNewSection(document, sectionContent) {
    this.log('🆕 Inserting new section into document');
    
    // Find the best insertion point
    let insertionPoint = document.length;
    
    // Look for \end{document} and insert before it
    const endDocMatch = document.match(/\\end\{document\}/);
    if (endDocMatch) {
      insertionPoint = document.indexOf(endDocMatch[0]);
      const before = document.substring(0, insertionPoint).trimEnd();
      const after = document.substring(insertionPoint);
      const newDocument = before + '\n\n' + sectionContent + '\n\n' + after;
      
      return {
        newDocument,
        originalLength: document.length,
        newLength: newDocument.length
      };
    }
    
    // If no \end{document}, just append
    const newDocument = document.trimEnd() + '\n\n' + sectionContent;
    
    return {
      newDocument,
      originalLength: document.length,
      newLength: newDocument.length
    };
  }

  /**
   * Step 6: Validate changes - FIXED TO BE MORE LENIENT FOR SECTION CREATION
   */
  async validateChanges(editSession) {
    this.log('✅ Validating surgical changes...');
    
    const originalDocument = editSession.originalDocument;
    const surgicalStep = editSession.steps.find(s => s.step === 'apply_surgical_changes');
    const newDocument = surgicalStep.newDocument;
    const changes = surgicalStep.changes;
    const intentStep = editSession.steps.find(s => s.step === 'analyze_intent');
    
    const validation = {
      step: 'validate_changes',
      isSurgical: true,
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString()
    };
    
    // Basic validation checks
    validation.metrics.lengthDelta = newDocument.length - originalDocument.length;
    validation.metrics.percentageChange = (Math.abs(validation.metrics.lengthDelta) / originalDocument.length) * 100;
    
    // FIXED: Be more lenient for section creation
    const isCreatingNewSection = intentStep.action === 'add' && intentStep.targetSection && 
                                 !this.lastParser.findSection(intentStep.targetSection);
    
    if (isCreatingNewSection) {
      // For new section creation, allow larger changes
      if (validation.metrics.percentageChange > 200) {
        validation.issues.push('Changes are extremely large for section creation');
        validation.isSurgical = false;
      }
    } else {
      // For other operations, use stricter validation
      if (validation.metrics.percentageChange > 50) {
        validation.issues.push('Changes affect more than 50% of document');
        validation.isSurgical = false;
      }
    }
    
    // Check LaTeX syntax validity
    const syntaxValid = this.validateLatexSyntax(newDocument);
    if (!syntaxValid.valid) {
      validation.issues.push(`LaTeX syntax errors: ${syntaxValid.errors.join(', ')}`);
    }
    
    // FIXED: More lenient structure validation for section creation
    const structureValid = this.validateDocumentStructure(originalDocument, newDocument, isCreatingNewSection);
    if (!structureValid.valid) {
      validation.issues.push(`Structure issues: ${structureValid.issues.join(', ')}`);
    }
    
    validation.syntaxValid = syntaxValid.valid;
    validation.structureValid = structureValid.valid;
    validation.overallValid = validation.isSurgical && syntaxValid.valid && structureValid.valid;
    
    this.log(`✅ Validation: ${validation.overallValid ? 'PASSED' : 'FAILED'} (${validation.issues.length} issues)`);
    
    return validation;
  }

  /**
   * Utility Methods
   */
  
  assessComplexity(instruction, selectedText) {
    const instructionWords = instruction.split(' ').length;
    const hasSelection = selectedText && selectedText.length > 0;
    const hasMultipleActions = instruction.includes(' and ') || instruction.includes(',');
    
    if (instructionWords > 15 || hasMultipleActions) return 'complex';
    if (instructionWords > 8 || hasSelection) return 'medium';
    return 'simple';
  }

  getEditorContext(document, selectionRange) {
    if (!selectionRange || selectionRange.start === selectionRange.end) return document;
    
    const contextStart = Math.max(0, selectionRange.start - 500);
    const contextEnd = Math.min(document.length, selectionRange.end + 500);
    
    return document.substring(contextStart, contextEnd);
  }

  createSurgicalInstructions(action, targetSection, selectedText) {
    const instructions = [
      '\n=== SURGICAL EDITING INSTRUCTIONS ===',
      'CRITICAL: This is surgical editing - make ONLY the requested changes.',
      'Preserve ALL other content exactly as-is.',
      'Maintain proper LaTeX syntax and formatting.',
      'Do NOT add \\documentclass, \\begin{document}, or \\end{document} unless specifically requested.'
    ];

    if (targetSection) {
      instructions.push(`Target: ${targetSection} section only`);
    }

    if (selectedText) {
      instructions.push('Modify only the selected text portion');
    }

    switch (action) {
      case 'delete':
        instructions.push('Return empty string or comment to confirm deletion');
        break;
      case 'replace':
        instructions.push('Return ONLY the replacement content');
        break;
      case 'expand':
        instructions.push('Return ONLY the new content to be added (no existing content)');
        break;
      case 'add':
        if (targetSection) {
          instructions.push('IMPORTANT: Include complete section with \\section{Title} header');
          instructions.push('Format: \\section{Title}\\n\\nContent here...');
          instructions.push('Do NOT assume section header will be added separately');
        } else {
          instructions.push('Return ONLY the new content to be added');
        }
        break;
      case 'improve':
      case 'fix':
        instructions.push('Return the complete improved section with proper LaTeX formatting');
        break;
    }

    instructions.push('=== END SURGICAL INSTRUCTIONS ===\n');
    
    return instructions.join('\n');
  }

  convertPlainTextToLatex(text, action) {
    // Convert plain text responses to LaTeX when appropriate
    if (text.length > 50 && !text.includes('\\')) {
      const paragraphs = text.split('\n\n').filter(p => p.trim());
      
      if (paragraphs.length > 1 && action === 'add') {
        // Multiple paragraphs - format as LaTeX
        return paragraphs.join('\n\n');
      } else if (paragraphs.length === 1 && paragraphs[0].length < 200) {
        // Single short paragraph
        return paragraphs[0];
      }
    }
    
    return text; // Return as-is if can't convert
  }

  applyToSelectedText(document, code, action, selectionRange) {
    const before = document.substring(0, selectionRange.start);
    const after = document.substring(selectionRange.end);
    
    let newDocument;
    switch (action) {
      case 'delete':
        newDocument = before + after;
        break;
      case 'replace':
      case 'improve':
      case 'fix':
        newDocument = before + code + after;
        break;
      default:
        newDocument = before + code + after;
    }
    
    return {
      newDocument,
      originalLength: document.length,
      newLength: newDocument.length
    };
  }

  applyToCursorPosition(document, code) {
    // Smart insertion based on document structure
    const currentCode = document || '';
    
    // Check if document has \end{document}
    if (currentCode.includes('\\end{document}')) {
      // Insert before \end{document}
      const endDocIndex = currentCode.lastIndexOf('\\end{document}');
      const before = currentCode.substring(0, endDocIndex);
      const after = currentCode.substring(endDocIndex);
      const newDocument = before.trimEnd() + '\n\n' + code + '\n\n' + after;
      
      return {
        newDocument,
        originalLength: document.length,
        newLength: newDocument.length
      };
    } else {
      // Simple append to end
      const newDocument = currentCode.trim() + '\n\n' + code;
      
      return {
        newDocument,
        originalLength: document.length,
        newLength: newDocument.length
      };
    }
  }

  validateLatexSyntax(latexCode) {
    const errors = [];
    
    // Check balanced braces
    const openBraces = (latexCode.match(/\{/g) || []).length;
    const closeBraces = (latexCode.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Unbalanced braces');
    }
    
    // Check balanced environments
    const beginEnvs = latexCode.match(/\\begin\{([^}]+)\}/g) || [];
    const endEnvs = latexCode.match(/\\end\{([^}]+)\}/g) || [];
    if (beginEnvs.length !== endEnvs.length) {
      errors.push('Unbalanced environments');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateDocumentStructure(original, modified, isCreatingNewSection = false) {
    // Basic structure validation
    const issues = [];
    
    try {
      const originalParser = new LaTeXParser(original);
      const modifiedParser = new LaTeXParser(modified);
      
      const originalSections = originalParser.documentTree.children.filter(e => e.type === 'section');
      const modifiedSections = modifiedParser.documentTree.children.filter(e => e.type === 'section');
      
      // FIXED: More lenient validation for section creation
      if (isCreatingNewSection) {
        // For new section creation, expect exactly one more section
        if (modifiedSections.length !== originalSections.length + 1) {
          issues.push(`Expected 1 new section, got ${modifiedSections.length - originalSections.length}`);
        }
      } else {
        // For other operations, allow some variation but not too much
        if (Math.abs(modifiedSections.length - originalSections.length) > 3) {
          issues.push('Major section structure changes detected');
        }
      }
      
    } catch (error) {
      issues.push(`Structure parsing failed: ${error.message}`);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }

  // Utility methods
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(...args) {
    if (this.options.debugMode) {
      console.log('🔧 SurgicalEditingService:', ...args);
    }
    this.debugLog.push({
      timestamp: new Date().toISOString(),
      message: args.join(' ')
    });
  }

  // Public API for getting debug info
  getEditHistory() {
    return this.editHistory;
  }

  getDebugLog() {
    return this.debugLog;
  }

  clearHistory() {
    this.editHistory = [];
    this.debugLog = [];
  }
}

export default SurgicalEditingService;
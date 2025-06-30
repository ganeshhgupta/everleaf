// latexProcessor.js
// Advanced LaTeX processing utilities with structured parsing

/**
 * PHASE 1: LaTeX Structure Detector
 * Builds a document tree with precise element boundaries
 */

export class LaTeXParser {
  constructor(content) {
    this.content = content;
    this.lines = content.split('\n');
    this.documentTree = null;
    this.parseDocument();
  }

  parseDocument() {
    this.documentTree = {
      type: 'document',
      children: [],
      metadata: {
        totalLines: this.lines.length,
        totalChars: this.content.length
      }
    };

    let currentPosition = 0;
    
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const lineStart = currentPosition;
      const lineEnd = currentPosition + line.length;
      
      // Detect different LaTeX elements
      const element = this.detectLineElement(line, i, lineStart, lineEnd);
      if (element) {
        this.documentTree.children.push(element);
      }
      
      currentPosition = lineEnd + 1; // +1 for newline
    }

    console.log('📊 Document parsed:', {
      elements: this.documentTree.children.length,
      sections: this.documentTree.children.filter(e => e.type === 'section').length
    });
  }

  detectLineElement(line, lineIndex, charStart, charEnd) {
    const trimmed = line.trim();
    
    // Section detection with hierarchy
    const sectionMatch = trimmed.match(/^\\(chapter|section|subsection|subsubsection|paragraph)\*?\{([^}]+)\}/);
    if (sectionMatch) {
      const [, level, title] = sectionMatch;
      return {
        type: 'section',
        level: level,
        title: title.trim(),
        lineIndex,
        charStart,
        charEnd,
        content: line,
        normalizedTitle: title.toLowerCase().trim()
      };
    }

    // Environment detection
    const beginMatch = trimmed.match(/^\\begin\{([^}]+)\}/);
    if (beginMatch) {
      return {
        type: 'environment_start',
        environment: beginMatch[1],
        lineIndex,
        charStart,
        charEnd,
        content: line
      };
    }

    const endMatch = trimmed.match(/^\\end\{([^}]+)\}/);
    if (endMatch) {
      return {
        type: 'environment_end',
        environment: endMatch[1],
        lineIndex,
        charStart,
        charEnd,
        content: line
      };
    }

    // Bibliography and document structure
    if (trimmed.match(/^\\(bibliographystyle|bibliography|end\{document\})/)) {
      return {
        type: 'document_end_marker',
        command: trimmed,
        lineIndex,
        charStart,
        charEnd,
        content: line
      };
    }

    return null;
  }

  findSection(targetSection) {
    const normalized = targetSection.toLowerCase().trim();
    
    console.log(`🔍 Searching for section: "${normalized}"`);
    
    const sections = this.documentTree.children.filter(e => e.type === 'section');
    console.log(`📋 Available sections:`, sections.map(s => `"${s.normalizedTitle}"`));
    
    // Try multiple matching strategies
    for (const section of sections) {
      // Exact match
      if (section.normalizedTitle === normalized) {
        console.log(`✅ Exact match found: "${section.title}"`);
        return this.buildSectionBoundaries(section);
      }
      
      // Contains match
      if (section.normalizedTitle.includes(normalized) || normalized.includes(section.normalizedTitle)) {
        console.log(`✅ Contains match found: "${section.title}"`);
        return this.buildSectionBoundaries(section);
      }
      
      // Word-based matching for phrases like "literature review"
      const sectionWords = section.normalizedTitle.split(/\s+/);
      const targetWords = normalized.split(/\s+/);
      const commonWords = sectionWords.filter(word => targetWords.includes(word));
      
      if (commonWords.length > 0 && (commonWords.length >= targetWords.length || commonWords.length >= sectionWords.length / 2)) {
        console.log(`✅ Word match found: "${section.title}" (${commonWords.length} common words)`);
        return this.buildSectionBoundaries(section);
      }
    }
    
    console.log(`❌ No section found for: "${normalized}"`);
    return null;
  }

  buildSectionBoundaries(sectionElement) {
    const sections = this.documentTree.children.filter(e => e.type === 'section');
    const currentIndex = sections.indexOf(sectionElement);
    const nextSection = sections[currentIndex + 1];
    
    // Find where this section ends
    let endPosition;
    if (nextSection) {
      endPosition = nextSection.charStart - 1; // Before next section
    } else {
      // Find document end markers
      const endMarkers = this.documentTree.children.filter(e => e.type === 'document_end_marker');
      if (endMarkers.length > 0) {
        endPosition = endMarkers[0].charStart - 1;
      } else {
        endPosition = this.content.length;
      }
    }

    const sectionContent = this.content.substring(sectionElement.charStart, endPosition);
    
    console.log(`📊 Section boundaries for "${sectionElement.title}":`);
    console.log(`   Start: ${sectionElement.charStart}, End: ${endPosition}`);
    console.log(`   Length: ${sectionContent.length} chars`);
    
    return {
      sectionName: sectionElement.title,
      startPos: sectionElement.charStart,
      endPos: endPosition,
      originalContent: sectionContent,
      beforeContent: this.content.substring(0, sectionElement.charStart),
      afterContent: this.content.substring(endPosition),
      element: sectionElement
    };
  }
}

/**
 * PHASE 2: Intent Recognition Layer
 */

export const detectUserAction = (prompt) => {
  const promptLower = prompt.toLowerCase().trim();
  
  // Delete/remove actions
  if (promptLower.includes('delete') || promptLower.includes('remove') || 
      promptLower.includes('clear') || promptLower.includes('get rid of')) {
    return 'delete';
  }
  
  // Replace/rewrite actions
  if (promptLower.includes('make') && (promptLower.includes('just') || promptLower.includes('only'))) {
    return 'replace';
  }
  
  if (promptLower.includes('replace') || promptLower.includes('rewrite') || 
      promptLower.includes('change to') || promptLower.includes('should be')) {
    return 'replace';
  }
  
  // Expand/elaborate actions
  if (promptLower.includes('expand') || promptLower.includes('elaborate') || 
      promptLower.includes('add more') || promptLower.includes('extend')) {
    return 'expand';
  }
  
  // Add/insert actions
  if (promptLower.includes('add') || promptLower.includes('insert') || 
      promptLower.includes('include') || promptLower.includes('create')) {
    return 'add';
  }
  
  // Fix actions
  if (promptLower.includes('fix') || promptLower.includes('correct') || 
      promptLower.includes('repair')) {
    return 'fix';
  }
  
  // Default to improve
  return 'improve';
};

export const detectInsertionPoint = (prompt) => {
  const promptLower = prompt.toLowerCase().trim();
  
  if (promptLower.includes('beginning') || promptLower.includes('start') || promptLower.includes('top')) {
    return 'beginning';
  }
  
  if (promptLower.includes('end') || promptLower.includes('bottom') || promptLower.includes('conclusion')) {
    return 'end';
  }
  
  // Default to end for add actions
  return 'end';
};

export const SECTION_KEYWORDS = [
  'introduction', 'intro', 
  'literature review', 'literature', 'review', 'related work',
  'background', 'methodology', 'methods', 'approach',
  'results', 'findings', 'analysis', 'experiments',
  'discussion', 'evaluation', 'interpretation',
  'conclusion', 'conclusions', 'summary', 'future work',
  'abstract', 'references', 'bibliography', 
  'acknowledgments', 'acknowledgements', 'appendix'
];

export const extractTargetSection = (prompt) => {
  const promptLower = prompt.toLowerCase().trim();
  
  // Try to find section keywords in the prompt
  for (const keyword of SECTION_KEYWORDS) {
    if (promptLower.includes(keyword)) {
      console.log(`🎯 Detected target section: "${keyword}"`);
      return keyword;
    }
  }
  
  return null;
};

/**
 * PHASE 3: Content Generation Pipeline
 */

export const createEnhancedPrompt = (userMessage, selectedText, editorContext, targetSection, action, insertionPoint) => {
  
  // If user manually selected text, use that
  if (selectedText) {
    let actionInstruction = '';
    
    switch (action) {
      case 'delete':
        return `Delete this selected LaTeX code completely. Return just an empty string or comment:

\`\`\`latex
${selectedText}
\`\`\`

IMPORTANT: If you want to delete this content, respond with just "% Content deleted" or an empty response.`;

      case 'replace':
        actionInstruction = 'Replace this selected LaTeX code with the requested content. Return ONLY the replacement code, not the original.';
        break;
        
      case 'expand':
      case 'add':
        actionInstruction = 'Generate ONLY the new content to add. Do NOT include the existing content.';
        break;
        
      default:
        actionInstruction = 'Improve this selected LaTeX code.';
    }
    
    return `${actionInstruction}

Selected LaTeX code:
\`\`\`latex
${selectedText}
\`\`\`

Request: ${userMessage}

IMPORTANT: Only provide the corrected/improved version of the selected code. Do NOT include \\documentclass, \\begin{document}, or \\end{document}. Just the specific code I selected.`;
  }
  
  // Handle section-specific requests
  if (targetSection) {
    const parser = new LaTeXParser(editorContext);
    const boundaries = parser.findSection(targetSection);
    
    if (boundaries) {
      let actionInstruction = '';
      
      switch (action) {
        case 'delete':
          return `Confirm deletion of the ${targetSection} section.

Current ${targetSection} section:
\`\`\`latex
${boundaries.originalContent.substring(0, 200)}...
\`\`\`

IMPORTANT: To confirm deletion, respond with just "% ${targetSection} section deleted" or "CONFIRMED_DELETE".`;

        case 'replace':
          actionInstruction = `Replace the entire ${targetSection} section with new content as requested. Return the complete section with \\section{} header.`;
          break;
          
        case 'expand':
        case 'add':
          actionInstruction = `Generate ONLY the new content to add to the ${insertionPoint} of the ${targetSection} section. Do NOT include section headers or existing content.`;
          break;
          
        default:
          actionInstruction = `Improve the ${targetSection} section.`;
      }
      
      return `${actionInstruction}

Current ${targetSection} section:
\`\`\`latex
${boundaries.originalContent}
\`\`\`

Request: ${userMessage}

CRITICAL INSTRUCTIONS: 
${action === 'expand' || action === 'add'
  ? '- Provide ONLY the new content to be added (no section header, no existing content)'
  : '- Return the COMPLETE modified section with \\section{} header'
}
- Do NOT include \\documentclass, \\begin{document}, or \\end{document}
- Do NOT add any other sections or extra content
- Maintain proper LaTeX formatting and syntax
${action === 'expand' || action === 'add'
  ? '- Format: Just the new sentence(s) or content to append'
  : '- Format: Complete section with all content'
}`;
    }
  }
  
  // Default handling
  return `${userMessage}

Current document context:
\`\`\`latex
${editorContext.slice(-1000)}
\`\`\`

IMPORTANT: My document already has proper structure. Provide working LaTeX code that fits into my existing document. Do NOT include \\documentclass, \\begin{document}, or \\end{document} unless specifically requested.`;
};

/**
 * PHASE 4: Surgical Edit Engine
 */

export const addContentToSection = (latexContent, targetSection, newContent, insertionPoint = 'end') => {
  const parser = new LaTeXParser(latexContent);
  const boundaries = parser.findSection(targetSection);
  
  if (!boundaries) {
    console.log(`❌ Cannot add content to section "${targetSection}" - section not found`);
    return null;
  }
  
  console.log(`📝 Adding content to ${targetSection} section at ${insertionPoint}`);
  console.log(`   Original section: ${boundaries.originalContent.length} chars`);
  console.log(`   New content: "${newContent.trim().substring(0, 100)}..."`);
  
  let updatedSectionContent;
  
  if (insertionPoint === 'beginning') {
    // Add after section header
    const lines = boundaries.originalContent.split('\n');
    const sectionHeaderLine = lines[0]; // First line should be \section{...}
    const restOfContent = lines.slice(1).join('\n');
    updatedSectionContent = sectionHeaderLine + '\n' + newContent.trim() + '\n' + restOfContent;
  } else {
    // Add at end (default)
    updatedSectionContent = boundaries.originalContent.trimEnd() + '\n' + newContent.trim();
  }
  
  // Reconstruct the full document
  const newDocument = boundaries.beforeContent + updatedSectionContent + boundaries.afterContent;
  
  console.log(`✅ Document reconstructed:`);
  console.log(`   Before: ${boundaries.beforeContent.length} chars`);
  console.log(`   Updated section: ${updatedSectionContent.length} chars`);
  console.log(`   After: ${boundaries.afterContent.length} chars`);
  console.log(`   Original total: ${latexContent.length} chars`);
  console.log(`   New total: ${newDocument.length} chars`);
  console.log(`   Difference: ${newDocument.length - latexContent.length} chars`);
  
  return {
    newDocument,
    originalLength: latexContent.length,
    newLength: newDocument.length,
    addedContent: newContent.trim(),
    section: targetSection,
    insertionPoint
  };
};

export const deleteSection = (latexContent, targetSection) => {
  const parser = new LaTeXParser(latexContent);
  const boundaries = parser.findSection(targetSection);
  
  if (!boundaries) {
    console.log(`❌ Cannot delete section "${targetSection}" - section not found`);
    return null;
  }
  
  console.log(`🗑️ Deleting ${targetSection} section`);
  console.log(`   Section length: ${boundaries.originalContent.length} chars`);
  
  // Reconstruct document without the target section
  const newDocument = boundaries.beforeContent + boundaries.afterContent;
  
  console.log(`✅ Section deleted:`);
  console.log(`   Original: ${latexContent.length} chars`);
  console.log(`   New: ${newDocument.length} chars`);
  console.log(`   Removed: ${latexContent.length - newDocument.length} chars`);
  
  return {
    newDocument,
    originalLength: latexContent.length,
    newLength: newDocument.length,
    deletedContent: boundaries.originalContent,
    section: targetSection
  };
};

export const replaceSection = (latexContent, targetSection, newSectionContent) => {
  const parser = new LaTeXParser(latexContent);
  const boundaries = parser.findSection(targetSection);
  
  if (!boundaries) {
    console.log(`❌ Cannot replace section "${targetSection}" - section not found`);
    return null;
  }
  
  console.log(`🔄 Replacing ${targetSection} section`);
  console.log(`   Original length: ${boundaries.originalContent.length} chars`);
  console.log(`   New content length: ${newSectionContent.length} chars`);
  
  // Reconstruct document with new section content
  const newDocument = boundaries.beforeContent + newSectionContent + boundaries.afterContent;
  
  console.log(`✅ Section replaced:`);
  console.log(`   New document length: ${newDocument.length} chars`);
  
  return {
    newDocument,
    originalLength: latexContent.length,
    newLength: newDocument.length,
    replacedContent: newSectionContent,
    section: targetSection
  };
};

/**
 * PHASE 5: Extract LaTeX code from AI response
 */
export const extractLatexCode = (text) => {
  // Look for code blocks (```latex ... ```)
  const codeBlockRegex = /```(?:latex|tex)?\s*([\s\S]*?)```/gi;
  const codeBlocks = [];
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    codeBlocks.push(match[1].trim());
  }
  
  if (codeBlocks.length > 0) {
    return codeBlocks[0]; // Return first code block
  }
  
  // Look for LaTeX commands in the text
  const latexRegex = /\\[a-zA-Z]+(?:\[[^\]]*\])?(?:\{[^}]*\})*|\\[^a-zA-Z\s]/g;
  const hasLatex = latexRegex.test(text);
  
  if (hasLatex && text.length < 500) {
    // If it's short and contains LaTeX, assume it's code
    return text.trim();
  }
  
  return null;
};

/**
 * MAIN ORCHESTRATOR: Smart Application Engine
 */
export const smartApplyCode = (code, prompt, editorContext, selectedText, selectionRange, onApplyText) => {
  if (!onApplyText) return false;

  const action = detectUserAction(prompt);
  const targetSection = extractTargetSection(prompt);
  const insertionPoint = detectInsertionPoint(prompt);
  
  console.log(`🎯 Smart apply orchestrator:`);
  console.log(`   Action: ${action}`);
  console.log(`   Target: ${targetSection || 'none'}`);
  console.log(`   Insertion: ${insertionPoint}`);
  console.log(`   Code length: ${code.length}`);
  
  // Handle section-specific operations first
  if (targetSection) {
    console.log(`🔍 Processing section-specific operation: ${action} on "${targetSection}"`);
    
    // Handle deletion of specific sections
    if (action === 'delete') {
      if (code.includes('CONFIRMED_DELETE') || code.includes('deleted')) {
        console.log('🗑️ Confirmed deletion - removing section');
        const result = deleteSection(editorContext, targetSection);
        
        if (result) {
          console.log('✅ Section deleted, applying new document');
          onApplyText(result.newDocument, { start: 0, end: editorContext.length });
          return true;
        }
      }
      return false;
    }
    
    // Handle adding content to existing sections
    if (action === 'add' || action === 'expand') {
      console.log('➕ Adding content to existing section');
      
      // Clean the code - remove section headers if AI included them
      let cleanContent = code.trim();
      
      // Remove section header if present
      const sectionHeaderRegex = new RegExp(`\\\\section\\*?\\{[^}]*\\}`, 'i');
      if (cleanContent.match(sectionHeaderRegex)) {
        cleanContent = cleanContent.replace(sectionHeaderRegex, '').trim();
        console.log('✂️ Removed section header from AI response');
      }
      
      // Use document reconstruction to add content
      const result = addContentToSection(editorContext, targetSection, cleanContent, insertionPoint);
      
      if (result) {
        console.log('✅ Reconstructing entire document with new content');
        console.log(`🔧 Full document replacement:`);
        console.log(`   Original length: ${editorContext.length}`);
        console.log(`   New length: ${result.newDocument.length}`);
        
        // Use full document replacement
        onApplyText(result.newDocument, { start: 0, end: editorContext.length });
        
        return true;
      } else {
        console.log('❌ Failed to reconstruct document, falling back to cursor insertion');
        onApplyText(cleanContent, null);
        return true;
      }
    }
    
    // Handle section replacement
    if (action === 'replace') {
      console.log('🔄 Replacing entire section');
      const result = replaceSection(editorContext, targetSection, code.trim());
      
      if (result) {
        console.log('✅ Section replaced successfully');
        onApplyText(result.newDocument, { start: 0, end: editorContext.length });
        return true;
      }
    }
  }
  
  // Handle general deletion requests
  if (action === 'delete') {
    if (code.trim() === '' || code.includes('% Content deleted') || code.includes('deleted')) {
      if (selectedText) {
        console.log('🗑️ Deleting selected text');
        onApplyText('', selectionRange);
      } else {
        console.log('🗑️ Deleting entire document');
        onApplyText('', { start: 0, end: editorContext.length });
      }
      return true;
    }
  }
  
  // Handle selected text replacement
  if (selectedText) {
    console.log('✏️ Replacing selected text');
    onApplyText(code, selectionRange);
    return true;
  }
  
  // Default: apply at current cursor position
  console.log('📍 Applying at current cursor position');
  onApplyText(code, null);
  return true;
};
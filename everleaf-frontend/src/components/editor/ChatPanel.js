// Simplified ChatPanel.js - Now just displays messages and handles UI interactions
// LaTeXEditor handles all Flask communication

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  UserIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CodeBracketIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline';

const ChatPanel = ({ 
  projectId, 
  isCollapsed, 
  onToggleCollapse, 
  selectedText = '', 
  selectionRange = { start: 0, end: 0 },
  documents = [],
  ragEnabled = false,
  width = 25,
  // NEW: Props from LaTeXEditor
  messages = [],
  isLoading = false,
  ragMode = true,
  setRagMode,
  onSendMessage,
  onQuickAction,
  onSelectedTextAction,
  onManualApplyText,
  onApplyAnyContent, // NEW: Apply any content function
  extractLatexCode
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [autoApply, setAutoApply] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle sending message to parent (LaTeXEditor)
  const handleSendMessage = (message = null, isLatexAssist = false, assistAction = '') => {
    const messageToSend = message || inputMessage.trim();
    
    if (!messageToSend || isLoading) return;

    // Call parent's send message function
    onSendMessage(messageToSend, isLatexAssist, assistAction);

    // Clear input only if it was a user-typed message
    if (!message) {
      setInputMessage('');
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy text:', err);
      return false;
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Quick action buttons
  const QuickActions = () => (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <button 
        onClick={() => onQuickAction('equation')}
        disabled={isLoading}
        className="flex items-center justify-center space-x-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        <span>📐</span>
        <span>Add Equation</span>
      </button>
      <button 
        onClick={() => onQuickAction('table')}
        disabled={isLoading}
        className="flex items-center justify-center space-x-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        <span>📊</span>
        <span>Add Table</span>
      </button>
      <button 
        onClick={() => onQuickAction('figure')}
        disabled={isLoading}
        className="flex items-center justify-center space-x-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        <span>🖼️</span>
        <span>Add Figure</span>
      </button>
      <button 
        onClick={() => onQuickAction('references')}
        disabled={isLoading}
        className="flex items-center justify-center space-x-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        <span>📚</span>
        <span>Improve Refs</span>
      </button>
    </div>
  );

  const MessageBubble = ({ message }) => {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';
    
    const extractedCode = extractLatexCode(message.content);
    
    const handleCopy = async () => {
      const success = await copyToClipboard(extractedCode || message.content);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };

    const handleApplyCode = () => {
      if (extractedCode) {
        onManualApplyText(message.id, extractedCode);
      }
    };

    // NEW: Handler for applying any content (not just LaTeX code)
    const handleApplyAnyContent = () => {
      onApplyAnyContent(message.id, message.content);
    };

    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-[90%] ${isUser ? 'order-2' : 'order-1'}`}>
          <div className="flex items-center space-x-2 mb-1">
            {isUser ? (
              <UserIcon className="w-4 h-4 text-blue-500" />
            ) : (
              <div className="flex items-center space-x-1">
                <SparklesIcon className="w-4 h-4 text-purple-500" />
                {message.ragContext && (
                  <BookOpenIcon className="w-3 h-3 text-green-500" title="Used reference documents" />
                )}
              </div>
            )}
            <span className="text-xs text-gray-500">
              {isUser ? 'You' : 'AI Assistant'}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            {message.autoApplied && (
              <span className="text-xs text-green-600 bg-green-100 px-1 rounded">
                ✓ Auto-applied
              </span>
            )}
            {message.manuallyApplied && (
              <span className="text-xs text-blue-600 bg-blue-100 px-1 rounded">
                ✓ Applied
              </span>
            )}
          </div>
          
          <div className={`rounded-lg p-3 ${
            message.isError
              ? 'bg-red-50 text-red-900 border border-red-200'
              : isUser 
                ? 'bg-blue-50 text-blue-900 border border-blue-200' 
                : 'bg-gray-50 text-gray-900 border border-gray-200'
          }`}>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
            </div>
            
            {/* RAG Context Indicator */}
            {message.ragContext && message.ragContext.chunks && message.ragContext.chunks.length > 0 && (
              <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs">
                <div className="flex items-center space-x-1 text-green-700 font-medium mb-1">
                  <BookOpenIcon className="w-3 h-3" />
                  <span>Referenced {message.ragContext.chunks.length} document chunk{message.ragContext.chunks.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button 
                onClick={handleCopy}
                className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {copied ? <CheckIcon className="w-3 h-3" /> : <ClipboardDocumentIcon className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
              
              {!isUser && extractedCode && !message.autoApplied && !message.manuallyApplied && (
                <button 
                  onClick={handleApplyCode}
                  className="flex items-center space-x-1 text-xs text-green-600 hover:text-green-800 transition-colors"
                >
                  <WrenchScrewdriverIcon className="w-3 h-3" />
                  <span>Apply LaTeX</span>
                </button>
              )}

              {/* NEW: Apply any content button - shows for all AI responses */}
              {!isUser && !message.autoApplied && !message.manuallyApplied && (
                <button 
                  onClick={handleApplyAnyContent}
                  className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <WrenchScrewdriverIcon className="w-3 h-3" />
                  <span>Apply to Editor</span>
                </button>
              )}
              
              {extractedCode && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  <CodeBracketIcon className="w-3 h-3 inline mr-1" />
                  LaTeX code detected
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-gray-50 border-l border-gray-200 flex flex-col items-center justify-start pt-4">
        <button 
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          onClick={onToggleCollapse}
          title="Open AI LaTeX Assistant"
        >
          <ChatBubbleLeftRightIcon className="w-5 h-5" />
        </button>
        <div className="mt-2 w-2 h-2 bg-green-500 rounded-full" title="AI Assistant Ready"></div>
        {ragEnabled && (
          <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full" title="RAG Mode Active"></div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border-l border-gray-200 flex flex-col" style={{ width: `${width}%` }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <SparklesIcon className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-700">AI LaTeX Assistant</span>
            <div className="w-2 h-2 bg-green-500 rounded-full" title="Connected to Flask/Groq AI"></div>
            {ragEnabled && (
              <div className="flex items-center space-x-1">
                <BookOpenIcon className="w-3 h-3 text-blue-500" />
                <span className="text-xs text-blue-600">{documents.filter(d => d.processingStatus === 'completed').length} docs</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {ragEnabled && (
              <button
                onClick={() => setRagMode(!ragMode)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  ragMode 
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={ragMode ? 'RAG mode enabled' : 'RAG mode disabled'}
              >
                {ragMode ? '🧠 RAG' : '🚫 RAG'}
              </button>
            )}
            <button
              onClick={() => setAutoApply(!autoApply)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                autoApply 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={autoApply ? 'Auto-apply enabled' : 'Auto-apply disabled'}
            >
              {autoApply ? '🔧 Auto' : '✋ Manual'}
            </button>
            <button 
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              onClick={onToggleCollapse}
              title="Collapse chat"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Selected Text Panel */}
      {selectedText && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-3">
          <div className="text-xs font-medium text-yellow-800 mb-2">
            Selected Text ({selectedText.length} chars)
          </div>
          <div className="bg-white border border-yellow-200 rounded p-2 text-xs font-mono text-gray-700 max-h-20 overflow-y-auto">
            {selectedText}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button 
              onClick={() => onSelectedTextAction('fix')}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              🔧 Fix
            </button>
            <button 
              onClick={() => onSelectedTextAction('improve')}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              ✨ Improve
            </button>
            <button 
              onClick={() => onSelectedTextAction('explain')}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              💡 Explain
            </button>
            <button 
              onClick={() => onSelectedTextAction('delete')}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-3 border-b border-gray-200">
        <QuickActions />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {isLoading && (
          <div className="flex items-center space-x-2 text-gray-500 mb-4">
            <SparklesIcon className="w-4 h-4 animate-pulse" />
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
            <span className="text-sm">AI is thinking...</span>
            {ragMode && ragEnabled && (
              <BookOpenIcon className="w-4 h-4 text-blue-500" />
            )}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex space-x-2">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={ragEnabled && ragMode 
              ? "Ask me anything about your documents or LaTeX code..." 
              : "Ask me to write LaTeX code, fix errors, or explain concepts..."}
            className="flex-1 resize-none border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
            rows={2}
          />
          <button 
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          💡 LaTeX Assistant powered by Flask + Groq
        </p>
      </div>
    </div>
  );
};

export default ChatPanel;
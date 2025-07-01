// Modern ChatPanel.js - Clean and aesthetic UI design
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
  BookOpenIcon,
  XMarkIcon
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
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
        <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
          <div className="flex items-center space-x-2 mb-2">
            {isUser ? (
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-white" />
              </div>
            ) : (
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <SparklesIcon className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="text-sm font-medium text-gray-700">
              {isUser ? 'You' : 'AI Assistant'}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            {message.ragContext && (
              <div className="flex items-center space-x-1 bg-green-100 px-2 py-0.5 rounded-full">
                <BookOpenIcon className="w-3 h-3 text-green-600" />
                <span className="text-xs text-green-700 font-medium">RAG</span>
              </div>
            )}
            {message.autoApplied && (
              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                ✓ Auto-applied
              </span>
            )}
            {message.manuallyApplied && (
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
                ✓ Applied
              </span>
            )}
          </div>
          
          <div className={`rounded-2xl px-4 py-3 ${
            message.isError
              ? 'bg-red-50 text-red-900 border border-red-200'
              : isUser 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-900'
          }`}>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
            </div>
            
            {/* RAG Context Indicator */}
            {message.ragContext && message.ragContext.chunks && message.ragContext.chunks.length > 0 && (
              <div className="mt-3 p-3 bg-white bg-opacity-20 rounded-xl text-xs">
                <div className="flex items-center space-x-1 font-medium mb-1">
                  <BookOpenIcon className="w-3 h-3" />
                  <span>Referenced {message.ragContext.chunks.length} document chunk{message.ragContext.chunks.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          {!isUser && (
            <div className="flex flex-wrap items-center gap-2 mt-2 ml-8">
              <button 
                onClick={handleCopy}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-all duration-200 hover:shadow-sm"
              >
                {copied ? <CheckIcon className="w-3 h-3" /> : <ClipboardDocumentIcon className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
              
              {extractedCode && !message.autoApplied && !message.manuallyApplied && (
                <button 
                  onClick={handleApplyCode}
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-all duration-200 hover:shadow-sm"
                >
                  <CodeBracketIcon className="w-3 h-3" />
                  <span>Apply LaTeX</span>
                </button>
              )}

              {/* NEW: Apply any content button - shows for all AI responses */}
              {!message.autoApplied && !message.manuallyApplied && (
                <button 
                  onClick={handleApplyAnyContent}
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all duration-200 hover:shadow-sm"
                >
                  <WrenchScrewdriverIcon className="w-3 h-3" />
                  <span>Apply to Editor</span>
                </button>
              )}
              
              {extractedCode && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg border">
                  <CodeBracketIcon className="w-3 h-3 inline mr-1" />
                  LaTeX detected
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <div className="w-1 bg-gray-50 border-l border-gray-200 flex flex-col items-center justify-start pt-4">
      </div>
    );
  }

  return (
    <div className="bg-white border-l border-gray-200 flex flex-col" style={{ width: `${width}%` }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">AI LaTeX Assistant</h3>
              <div className="flex items-center space-x-2 mt-0.5">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-500">Connected</span>
                {ragEnabled && (
                  <div className="flex items-center space-x-1">
                    <BookOpenIcon className="w-3 h-3 text-blue-500" />
                    <span className="text-xs text-blue-600">{documents.filter(d => d.processingStatus === 'completed').length} docs</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {ragEnabled && (
              <button
                onClick={() => setRagMode(!ragMode)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
                  ragMode 
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={ragMode ? 'RAG mode enabled' : 'RAG mode disabled'}
              >
                {ragMode ? '🧠 RAG On' : '📖 RAG Off'}
              </button>
            )}
            <button
              onClick={() => setAutoApply(!autoApply)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
                autoApply 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={autoApply ? 'Auto-apply enabled' : 'Auto-apply disabled'}
            >
              {autoApply ? '🔧 Auto' : '✋ Manual'}
            </button>
            <button 
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
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
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-yellow-800">
              Selected Text ({selectedText.length} characters)
            </div>
            <button 
              onClick={() => {/* Handle close selected text */}}
              className="p-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 rounded transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white border border-yellow-200 rounded-xl p-3 text-sm font-mono text-gray-700 max-h-24 overflow-y-auto shadow-sm">
            {selectedText}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button 
              onClick={() => onSelectedTextAction('fix')}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-all duration-200 font-medium hover:shadow-sm"
            >
              🔧 Fix Issues
            </button>
            <button 
              onClick={() => onSelectedTextAction('improve')}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-all duration-200 font-medium hover:shadow-sm"
            >
              ✨ Improve
            </button>
            <button 
              onClick={() => onSelectedTextAction('explain')}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-all duration-200 font-medium hover:shadow-sm"
            >
              💡 Explain
            </button>
            <button 
              onClick={() => onSelectedTextAction('delete')}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all duration-200 font-medium hover:shadow-sm"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <SparklesIcon className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to AI LaTeX Assistant</h3>
            <p className="text-gray-600 text-sm mb-6 max-w-sm mx-auto">
              I can help you write LaTeX code, fix errors, explain concepts, and improve your documents.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
              <button 
                onClick={() => onQuickAction('equation')}
                disabled={isLoading}
                className="flex items-center justify-center space-x-2 px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-all duration-200 border border-blue-200"
              >
                <span>📐</span>
                <span>Add Equation</span>
              </button>
              <button 
                onClick={() => onQuickAction('table')}
                disabled={isLoading}
                className="flex items-center justify-center space-x-2 px-3 py-2 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-all duration-200 border border-green-200"
              >
                <span>📊</span>
                <span>Add Table</span>
              </button>
              <button 
                onClick={() => onQuickAction('figure')}
                disabled={isLoading}
                className="flex items-center justify-center space-x-2 px-3 py-2 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-all duration-200 border border-green-200"
              >
                <span>🖼️</span>
                <span>Add Figure</span>
              </button>
              <button 
                onClick={() => onQuickAction('references')}
                disabled={isLoading}
                className="flex items-center justify-center space-x-2 px-3 py-2 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-all duration-200 border border-green-200"
              >
                <span>📚</span>
                <span>Improve Refs</span>
              </button>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {isLoading && (
          <div className="flex items-center justify-center space-x-3 py-4">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-green-500 animate-pulse" />
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">AI is thinking...</span>
              {ragMode && ragEnabled && (
                <BookOpenIcon className="w-4 h-4 text-blue-500" />
              )}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={ragEnabled && ragMode 
                ? "Ask me anything about your documents or LaTeX code..." 
                : "Ask me to write LaTeX code, fix errors, or explain concepts..."}
                              className="w-full resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 placeholder-gray-400"
              disabled={isLoading}
              rows={2}
            />
          </div>
          <button 
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center min-w-[48px] shadow-sm hover:shadow-md"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
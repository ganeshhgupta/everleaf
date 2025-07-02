import React, { useState, useRef, useEffect } from 'react';
import { 
  ChatBubbleLeftRightIcon, 
  PaperAirplaneIcon, 
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  ScissorsIcon,
  WrenchScrewdriverIcon,
  SparklesIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

const ChatPanel = ({
  projectId,
  isCollapsed,
  onToggleCollapse,
  selectedText,
  selectionRange,
  documents,
  ragEnabled,
  width,
  // Chat state
  messages,
  isLoading,
  ragMode,
  setRagMode,
  onSendMessage,
  onQuickAction,
  onSelectedTextAction,
  onManualApplyText,
  onApplyAnyContent,
  extractLatexCode,
  // Surgical editing props
  isProcessingSurgicalEdit,
  surgicalEditHistory,
  surgicalEditingService,
  // NEW: Mobile-specific props (optional)
  isMobile,
  mobileChatPanelOpen,
  onMobileClose
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [showSurgicalHistory, setShowSurgicalHistory] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (inputMessage.trim() && !isLoading) {
      onSendMessage(inputMessage.trim(), false, '');
      setInputMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // SIMPLIFIED: Render clean surgical edit status without technical details
  const renderSurgicalBadge = (message) => {
    if (!message.surgicalEdit) return null;

    const { success } = message.surgicalEdit;
    
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium mb-2 ${
        success 
          ? 'bg-green-50 text-green-700 border border-green-200' 
          : 'bg-red-50 text-red-700 border border-red-200'
      }`}>
        {success ? (
          <>
            <CheckCircleIcon className="w-3 h-3" />
            Applied Successfully
          </>
        ) : (
          <>
            <ExclamationTriangleIcon className="w-3 h-3" />
            Edit Failed
          </>
        )}
      </div>
    );
  };

  // SIMPLIFIED: Clean message content without excessive technical details
  const renderMessageContent = (message) => {
    // FIXED: Don't show the technical surgical editing details in main chat
    // Just show the AI's actual response in a clean format
    let displayContent = message.content;
    
    // Remove technical surgical editing info if it exists
    if (message.surgicalEdit && message.surgicalEdit.success) {
      // Extract just the AI response part if it's buried in technical details
      const aiResponseMatch = displayContent.match(/\*\*AI Response\*\*:\s*(.*?)(?:\n\n|\*\*|$)/s);
      if (aiResponseMatch) {
        displayContent = aiResponseMatch[1].trim();
      } else if (displayContent.includes('**Surgical Edit Applied Successfully**')) {
        // If it's all technical jargon, show a simple success message
        displayContent = "✅ Changes applied successfully!";
      }
    }
    
    return (
      <div className="space-y-2">
        {/* Clean surgical edit badge */}
        {renderSurgicalBadge(message)}
        
        {/* FIXED: Consistent font size with file panel */}
        <div className="text-sm whitespace-pre-wrap break-words">
          {displayContent}
        </div>
        
        {/* Apply buttons for non-auto-applied messages */}
        {message.role === 'assistant' && !message.autoApplied && !message.manuallyApplied && !message.isError && (
          <div className="flex gap-2 mt-3">
            {(() => {
              const extractedCode = extractLatexCode(message.content);
              if (extractedCode) {
                return (
                  <button
                    onClick={() => onManualApplyText(message.id, extractedCode)}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                    title="Apply extracted LaTeX code"
                  >
                    <ClipboardDocumentCheckIcon className="w-3 h-3" />
                    Apply Code
                  </button>
                );
              } else {
                return (
                  <button
                    onClick={() => onApplyAnyContent(message.id, message.content)}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                    title="Apply content as-is"
                  >
                    <ClipboardDocumentCheckIcon className="w-3 h-3" />
                    Apply Content
                  </button>
                );
              }
            })()}
          </div>
        )}
        
        {/* Applied indicator */}
        {(message.autoApplied || message.manuallyApplied) && (
          <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
            <CheckCircleIcon className="w-3 h-3" />
            {message.autoApplied ? 'Auto-applied' : 'Applied manually'}
          </div>
        )}
      </div>
    );
  };

  // Mobile-specific rendering - FIXED: No header strip, just content
  if (isMobile) {
    return (
      <div className="bg-white h-full flex flex-col">
        {/* FIXED: Mobile Header - Only Back Button, No Chat Title */}
        <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onMobileClose}
            className="text-gray-600 hover:text-gray-800 transition-colors p-1 rounded-md hover:bg-gray-100"
            title="Back to Editor"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            {/* Status and controls on the right */}
            {ragEnabled && ragMode && (
              <span className="text-xs text-blue-600 font-medium">RAG</span>
            )}
            {isProcessingSurgicalEdit && (
              <ArrowPathIcon className="w-4 h-4 text-gray-500 animate-spin" />
            )}
          </div>
        </div>

        {/* Mobile Messages - Full height */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.isError
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : message.surgicalEdit?.success
                    ? 'bg-green-50 border border-green-200 text-gray-800'
                    : 'bg-gray-50 border border-gray-200 text-gray-800'
                }`}
              >
                {message.role === 'user' ? (
                  <div>
                    <div className="whitespace-pre-wrap break-words text-sm">{message.content}</div>
                  </div>
                ) : (
                  renderMessageContent(message)
                )}
                
                <div className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                  {message.surgicalEdit && (
                    <span className="ml-2">
                      {message.surgicalEdit.success ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Mobile Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 max-w-[85%]">
                <div className="flex items-center gap-3">
                  <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-500" />
                  <div>
                    <span className="text-gray-600 text-sm">
                      {isProcessingSurgicalEdit ? 'Processing surgical edit...' : 'AI is thinking...'}
                    </span>
                    {isProcessingSurgicalEdit && (
                      <div className="text-xs text-gray-500 mt-1">
                        Analyzing document structure and applying precise changes...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Mobile Input Area */}
        <div className="border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                isProcessingSurgicalEdit
                  ? "Surgical edit in progress..."
                  : "Ask me to write LaTeX code, fix errors, or edit sections..."
              }
              disabled={isLoading || isProcessingSurgicalEdit}
              className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
              rows={3}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || isProcessingSurgicalEdit}
              className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[56px]"
            >
              {isLoading || isProcessingSurgicalEdit ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <PaperAirplaneIcon className="w-5 h-5" />
              )}
            </button>
          </div>
          
          {/* Mobile Status indicators */}
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-4">
              {ragEnabled && ragMode && (
                <span className="text-blue-600 font-medium">RAG Mode Active</span>
              )}
              {isProcessingSurgicalEdit && (
                <span className="text-orange-600 animate-pulse font-medium">Processing edit...</span>
              )}
            </div>
            <div className="text-xs">
              Enter to send
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop rendering when not collapsed
  if (isCollapsed) {
    return null;
  }

  // DESKTOP LAYOUT (unchanged from original)
  return (
    <div 
      className="bg-white border-l border-gray-200 flex flex-col h-full"
      style={{ width: `${width}%` }}
    >
      {/* FIXED: Header with consistent height and no overflow issues */}
      <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between flex-shrink-0 min-h-[44px]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {isProcessingSurgicalEdit ? (
              <ArrowPathIcon className="w-4 h-4 text-gray-500 animate-spin" />
            ) : (
              <WrenchScrewdriverIcon className="w-4 h-4 text-gray-600" />
            )}
            <span className="text-sm font-medium text-gray-700">AI Assistant</span>
          </div>
          
          {ragEnabled && (
            <div className="w-2 h-2 bg-green-500 rounded-full" title="RAG Active"></div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Surgical history toggle */}
          {surgicalEditHistory && surgicalEditHistory.length > 0 && (
            <button
              onClick={() => setShowSurgicalHistory(!showSurgicalHistory)}
              className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded text-xs flex items-center gap-1"
              title={`${surgicalEditHistory.length} recent surgical edits`}
            >
              <ScissorsIcon className="w-3 h-3" />
              {surgicalEditHistory.length}
            </button>
          )}
          
          {/* RAG toggle */}
          <button
            onClick={() => setRagMode(!ragMode)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              ragMode && ragEnabled
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            disabled={!ragEnabled}
            title={ragEnabled ? 'Toggle RAG mode' : 'Upload documents to enable RAG'}
          >
            RAG {ragMode && ragEnabled ? 'ON' : 'OFF'}
          </button>
          
          {/* Collapse button */}
          <button
            onClick={onToggleCollapse}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Surgical Edit History (collapsible) */}
      {showSurgicalHistory && surgicalEditHistory && surgicalEditHistory.length > 0 && (
        <div className="bg-gray-50 border-b border-gray-200 p-3 max-h-32 overflow-y-auto flex-shrink-0">
          <div className="text-xs font-medium text-gray-700 mb-2">Recent Edits</div>
          <div className="space-y-2">
            {surgicalEditHistory.slice(-3).map((edit, index) => (
              <div key={edit.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-gray-200">
                <div className="flex-1 truncate">
                  <div className="font-medium text-gray-700 text-xs">{edit.changes.action || 'Edit'}</div>
                  <div className="text-gray-500 truncate text-xs">{edit.message}</div>
                </div>
                <div className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  edit.validation?.overallValid !== false ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {edit.changes.deltaLength > 0 ? '+' : ''}{edit.changes.deltaLength}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FIXED: Messages with proper flex layout */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.isError
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : message.surgicalEdit?.success
                  ? 'bg-green-50 border border-green-200 text-gray-800'
                  : 'bg-gray-50 border border-gray-200 text-gray-800'
              }`}
            >
              {message.role === 'user' ? (
                <div>
                  <div className="whitespace-pre-wrap break-words text-sm">{message.content}</div>
                </div>
              ) : (
                renderMessageContent(message)
              )}
              
              <div className={`text-xs mt-2 ${
                message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
              }`}>
                {new Date(message.timestamp).toLocaleTimeString()}
                {message.surgicalEdit && (
                  <span className="ml-2">
                    {message.surgicalEdit.success ? '✓' : '✗'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 max-w-[85%]">
              <div className="flex items-center gap-2">
                <ArrowPathIcon className="w-4 h-4 animate-spin text-gray-500" />
                <span className="text-gray-600 text-sm">
                  {isProcessingSurgicalEdit ? 'Processing surgical edit...' : 'AI is thinking...'}
                </span>
              </div>
              {isProcessingSurgicalEdit && (
                <div className="text-xs text-gray-500 mt-1">
                  Analyzing document structure and applying precise changes...
                </div>
              )}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* FIXED: Input Area with consistent sizing */}
      <div className="border-t border-gray-200 p-3 flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              isProcessingSurgicalEdit
                ? "Surgical edit in progress..."
                : "Ask me to write LaTeX code, fix errors, or edit sections..."
            }
            disabled={isLoading || isProcessingSurgicalEdit}
            className="flex-1 resize-none border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            rows={2}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || isProcessingSurgicalEdit}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[40px]"
          >
            {isLoading || isProcessingSurgicalEdit ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <PaperAirplaneIcon className="w-4 h-4" />
            )}
          </button>
        </div>
        
        {/* Status indicators */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-3">
            {ragEnabled && ragMode && (
              <span className="text-blue-600 font-medium">RAG Mode Active</span>
            )}
            {isProcessingSurgicalEdit && (
              <span className="text-orange-600 animate-pulse font-medium">Processing edit...</span>
            )}
          </div>
          <div className="text-xs">
            Enter to send • Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
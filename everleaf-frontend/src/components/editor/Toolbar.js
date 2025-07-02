import React, { useState, useRef, useEffect } from 'react';
import {
  PlayIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  Bars3Icon,
  ShareIcon,
  ArrowLeftIcon,
  PencilIcon,
  CheckIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  XMarkIcon,
  LinkIcon,
  EnvelopeIcon,
  ClipboardDocumentIcon,
  UserIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { downloadTeX, downloadPDF } from '../../utils/latexUtils';

const Toolbar = ({
  project,
  isEditingTitle,
  tempTitle,
  setTempTitle,
  isCompiling,
  pdfUrl,
  sidebarOpen,
  setSidebarOpen,
  activeFile,
  latexCode,
  onTitleClick,
  onTitleSave,
  onTitleCancel,
  onCompile,
  onNavigateBack,
  onCloneProject,
  onDeleteProject,
  // Share-related props
  onShareProject,
  onCreateShareLink,
  projectCollaborators = []
}) => {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showPermissionDropdown, setShowPermissionDropdown] = useState(false);
  const [shareEmails, setShareEmails] = useState('');
  const [sharePermission, setSharePermission] = useState('Editor');
  const [linkSharingEnabled, setLinkSharingEnabled] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [emailsSent, setEmailsSent] = useState(false);
  
  const downloadMenuRef = useRef(null);
  const shareDialogRef = useRef(null);
  const permissionDropdownRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target)) {
        setShowDownloadMenu(false);
      }
      if (shareDialogRef.current && !shareDialogRef.current.contains(event.target)) {
        setShowShareDialog(false);
      }
      if (permissionDropdownRef.current && !permissionDropdownRef.current.contains(event.target)) {
        setShowPermissionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTitleKeyPress = (e) => {
    if (e.key === 'Enter') {
      onTitleSave();
    } else if (e.key === 'Escape') {
      onTitleCancel();
    }
  };

  const handleDownloadTeX = () => {
    downloadTeX(latexCode, activeFile);
    setShowDownloadMenu(false);
  };

  const handleDownloadPDF = () => {
    const success = downloadPDF(pdfUrl, project);
    if (!success) {
      alert('Please compile the document first to generate a PDF');
    }
    setShowDownloadMenu(false);
  };

  const handleCloneProject = () => {
    onCloneProject();
    setShowDownloadMenu(false);
  };

  const handleDeleteProject = () => {
    setShowDownloadMenu(false);
    onDeleteProject();
  };

  const handleInviteByEmail = async () => {
    // Show coming soon message instead of actually sending
    alert('📧 Email invitations coming soon! Use link sharing for now.');
    return;
    
    // Original code commented out:
    /*
    if (!shareEmails.trim()) return;
    
    const emails = shareEmails.split(',').map(email => email.trim()).filter(email => email);
    if (emails.length === 0) return;

    try {
      if (onShareProject) {
        await onShareProject(emails, sharePermission.toLowerCase());
      }
      setEmailsSent(true);
      setShareEmails('');
      
      // Reset success message after 3 seconds
      setTimeout(() => setEmailsSent(false), 3000);
    } catch (error) {
      console.error('Failed to share project:', error);
      alert('Failed to send invitations. Please try again.');
    }
    */
  };

  const handleCreateShareLink = async () => {
    setIsCreatingLink(true);
    try {
      if (onCreateShareLink) {
        const link = await onCreateShareLink(sharePermission.toLowerCase());
        setShareLink(link);
        setLinkSharingEnabled(true);
      } else {
        // Fallback - generate a mock link
        const mockLink = `${window.location.origin}/shared/${project?.id || 'demo'}?access=${sharePermission.toLowerCase()}`;
        setShareLink(mockLink);
        setLinkSharingEnabled(true);
      }
    } catch (error) {
      console.error('Failed to create share link:', error);
      alert('Failed to create share link. Please try again.');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      // You could add a toast notification here
      alert('Link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy link:', error);
      alert('Failed to copy link. Please try again.');
    }
  };

  const handleToggleLinkSharing = () => {
    if (linkSharingEnabled) {
      setLinkSharingEnabled(false);
      setShareLink('');
    } else {
      handleCreateShareLink();
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onNavigateBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span className="text-sm">Back to Dashboard</span>
          </button>
          
          <div className="h-6 w-px bg-gray-300"></div>
          
          {/* Editable Title */}
          <div className="flex items-center space-x-2">
            {isEditingTitle ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onKeyDown={handleTitleKeyPress}
                  onBlur={onTitleSave}
                  className="text-lg font-semibold bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={onTitleSave}
                  className="text-green-600 hover:text-green-700"
                >
                  <CheckIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div 
                className="flex items-center space-x-2 group cursor-pointer"
                onClick={onTitleClick}
              >
                <h1 className="text-lg font-semibold text-gray-900">
                  {project?.title || 'LaTeX Editor'}
                </h1>
                <PencilIcon className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onCompile}
            disabled={isCompiling}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${
              isCompiling 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow-md'
            }`}
          >
            <PlayIcon className="w-4 h-4 mr-2" />
            {isCompiling ? 'Compiling...' : 'Compile'}
          </button>

          {/* Download Menu */}
          <div className="relative" ref={downloadMenuRef}>
            <button
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
              Download
            </button>
            
            {showDownloadMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-3 py-1">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Download</div>
                </div>
                <button
                  onClick={handleDownloadTeX}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                >
                  <DocumentTextIcon className="w-4 h-4 text-gray-500" />
                  <span>Download as .tex</span>
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 text-gray-500" />
                  <span>Download as PDF</span>
                </button>
                
                <div className="border-t border-gray-100 mt-2 pt-2">
                  <div className="px-3 py-1">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Project Actions</div>
                  </div>
                  <button
                    onClick={handleCloneProject}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                  >
                    <DocumentDuplicateIcon className="w-4 h-4 text-gray-500" />
                    <span>Make a copy</span>
                  </button>
                  <button
                    onClick={handleDeleteProject}
                    className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center space-x-3"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span>Delete project</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Share Button with Dialog */}
          <div className="relative" ref={shareDialogRef}>
            <button 
              onClick={() => setShowShareDialog(!showShareDialog)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <ShareIcon className="w-4 h-4 mr-2" />
              Share
            </button>

            {showShareDialog && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-6 z-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Share Project</h3>
                  <button
                    onClick={() => setShowShareDialog(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Add People Section - DISABLED */}
                <div className="mb-6">
                  <div className="text-sm font-medium text-gray-700 mb-3">Add people</div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={shareEmails}
                      onChange={(e) => setShareEmails(e.target.value)}
                      placeholder="Email invitations coming soon..."
                      disabled={true}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-100 cursor-not-allowed opacity-60"
                    />
                    <div className="flex items-center justify-between">
                      <div className="relative" ref={permissionDropdownRef}>
                        <button
                          disabled={true}
                          className="flex items-center justify-between px-3 py-2 pr-8 border border-gray-300 rounded text-sm bg-gray-100 cursor-not-allowed opacity-60 min-w-[100px]"
                        >
                          <span>{sharePermission}</span>
                          <ChevronDownIcon className="w-4 h-4 text-gray-400 ml-2" />
                        </button>
                      </div>
                      <button
                        onClick={handleInviteByEmail}
                        className="px-4 py-2 bg-gray-400 text-white text-sm font-medium rounded cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                      >
                        Coming Soon
                      </button>
                    </div>
                  </div>
                  
                  {emailsSent && (
                    <div className="mt-2 text-sm text-green-600 flex items-center">
                      <CheckIcon className="w-4 h-4 mr-1" />
                      Invitations sent successfully!
                    </div>
                  )}
                </div>

                {/* Link Sharing Section - KEEP FUNCTIONAL */}
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      Link sharing is <strong>{linkSharingEnabled ? 'on' : 'off'}</strong>
                    </span>
                    <button
                      onClick={handleToggleLinkSharing}
                      disabled={isCreatingLink}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
                    >
                      {isCreatingLink ? 'Creating...' : linkSharingEnabled ? 'Turn off' : 'Turn on link sharing'}
                    </button>
                  </div>
                  
                  {linkSharingEnabled && shareLink && (
                    <div className="mt-3 flex items-center space-x-2 p-3 bg-gray-50 rounded border">
                      <LinkIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <input
                        type="text"
                        value={shareLink}
                        readOnly
                        className="flex-1 bg-transparent text-sm text-gray-700 focus:outline-none"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                        title="Copy link"
                      >
                        <ClipboardDocumentIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Current Collaborators */}
                {projectCollaborators.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-3">People with access</div>
                    <div className="space-y-2">
                      {projectCollaborators.map((collaborator, index) => (
                        <div key={index} className="flex items-center justify-between py-2">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                              <UserIcon className="w-4 h-4 text-gray-500" />
                            </div>
                            <span className="text-sm text-gray-900">{collaborator.email}</span>
                          </div>
                          <span className="text-sm text-gray-500">{collaborator.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowShareDialog(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
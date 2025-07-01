import React, { useState, useEffect } from 'react';
import { 
  DocumentTextIcon, 
  SparklesIcon, 
  CloudArrowUpIcon,
  UserGroupIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  AcademicCapIcon,
  EyeIcon,
  DocumentArrowUpIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  ServerIcon,
  BeakerIcon,
  BoltIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';

const FeaturesPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Add CSS animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes float {
        0%, 100% {
          transform: translateY(0px);
        }
        50% {
          transform: translateY(-10px);
        }
      }
      
      .animate-fadeInUp {
        animation: fadeInUp 0.6s ease-out forwards;
      }
      
      .animate-float {
        animation: float 3s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const coreFeatures = [
    {
      icon: DocumentTextIcon,
      title: "Real-time LaTeX Editor",
      description: "Write LaTeX with our intuitive editor featuring syntax highlighting, auto-completion, and instant error detection.",
      details: ["Live syntax highlighting", "Smart auto-completion", "Error detection & suggestions", "Custom themes & layouts"]
    },
    {
      icon: EyeIcon,
      title: "Live Preview",
      description: "See your document rendered in real-time as you type, with synchronized scrolling and instant updates.",
      details: ["Instant rendering", "Synchronized scrolling", "Mobile-responsive preview", "Print-ready formatting"]
    },
    {
      icon: DocumentArrowUpIcon,
      title: "PDF & Research Upload",
      description: "Upload research papers, PDFs, and academic documents to build your personal knowledge base.",
      details: ["Drag & drop upload", "OCR text extraction", "Metadata parsing", "Bulk import support"]
    },
    {
      icon: BeakerIcon,
      title: "Vector Embeddings",
      description: "Advanced AI converts your research papers into searchable vector embeddings for intelligent retrieval.",
      details: ["State-of-the-art embeddings", "Semantic search capability", "Cross-reference detection", "Citation mapping"]
    },
    {
      icon: MagnifyingGlassIcon,
      title: "RAG-Powered Research",
      description: "Retrieval-Augmented Generation searches through hundreds of papers to find relevant information instantly.",
      details: ["Semantic similarity search", "Context-aware retrieval", "Multi-document synthesis", "Source attribution"]
    },
    {
      icon: ChatBubbleLeftRightIcon,
      title: "AI Research Assistant",
      description: "Chat with an AI assistant that understands your research context and can help with writing and analysis.",
      details: ["Context-aware responses", "Research methodology help", "Citation assistance", "Writing style suggestions"]
    },
    {
      icon: LightBulbIcon,
      title: "Real-time Information Injection",
      description: "Ask the AI to look up specific information and inject it directly into your LaTeX document.",
      details: ["Instant fact-checking", "Citation generation", "Data insertion", "Reference formatting"]
    },
    {
      icon: ArrowDownTrayIcon,
      title: "Export & Download",
      description: "Download your work as .tex files or compiled PDFs with professional formatting and styling.",
      details: ["Multiple export formats", "Custom templates", "Publication-ready PDFs", "Version control"]
    },
    {
      icon: ShareIcon,
      title: "Collaboration & Sharing",
      description: "Share your documents with colleagues and collaborators with granular permission controls.",
      details: ["Real-time collaboration", "Comment system", "Version history", "Access controls"]
    },
    {
      icon: CloudArrowUpIcon,
      title: "Cloud Storage",
      description: "All your documents and research are securely stored in the cloud with automatic synchronization.",
      details: ["Automatic backups", "Cross-device sync", "Offline access", "Enterprise security"]
    }
  ];

  const workflowSteps = [
    {
      step: "01",
      title: "Upload Research",
      description: "Upload PDFs, research papers, or paste links to academic sources",
      icon: DocumentArrowUpIcon
    },
    {
      step: "02", 
      title: "AI Processing",
      description: "Our AI converts papers into searchable vector embeddings",
      icon: SparklesIcon
    },
    {
      step: "03",
      title: "Start Writing",
      description: "Begin writing in our LaTeX editor with live preview",
      icon: DocumentTextIcon
    },
    {
      step: "04",
      title: "AI Assistance",
      description: "Ask AI to research and inject relevant information",
      icon: ChatBubbleLeftRightIcon
    },
    {
      step: "05",
      title: "Export & Share",
      description: "Download as PDF/LaTeX or share with collaborators",
      icon: ShareIcon
    }
  ];

  const tabs = [
    { id: 'editor', label: 'LaTeX Editor', icon: DocumentTextIcon },
    { id: 'research', label: 'Research Tools', icon: MagnifyingGlassIcon },
    { id: 'ai', label: 'AI Assistant', icon: SparklesIcon },
    { id: 'collaboration', label: 'Collaboration', icon: UserGroupIcon }
  ];

  const getTabContent = (tabId) => {
    switch(tabId) {
      case 'editor':
        return (
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
            <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm text-green-400 mb-4">
              <div className="flex items-center mb-2">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <span className="ml-4 text-gray-400">research_paper.tex</span>
              </div>
              <div className="space-y-1">
                <div>\documentclass&#123;article&#125;</div>
                <div>\usepackage&#123;amsmath,cite&#125;</div>
                <div>\title&#123;<span className="text-blue-400">Machine Learning in Healthcare</span>&#125;</div>
                <div>\begin&#123;document&#125;</div>
                <div>\section&#123;Introduction&#125;</div>
                <div><span className="text-yellow-400">Recent studies show that...</span></div>
                <div className="text-purple-400">% AI: Found 23 relevant papers</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Live Preview</h4>
                <div className="h-32 bg-white rounded border-2 border-dashed border-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <DocumentTextIcon className="w-8 h-8 mx-auto text-primary-500 mb-2" />
                    <p className="text-sm text-gray-600">Real-time rendering</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">AI Suggestions</h4>
                <div className="space-y-2">
                  <div className="bg-primary-50 text-primary-700 p-2 rounded text-xs">
                    💡 Consider adding citation for this claim
                  </div>
                  <div className="bg-green-50 text-green-700 p-2 rounded text-xs">
                    ✨ Found relevant paper: "AI in Medical Diagnosis"
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'research':
        return (
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-1">
                <h4 className="font-semibold text-gray-900 mb-4">Research Library</h4>
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <DocumentTextIcon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">AI in Healthcare.pdf</span>
                    </div>
                    <p className="text-xs text-gray-600">Nature Medicine, 2024</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <DocumentTextIcon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">ML Diagnostics.pdf</span>
                    </div>
                    <p className="text-xs text-gray-600">Science, 2024</p>
                  </div>
                  <div className="bg-primary-50 p-3 rounded-lg border-2 border-primary-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <SparklesIcon className="w-4 h-4 text-primary-600" />
                      <span className="text-sm font-medium text-primary-800">Processing...</span>
                    </div>
                    <p className="text-xs text-primary-600">Creating embeddings</p>
                  </div>
                </div>
              </div>
              <div className="col-span-2">
                <h4 className="font-semibold text-gray-900 mb-4">Vector Search Results</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="mb-3">
                    <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                      <MagnifyingGlassIcon className="w-4 h-4" />
                      <span>Query: "machine learning accuracy in medical diagnosis"</span>
                    </div>
                    <div className="text-xs text-gray-500">Found 127 relevant passages across 23 papers</div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <div className="text-sm font-medium text-gray-900">Relevance: 94%</div>
                      <p className="text-sm text-gray-700 mt-1">"Machine learning models achieved 97.3% accuracy in diabetic retinopathy detection..."</p>
                      <div className="text-xs text-gray-500 mt-1">Source: Nature Medicine 2024</div>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-blue-500">
                      <div className="text-sm font-medium text-gray-900">Relevance: 89%</div>
                      <p className="text-sm text-gray-700 mt-1">"Deep learning approaches demonstrated superior performance compared to traditional methods..."</p>
                      <div className="text-xs text-gray-500 mt-1">Source: Science 2024</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'ai':
        return (
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">AI Chat Assistant</h4>
                <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto">
                  <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                        <SparklesIcon className="w-3 h-3 text-white" />
                      </div>
                      <div className="bg-white p-3 rounded-lg flex-1">
                        <p className="text-sm">Hello! I can help you research and write your paper. What would you like to know?</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2 justify-end">
                      <div className="bg-primary-600 text-white p-3 rounded-lg max-w-xs">
                        <p className="text-sm">Find me recent studies on AI accuracy in medical diagnosis and add relevant citations to my paper</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                        <SparklesIcon className="w-3 h-3 text-white" />
                      </div>
                      <div className="bg-white p-3 rounded-lg flex-1">
                        <p className="text-sm">I found 23 relevant papers. I'll inject the most relevant findings with proper citations into your document. Would you like me to focus on any specific aspect?</p>
                        <div className="mt-2 flex space-x-2">
                          <button className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Insert Citations</button>
                          <button className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Add to LaTeX</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Real-time Injection</h4>
                <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm text-green-400">
                  <div className="space-y-1">
                    <div>\section&#123;Results&#125;</div>
                    <div><span className="bg-yellow-400 text-gray-900 px-1">Recent studies demonstrate that machine learning models achieve accuracy rates of 95-98\% in medical image classification \cite&#123;smith2024,jones2024&#125;</span></div>
                    <div>\subsection&#123;Performance Metrics&#125;</div>
                    <div><span className="text-purple-400">% AI: Injecting relevant statistics...</span></div>
                    <div><span className="bg-green-400 text-gray-900 px-1">Deep learning approaches show significant improvement over traditional methods (p&lt;0.001) \cite&#123;brown2024&#125;</span></div>
                  </div>
                </div>
                <div className="mt-4 bg-primary-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 text-primary-700">
                    <LightBulbIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">AI Suggestion</span>
                  </div>
                  <p className="text-sm text-primary-600 mt-1">I've added 3 citations and 2 statistical findings to your Results section. Would you like me to add a comparison table?</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'collaboration':
        return (
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Live Collaboration</h4>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      JD
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Dr. Jane Doe</span>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-gray-500">Online</span>
                      </div>
                      <p className="text-xs text-gray-600">Currently editing Introduction</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      MS
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Mike Smith</span>
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-xs text-gray-500">Online</span>
                      </div>
                      <p className="text-xs text-gray-600">Reviewing Results section</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Recent Activity</h5>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p>• Jane added citation to line 47</p>
                      <p>• Mike commented on methodology</p>
                      <p>• You updated bibliography</p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Comments & Reviews</h4>
                <div className="bg-gray-50 rounded-lg p-4 h-48 overflow-y-auto">
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded-lg border-l-4 border-yellow-500">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium">Jane Doe</span>
                        <span className="text-xs text-gray-500">2 hours ago</span>
                      </div>
                      <p className="text-sm text-gray-700">This section needs more recent citations. Consider adding the 2024 Nature paper.</p>
                      <div className="mt-2">
                        <button className="text-xs text-primary-600 hover:text-primary-700">Reply</button>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border-l-4 border-green-500">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium">Mike Smith</span>
                        <span className="text-xs text-gray-500">4 hours ago</span>
                      </div>
                      <p className="text-sm text-gray-700">Great analysis! The statistical approach looks solid.</p>
                      <div className="mt-2">
                        <span className="text-xs text-green-600">✓ Resolved</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 bg-primary-50 rounded-lg p-3">
                  <h5 className="text-sm font-medium text-primary-800 mb-2">Export & Share</h5>
                  <div className="flex space-x-2">
                    <button className="text-xs bg-primary-600 text-white px-3 py-1 rounded">Export PDF</button>
                    <button className="text-xs bg-white text-primary-600 border border-primary-600 px-3 py-1 rounded">Share Link</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/90 backdrop-blur-md shadow-lg' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <a href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <AcademicCapIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Everleaf</span>
            </a>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-primary-600 font-medium">Features</a>
              <a href="/#about" className="text-gray-600 hover:text-primary-600 transition-colors">About</a>
              <a href="#pricing" className="text-gray-600 hover:text-primary-600 transition-colors">Pricing</a>
              <a href="/login" className="text-primary-600 hover:text-primary-700 font-medium">Sign In</a>
              <a href="/signup" className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">Get Started</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div>
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Powerful Features for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-green-600">
                Modern Research
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Discover how Everleaf combines advanced AI, intuitive LaTeX editing, and intelligent research tools 
              to revolutionize your academic writing workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/signup" className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-8 rounded-lg transition-colors text-lg">
                Try All Features Free
                <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
              </a>
              <button className="border-2 border-primary-600 text-primary-600 hover:bg-primary-50 font-medium py-3 px-8 rounded-lg transition-colors text-lg">
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Feature Demo */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div 
            className="text-center mb-12 opacity-0 translate-y-4 animate-fadeInUp"
            style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              See Everleaf in Action
            </h2>
            <p className="text-xl text-gray-600">
              Explore our core features through interactive demos
            </p>
          </div>

          <div 
            className="mb-8 opacity-0 translate-y-4 animate-fadeInUp"
            style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
          >
            <div className="flex flex-wrap justify-center gap-4">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 ${
                    activeTab === tab.id
                      ? 'bg-primary-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={{ 
                    opacity: 0,
                    transform: 'translateY(16px)',
                    animation: `fadeInUp 0.6s ease-out ${0.3 + index * 0.1}s forwards`
                  }}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div 
            className="mb-16 opacity-0 translate-y-4 animate-fadeInUp"
            style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
          >
            {getTabContent(activeTab)}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-50 to-green-50">
        <div className="max-w-7xl mx-auto">
          <div 
            className="text-center mb-16 opacity-0 translate-y-4 animate-fadeInUp"
            style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How Everleaf Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From research upload to final publication, here's how Everleaf streamlines your entire workflow
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {workflowSteps.map((step, index) => (
              <div
                key={index}
                className="text-center relative opacity-0 translate-y-4"
                style={{ 
                  animation: `fadeInUp 0.6s ease-out ${0.2 + index * 0.1}s forwards`
                }}
              >
                <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center mx-auto mb-4 relative z-10 transition-transform duration-300 hover:scale-110">
                  <step.icon className="w-8 h-8 text-primary-600" />
                </div>
                <div className="absolute top-8 left-1/2 w-full h-0.5 bg-primary-200 -z-10 hidden lg:block" 
                     style={{ display: index === workflowSteps.length - 1 ? 'none' : 'block' }} />
                <div className="bg-primary-600 text-white text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 -mt-2 transition-transform duration-300 hover:scale-110">
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div 
            className="text-center mb-16 opacity-0 translate-y-4 animate-fadeInUp"
            style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Complete Feature Overview
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Every tool you need for professional academic writing, research, and collaboration
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {coreFeatures.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 group transform hover:scale-105 opacity-0 translate-y-4"
                style={{ 
                  animation: `fadeInUp 0.6s ease-out ${0.2 + index * 0.1}s forwards`
                }}
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary-600 transition-all duration-300 group-hover:scale-110">
                  <feature.icon className="w-6 h-6 text-primary-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                <ul className="space-y-1">
                  {feature.details.map((detail, i) => (
                    <li key={i} className="text-sm text-gray-500 flex items-center transform transition-transform duration-200 hover:translate-x-1">
                      <div className="w-1.5 h-1.5 bg-primary-500 rounded-full mr-2 transition-all duration-200 group-hover:bg-primary-600" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Specs */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div 
            className="text-center mb-16 opacity-0 translate-y-4 animate-fadeInUp"
            style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
          >
            <h2 className="text-4xl font-bold mb-4">
              Built on Cutting-Edge Technology
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Advanced AI, secure cloud infrastructure, and modern web technologies power your research workflow
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: SparklesIcon,
                title: "AI Models",
                description: "State-of-the-art language models and vector embeddings",
                gradient: "from-primary-500 to-green-500"
              },
              {
                icon: ServerIcon,
                title: "Cloud Infrastructure", 
                description: "Enterprise-grade security with 99.9% uptime",
                gradient: "from-blue-500 to-purple-500"
              },
              {
                icon: BoltIcon,
                title: "Real-time Sync",
                description: "Instant updates across all devices and collaborators", 
                gradient: "from-yellow-500 to-orange-500"
              },
              {
                icon: GlobeAltIcon,
                title: "Global Access",
                description: "Available worldwide with fast CDN delivery",
                gradient: "from-green-500 to-teal-500"
              }
            ].map((tech, index) => (
              <div 
                key={index}
                className="text-center opacity-0 translate-y-4 transform hover:scale-105 transition-all duration-300"
                style={{ 
                  animation: `fadeInUp 0.6s ease-out ${0.2 + index * 0.1}s forwards`
                }}
              >
                <div className={`w-16 h-16 bg-gradient-to-br ${tech.gradient} rounded-lg flex items-center justify-center mx-auto mb-4 transition-transform duration-300 hover:scale-110 hover:rotate-3`}>
                  <tech.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{tech.title}</h3>
                <p className="text-gray-300 text-sm">{tech.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <div 
            className="opacity-0 translate-y-4 animate-fadeInUp"
            style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 mb-12">
              Get started with all features completely free. No hidden costs, no commitments.
            </p>
          </div>
          
          <div 
            className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 max-w-md mx-auto opacity-0 translate-y-4 animate-fadeInUp"
            style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
          >
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Free Plan</h3>
              <div className="mb-6">
                <span className="text-5xl font-bold text-primary-600">$0</span>
                <span className="text-gray-500 ml-2">forever</span>
              </div>
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Unlimited LaTeX projects
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  AI research assistant
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Real-time collaboration
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Cloud storage & sync
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  PDF export & sharing
                </li>
              </ul>
              <a 
                href="/signup" 
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg transition-colors inline-block"
              >
                Get Started Free
              </a>
            </div>
          </div>
          
          <div 
            className="text-gray-500 text-sm mt-6 opacity-0 animate-fadeInUp"
            style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}
          >
            No credit card required • Start writing immediately
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-green-600 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Experience the Future of Research Writing?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join thousands of researchers who've already transformed their workflow with Everleaf's powerful features.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/signup" className="bg-white text-primary-600 hover:bg-gray-100 font-medium py-3 px-8 rounded-lg transition-colors text-lg">
              Start Free Trial
              <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
            </a>
            <a href="/demo" className="border-2 border-white text-white hover:bg-white hover:text-primary-600 font-medium py-3 px-8 rounded-lg transition-colors text-lg">
              Schedule Demo
            </a>
          </div>
          <p className="text-primary-100 text-sm mt-4">
            No credit card required • All features included • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <a href="/" className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <AcademicCapIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">Everleaf</span>
              </a>
              <p className="text-gray-400">
                The future of academic writing, powered by AI.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="hover:text-white transition-colors text-left"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      const pricingSection = document.getElementById('pricing');
                      if (pricingSection) {
                        pricingSection.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="hover:text-white transition-colors text-left"
                  >
                    Pricing
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="/#about" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Everleaf. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FeaturesPage;
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  DocumentTextIcon, 
  SparklesIcon, 
  CloudArrowUpIcon,
  UserGroupIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: DocumentTextIcon,
      title: "LaTeX Made Simple",
      description: "Write beautiful documents with our intuitive LaTeX editor and real-time preview."
    },
    {
      icon: SparklesIcon,
      title: "AI-Powered Assistant",
      description: "Get intelligent suggestions and automated formatting with our AI copilot."
    },
    {
      icon: CloudArrowUpIcon,
      title: "Cloud Sync",
      description: "Access your projects anywhere with automatic cloud synchronization."
    },
    {
      icon: UserGroupIcon,
      title: "Real-time Collaboration",
      description: "Work together seamlessly with your team in real-time."
    },
    {
      icon: ChartBarIcon,
      title: "Advanced Analytics",
      description: "Track your writing progress and productivity with detailed insights."
    },
    {
      icon: ShieldCheckIcon,
      title: "Secure & Private",
      description: "Your documents are encrypted and securely stored in the cloud."
    }
  ];

  const testimonials = [
    {
      name: "Dr. Sarah Chen",
      role: "Research Professor",
      institution: "MIT",
      quote: "Everleaf has revolutionized how I write research papers. The AI assistance is incredible."
    },
    {
      name: "Marcus Rodriguez",
      role: "PhD Student",
      institution: "Stanford",
      quote: "The collaborative features make working with my advisor so much easier."
    },
    {
      name: "Prof. Emily Watson",
      role: "Department Head",
      institution: "Harvard",
      quote: "Our entire department switched to Everleaf. It's simply the best LaTeX editor available."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/90 backdrop-blur-md shadow-lg' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <AcademicCapIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Everleaf</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-primary-600 transition-colors">Features</a>
              <a href="#testimonials" className="text-gray-600 hover:text-primary-600 transition-colors">Testimonials</a>
              <a href="#pricing" className="text-gray-600 hover:text-primary-600 transition-colors">Pricing</a>
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">Sign In</Link>
              <Link to="/signup" className="btn-primary">Get Started</Link>
            </div>

            <div className="md:hidden">
              <button className="text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center lg:text-left"
            >
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Your AI Copilot for{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-green-600">
                  Research Writing
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Transform your academic writing with intelligent LaTeX editing, real-time collaboration, 
                and AI-powered assistance. Write faster, collaborate better, publish sooner.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link to="/signup" className="btn-primary px-8 py-3 text-lg">
                  Start Writing Free
                  <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
                </Link>
                <button className="btn-secondary px-8 py-3 text-lg">
                  Watch Demo
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                No credit card required • Free forever plan available
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm text-green-400 mb-4">
                  <div className="flex items-center mb-2">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <span className="ml-4 text-gray-400">paper.tex</span>
                  </div>
                  <div className="space-y-1">
                    <div>\\documentclass&#123;article&#125;</div>
                    <div>\\usepackage&#123;amsmath&#125;</div>
                    <div>\\title&#123;<span className="text-blue-400">Research Paper</span>&#125;</div>
                    <div>\\author&#123;<span className="text-yellow-400">You</span>&#125;</div>
                    <div className="text-gray-500">% AI suggestion: Add abstract</div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-200">
                  <div className="text-center text-gray-600">
                    <DocumentTextIcon className="w-12 h-12 mx-auto mb-2 text-primary-500" />
                    <p className="font-medium">Live Preview</p>
                    <p className="text-sm">See your document as you type</p>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-primary-500 to-green-500 rounded-full animate-float opacity-20"></div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full animate-float opacity-20" style={{ animationDelay: '2s' }}></div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-600 mb-8 font-medium">Trusted by researchers at</p>
          <div className="flex justify-center items-center space-x-8 opacity-60">
            <div className="text-2xl font-bold text-gray-400">MIT</div>
            <div className="text-2xl font-bold text-gray-400">Stanford</div>
            <div className="text-2xl font-bold text-gray-400">Harvard</div>
            <div className="text-2xl font-bold text-gray-400">Berkeley</div>
            <div className="text-2xl font-bold text-gray-400">Oxford</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything you need to write better
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From beginner-friendly templates to advanced AI assistance, 
              Everleaf provides all the tools you need for academic success.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Loved by researchers worldwide
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of academics who've transformed their writing workflow
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white rounded-xl p-6 shadow-lg"
              >
                <p className="text-gray-700 mb-4 italic">"{testimonial.quote}"</p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div className="ml-3">
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}, {testimonial.institution}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-green-600 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to transform your writing?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join thousands of researchers who've already made the switch to smarter writing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup" className="bg-white text-primary-600 hover:bg-gray-100 font-medium py-3 px-8 rounded-lg transition-colors text-lg">
              Start Free Trial
            </Link>
            <Link to="/admin/login" className="border-2 border-white text-white hover:bg-white hover:text-primary-600 font-medium py-3 px-8 rounded-lg transition-colors text-lg">
              Admin Access
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <AcademicCapIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">Everleaf</span>
              </div>
              <p className="text-gray-400">
                The future of academic writing, powered by AI.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Templates</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Everleaf. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
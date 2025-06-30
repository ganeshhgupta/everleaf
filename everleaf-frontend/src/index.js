// src/index.js - Simple and effective ResizeObserver error suppression
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// COMPLETE ResizeObserver error suppression - Add this BEFORE React renders
(() => {
  // 1. Override console.error to suppress ResizeObserver errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    if (args[0] && args[0].toString().includes('ResizeObserver')) {
      return; // Silently ignore
    }
    originalConsoleError.apply(console, args);
  };

  // 2. Override window.onerror to prevent error boundary triggers
  window.onerror = function(msg, url, lineNo, columnNo, error) {
    if (msg && msg.toString().includes('ResizeObserver')) {
      return true; // Prevent default error handling
    }
    return false;
  };

  // 3. Override addEventListener to catch error events
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'error') {
      const wrappedListener = function(event) {
        if (event.message && event.message.includes('ResizeObserver')) {
          event.stopImmediatePropagation();
          event.preventDefault();
          return;
        }
        if (typeof listener === 'function') {
          return listener.call(this, event);
        }
      };
      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  // 4. Override ResizeObserver constructor to catch errors at source
  if (window.ResizeObserver) {
    const OriginalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends OriginalResizeObserver {
      constructor(callback) {
        super((entries, observer) => {
          requestAnimationFrame(() => {
            try {
              callback(entries, observer);
            } catch (error) {
              // Silently ignore ResizeObserver callback errors
            }
          });
        });
      }
    };
  }

  // 5. Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', event => {
    if (event.reason && event.reason.toString().includes('ResizeObserver')) {
      event.preventDefault();
    }
  });

  // 6. Override React's error reporting (for development)
  if (process.env.NODE_ENV === 'development') {
    // Prevent React DevTools from showing ResizeObserver errors
    const originalReactError = window.__REACT_ERROR_OVERLAY_GLOBAL_HOOK__;
    if (originalReactError) {
      window.__REACT_ERROR_OVERLAY_GLOBAL_HOOK__ = {
        ...originalReactError,
        captureException: function(error) {
          if (error && error.message && error.message.includes('ResizeObserver')) {
            return; // Don't show in React error overlay
          }
          if (originalReactError.captureException) {
            originalReactError.captureException(error);
          }
        }
      };
    }
  }
})();

// Now render React normally
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
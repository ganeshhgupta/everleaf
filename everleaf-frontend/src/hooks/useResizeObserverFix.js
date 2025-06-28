import { useEffect } from 'react';

const useResizeObserverFix = () => {
  useEffect(() => {
    // Store original console methods
    const originalError = console.error;
    const originalWarn = console.warn;
    
    // Override console methods to suppress ResizeObserver errors
    console.error = (...args) => {
      if (args.some(arg => 
        typeof arg === 'string' && (
          arg.includes('ResizeObserver') ||
          arg.includes('ResizeObserver loop completed') ||
          arg.includes('ResizeObserver loop limit exceeded')
        )
      )) {
        return; // Suppress ResizeObserver errors
      }
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      if (args.some(arg => 
        typeof arg === 'string' && arg.includes('ResizeObserver')
      )) {
        return; // Suppress ResizeObserver warnings
      }
      originalWarn.apply(console, args);
    };

    // Handle all error events
    const handleError = (e) => {
      if (
        e.message?.includes('ResizeObserver') || 
        e.error?.message?.includes('ResizeObserver') ||
        (typeof e === 'string' && e.includes('ResizeObserver'))
      ) {
        e.stopImmediatePropagation?.();
        e.preventDefault?.();
        return false;
      }
    };

    // Handle unhandled promise rejections
    const handleRejection = (e) => {
      if (e.reason?.message?.includes?.('ResizeObserver')) {
        e.preventDefault();
        return false;
      }
    };

    // Add multiple event listeners
    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleRejection, true);
    
    // Also catch errors on window object
    const originalOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      if (typeof message === 'string' && message.includes('ResizeObserver')) {
        return true; // Prevent default error handling
      }
      if (originalOnError) {
        return originalOnError(message, source, lineno, colno, error);
      }
    };
    
    // Cleanup function
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.onerror = originalOnError;
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleRejection, true);
    };
  }, []);

  // Additional useEffect for handling window resize with debouncing
  useEffect(() => {
    let timeoutId = null;
    
    const handleResize = () => {
      // Clear any pending timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Debounce the layout call
      timeoutId = setTimeout(() => {
        // This could be used to manually trigger editor layout if needed
        // For now, we'll just clear the timeout
        timeoutId = null;
      }, 300); // Wait 300ms after resize stops
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);
};

export default useResizeObserverFix;
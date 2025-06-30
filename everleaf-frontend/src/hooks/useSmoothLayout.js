// src/hooks/useSmoothLayout.js - Create this new file
// Custom hook to handle layout changes smoothly and prevent ResizeObserver issues

import { useState, useCallback, useRef, useEffect } from 'react';

export const useSmoothLayout = (initialCollapsed = true) => {
    const [isChatCollapsed, setIsChatCollapsed] = useState(initialCollapsed);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const timeoutRef = useRef(null);
    const editorRef = useRef(null);
    
    // Debounced layout change handler
    const handleToggleChat = useCallback(() => {
        if (isTransitioning) return; // Prevent rapid toggling
        
        setIsTransitioning(true);
        
        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        // Use RAF for smooth transitions
        requestAnimationFrame(() => {
            setIsChatCollapsed(prev => !prev);
            
            // Notify Monaco Editor to layout after transition
            timeoutRef.current = setTimeout(() => {
                if (editorRef.current && editorRef.current.layout) {
                    try {
                        editorRef.current.layout();
                    } catch (error) {
                        // Ignore ResizeObserver errors
                    }
                }
                setIsTransitioning(false);
            }, 300); // Match CSS transition duration
        });
    }, [isTransitioning]);
    
    // Auto layout handler for Monaco Editor
    const registerEditor = useCallback((editor) => {
        editorRef.current = editor;
    }, []);
    
    // Layout dimensions calculator
    const getLayoutDimensions = useCallback(() => {
        if (isChatCollapsed) {
            return {
                editor: 50,
                chat: 0,
                preview: 50
            };
        } else {
            return {
                editor: 35,
                chat: 25,
                preview: 40
            };
        }
    }, [isChatCollapsed]);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);
    
    return {
        isChatCollapsed,
        isTransitioning,
        handleToggleChat,
        registerEditor,
        getLayoutDimensions
    };
};
import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeConfig {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  systemTheme: 'light' | 'dark';
  resolvedTheme: 'light' | 'dark';
}

export function useTheme(): ThemeConfig {
  // Get initial theme from localStorage or default to 'auto'
  const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'auto';
    
    const stored = localStorage.getItem('theme') as Theme;
    return stored || 'auto';
  };

  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Set initial system theme
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const resolvedTheme = theme === 'auto' ? systemTheme : theme;
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark');
    
    // Add new theme class
    root.classList.add(resolvedTheme);
    
    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        resolvedTheme === 'dark' ? '#1a1a1a' : '#ffffff'
      );
    }

    // Update Telegram theme
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      if (resolvedTheme === 'dark') {
        tg.setHeaderColor('#1a1a1a');
        tg.setBackgroundColor('#0f0f0f');
      } else {
        tg.setHeaderColor('#ffffff');
        tg.setBackgroundColor('#f5f5f5');
      }
    }
  }, [theme, systemTheme]);

  // Set theme and save to localStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Toggle between light and dark (skip auto)
  const toggleTheme = () => {
    const resolvedTheme = theme === 'auto' ? systemTheme : theme;
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const resolvedTheme = theme === 'auto' ? systemTheme : theme;

  return {
    theme,
    setTheme,
    toggleTheme,
    systemTheme,
    resolvedTheme
  };
}

// CSS custom properties for theme colors
export const themeColors = {
  light: {
    // Background colors
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f5f5f5',
    '--bg-tertiary': '#e5e5e5',
    
    // Text colors
    '--text-primary': '#1a1a1a',
    '--text-secondary': '#666666',
    '--text-tertiary': '#999999',
    
    // Brand colors
    '--brand-primary': '#0088cc',
    '--brand-secondary': '#006699',
    
    // Status colors
    '--success': '#28a745',
    '--warning': '#ffc107',
    '--error': '#dc3545',
    '--info': '#17a2b8',
    
    // Border colors
    '--border-primary': '#e5e5e5',
    '--border-secondary': '#cccccc',
    
    // Shadow colors
    '--shadow': 'rgba(0, 0, 0, 0.1)'
  },
  dark: {
    // Background colors
    '--bg-primary': '#1a1a1a',
    '--bg-secondary': '#2a2a2a',
    '--bg-tertiary': '#3a3a3a',
    
    // Text colors
    '--text-primary': '#ffffff',
    '--text-secondary': '#b3b3b3',
    '--text-tertiary': '#808080',
    
    // Brand colors
    '--brand-primary': '#0099dd',
    '--brand-secondary': '#0077aa',
    
    // Status colors
    '--success': '#45d65a',
    '--warning': '#ffcc33',
    '--error': '#ff5555',
    '--info': '#33bbdd',
    
    // Border colors
    '--border-primary': '#3a3a3a',
    '--border-secondary': '#4a4a4a',
    
    // Shadow colors
    '--shadow': 'rgba(0, 0, 0, 0.3)'
  }
};
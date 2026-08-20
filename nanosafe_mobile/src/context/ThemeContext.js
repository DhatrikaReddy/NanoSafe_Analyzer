import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Light Mode Colors (matching web app light theme) ─────────────────────────
export const lightColors = {
  primary:        '#0f766e',
  primaryDark:    '#0d9488',
  primaryGlow:    'rgba(15, 118, 110, 0.15)',
  primaryLight:   '#f0fdfa',

  accent:         '#0284c7',
  accentLight:    '#f0f9ff',

  background:     '#f8fafc',
  sidebar:        '#ffffff',
  card:           '#ffffff',
  cardHover:      '#fbfdff',
  inputBg:        '#f8fafc',
  hover:          '#f1f5f9',

  text:           '#0f172a',
  textSecondary:  '#64748b',
  textMuted:      '#94a3b8',

  border:         '#e2e8f0',
  borderInput:    '#cbd5e1',
  borderFocus:    '#14b8a6',
  borderSubtle:   'rgba(226, 232, 240, 0.8)',

  safe:           '#059669',
  safeBg:         '#ecfdf5',
  safeBorder:     '#a7f3d0',

  moderate:       '#d97706',
  moderateBg:     '#fffbeb',
  moderateBorder: '#fde68a',

  danger:         '#dc2626',
  dangerBg:       '#fef2f2',
  dangerBorder:   '#fecaca',

  info:           '#0284c7',
  infoBg:         '#f0f9ff',

  // Legacy aliases
  primaryLight:   '#0d9488',
  textMain:       '#0f172a',
  surface:        '#ffffff',
  subtle:         'rgba(226, 232, 240, 0.8)',
};

// ─── Dark Mode Colors (matching web app dark theme) ────────────────────────────
export const darkColors = {
  primary:        '#14b8a6',
  primaryDark:    '#2dd4bf',
  primaryGlow:    'rgba(20, 184, 166, 0.2)',
  primaryLight:   'rgba(20, 184, 166, 0.12)',

  accent:         '#38bdf8',
  accentLight:    'rgba(56, 189, 248, 0.12)',

  background:     '#090d16',
  sidebar:        '#0f172a',
  card:           '#131d31',
  cardHover:      '#18243c',
  inputBg:        '#1e293b',
  hover:          '#1e293b',

  text:           '#f8fafc',
  textSecondary:  '#94a3b8',
  textMuted:      '#64748b',

  border:         '#1e293b',
  borderInput:    '#334155',
  borderFocus:    '#14b8a6',
  borderSubtle:   'rgba(255, 255, 255, 0.08)',

  safe:           '#34d399',
  safeBg:         'rgba(5, 150, 105, 0.15)',
  safeBorder:     'rgba(52, 211, 153, 0.3)',

  moderate:       '#fbbf24',
  moderateBg:     'rgba(217, 119, 6, 0.15)',
  moderateBorder: 'rgba(251, 191, 36, 0.3)',

  danger:         '#f87171',
  dangerBg:       'rgba(220, 38, 38, 0.15)',
  dangerBorder:   'rgba(248, 113, 113, 0.3)',

  info:           '#38bdf8',
  infoBg:         'rgba(56, 189, 248, 0.12)',

  // Legacy aliases
  primaryLight:   '#2dd4bf',
  textMain:       '#f8fafc',
  surface:        '#131d31',
  subtle:         'rgba(255, 255, 255, 0.08)',
};

const THEME_STORAGE_KEY = 'nanosafe_theme_mode';

export const ThemeContext = createContext({
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved !== null) setIsDark(saved === 'dark');
    });
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? darkColors : lightColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Convenience hook */
export function useTheme() {
  return useContext(ThemeContext);
}

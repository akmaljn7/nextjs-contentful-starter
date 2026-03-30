// Adlinka Brand Colors
export const Colors = {
  // Primary Colors
  primary: '#0d1b2a',
  primaryLight: '#1b3a5c',
  primaryDark: '#080f16',
  
  // Accent Colors
  accent: '#ff6b35',
  accentLight: '#ff8c5a',
  accentDark: '#e55a2b',
  
  // Brand Gold/Orange
  gold: '#c4a35a',
  
  // Neutral Colors
  white: '#ffffff',
  black: '#000000',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  
  // Semantic Colors
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  error: '#ef4444',
  errorLight: '#fee2e2',
  info: '#3b82f6',
  infoLight: '#dbeafe',
  
  // Background Colors - Cream/Beige like website
  background: '#f5f0e8',
  backgroundGradientStart: '#f5f0e8',
  backgroundGradientEnd: '#ebe5db',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  
  // Text Colors
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  textInverse: '#ffffff',
  
  // Border Colors
  border: '#e5e7eb',
  borderFocus: '#ff6b35',
  
  // Status Colors
  statusPending: '#f59e0b',
  statusConfirmed: '#3b82f6',
  statusInProgress: '#8b5cf6',
  statusCompleted: '#10b981',
  statusCancelled: '#ef4444',
};

// Light Theme
export const LightTheme = {
  ...Colors,
  background: '#f9fafb',
  surface: '#ffffff',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
};

// Dark Theme
export const DarkTheme = {
  ...Colors,
  background: '#0d1b2a',
  surface: '#1b3a5c',
  textPrimary: '#ffffff',
  textSecondary: '#9ca3af',
  border: '#374151',
};

// Dark Mode Colors (full version for ThemeContext)
export const DarkColors = {
  // Primary brand colors remain the same
  primary: '#1a3a5c',
  accent: '#c4a35a',

  // Backgrounds - dark versions
  background: '#0d1b2a',
  surface: '#1b3a5c',
  card: '#1b3a5c',
  white: '#1b3a5c',

  // Text colors - inverted
  textPrimary: '#ffffff',
  textSecondary: '#b0b0b0',
  textMuted: '#707070',
  textInverse: '#0d1b2a',

  // Status colors remain the same
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Border - darker
  border: '#374151',

  // Grayscale - inverted
  gray: {
    50: '#1a1a1a',
    100: '#2a2a2a',
    200: '#3a3a3a',
    300: '#4a4a4a',
    400: '#5a5a5a',
    500: '#6a6a6a',
    600: '#7a7a7a',
    700: '#8a8a8a',
    800: '#9a9a9a',
    900: '#aaaaaa',
  },
};

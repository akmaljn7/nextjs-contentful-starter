// Lightban Brand Colors
export const Colors = {
  // Primary Colors
  primary: '#0d1b2a',
  primaryLight: '#1b3a5c',
  primaryDark: '#080f16',
  
  // Accent Colors
  accent: '#ff6b35',
  accentLight: '#ff8c5a',
  accentDark: '#e55a2b',
  
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
  
  // Background Colors
  background: '#f9fafb',
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

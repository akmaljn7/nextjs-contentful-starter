import { Platform } from 'react-native';

export const Fonts = {
  // Font Families
  family: {
    regular: Platform.select({
      ios: 'System',
      android: 'Roboto',
    }),
    medium: Platform.select({
      ios: 'System',
      android: 'Roboto',
    }),
    bold: Platform.select({
      ios: 'System',
      android: 'Roboto',
    }),
  },
  
  // Font Sizes
  size: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  
  // Font Weights
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// Typography Presets
export const Typography = {
  h1: {
    fontSize: Fonts.size['4xl'],
    fontWeight: Fonts.weight.bold,
    lineHeight: Fonts.size['4xl'] * Fonts.lineHeight.tight,
  },
  h2: {
    fontSize: Fonts.size['3xl'],
    fontWeight: Fonts.weight.bold,
    lineHeight: Fonts.size['3xl'] * Fonts.lineHeight.tight,
  },
  h3: {
    fontSize: Fonts.size['2xl'],
    fontWeight: Fonts.weight.semibold,
    lineHeight: Fonts.size['2xl'] * Fonts.lineHeight.tight,
  },
  h4: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.semibold,
    lineHeight: Fonts.size.xl * Fonts.lineHeight.tight,
  },
  body: {
    fontSize: Fonts.size.base,
    fontWeight: Fonts.weight.regular,
    lineHeight: Fonts.size.base * Fonts.lineHeight.normal,
  },
  bodyLarge: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.regular,
    lineHeight: Fonts.size.md * Fonts.lineHeight.normal,
  },
  caption: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.regular,
    lineHeight: Fonts.size.sm * Fonts.lineHeight.normal,
  },
  button: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    lineHeight: Fonts.size.md * Fonts.lineHeight.tight,
  },
};

/**
 * Design tokens — mirror the web dashboard's dark aesthetic.
 * Green (#10b981) accents on near-black backgrounds with generous spacing.
 */
export const colors = {
  bg: "#0a0a0a",
  surface: "#121212",
  surface2: "#1a1a1a",
  border: "rgba(255,255,255,0.08)",
  borderHi: "rgba(255,255,255,0.16)",

  text: "#ffffff",
  textDim: "#a3a3a3",
  textMute: "#6b7280",

  green: "#10b981",
  greenSoft: "rgba(16,185,129,0.12)",
  amber: "#f59e0b",
  amberSoft: "rgba(245,158,11,0.12)",
  red: "#ef4444",
  redSoft: "rgba(239,68,68,0.12)",
  blue: "#3b82f6",
  blueSoft: "rgba(59,130,246,0.12)",
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, "3xl": 32, "4xl": 48,
} as const;

export const radius = { none: 0, sm: 4, md: 8, lg: 12, xl: 16, pill: 999 } as const;

export const fonts = {
  // System fonts — no custom font shipping in Phase 1
  regular: undefined,
  medium: undefined,
  bold: undefined,
  mono: "Menlo",
} as const;

export const sizes = {
  h1: 32, h2: 24, h3: 20, body: 15, small: 13, tiny: 11,
} as const;

export const STATUS_COLORS = {
  active: colors.green,
  paused: colors.amber,
  completed: colors.blue,
  expired: colors.red,
  reset: colors.textMute,
  logout: colors.textMute,
} as const;

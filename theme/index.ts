/**
 * AETHER Design System — Warm Parchment Theme
 *
 * Ported from the web prototype's design tokens.
 * Warm, earthy palette with bold emergency accents.
 */

export const Colors = {
  // ── Backgrounds ──────────────────────────────────────────────
  background: {
    primary: '#F7F5F0',           // Warm parchment — main canvas
    secondary: '#EDEAE3',         // Slightly deeper parchment
    tertiary: '#E5E2D9',          // Border-level grey
    elevated: '#FFFFFF',          // Cards, sheets — pure white
    grouped: '#F7F5F0',           // Grouped list backgrounds
  },

  // ── Labels ───────────────────────────────────────────────────
  label: {
    primary: '#141210',           // Near-black ink
    secondary: '#706D65',         // Secondary ink
    tertiary: '#ADAAA2',          // Muted ink
    muted: '#D0CEC7',            // Faintest ink
    inverse: '#FFFFFF',
    emergency: '#EF3E28',
  },

  // ── Text (backward compat alias) ─────────────────────────────
  text: {
    primary: '#141210',
    secondary: '#706D65',
    muted: '#ADAAA2',
    inverse: '#FFFFFF',
    emergency: '#EF3E28',
  },

  // ── Brand ────────────────────────────────────────────────────
  brand: {
    primary: '#EF3E28',          // AETHER Red — emergency, SOS
    primaryDeep: '#C82F1C',      // Deeper red for shadows/press
    secondary: '#C05C0A',        // Amber — fire, warnings
    accent: '#1648D0',           // Blue — actions, police
    gold: '#C05C0A',             // Amber (alias)
    success: '#0E8C56',          // Green — safe, online
    purple: '#6B35CC',           // Purple — spine/special
  },

  // ── System Colors ────────────────────────────────────────────
  status: {
    success: '#0E8C56',
    warning: '#C05C0A',
    danger: '#EF3E28',
    info: '#1648D0',
    neutral: '#ADAAA2',
  },

  // ── Soft backgrounds (for tags, badges, cards) ────────────────
  soft: {
    red: '#FEF1EE',
    redBorder: '#F4C5BE',
    green: '#E8F6EF',
    greenBorder: '#96D4B4',
    blue: '#EBF0FC',
    blueBorder: '#A8BEE8',
    amber: '#FEF4E6',
    amberBorder: '#E8C088',
    purple: '#F4EFFE',
    purpleBorder: '#C8A8EE',
    heart: '#FEE8F0',
    heartBorder: '#F4B0CC',
  },

  // ── Emergency Service Tints ───────────────────────────────────
  tint: {
    police: '#EBF0FC',
    ambulance: '#FEF1EE',
    fire: '#FEF4E6',
    universal: '#E8F6EF',
    hospital: '#FEF1EE',
    towing: '#FEF4E6',
    puncture: '#E8F6EF',
    petrol: '#F4EFFE',
  },

  // ── Emergency Service Colors ──────────────────────────────────
  service: {
    police: '#1648D0',
    ambulance: '#EF3E28',
    fire: '#C05C0A',
    universal: '#0E8C56',
    hospital: '#EF3E28',
    towing: '#C05C0A',
    puncture: '#0E8C56',
    petrol: '#6B35CC',
  },

  // ── Fills ────────────────────────────────────────────────────
  fill: {
    primary: 'rgba(112, 109, 101, 0.20)',
    secondary: 'rgba(112, 109, 101, 0.12)',
    tertiary: 'rgba(112, 109, 101, 0.08)',
    quaternary: 'rgba(112, 109, 101, 0.04)',
  },

  // ── Separators ───────────────────────────────────────────────
  separator: {
    opaque: '#E5E2D9',
    nonOpaque: '#EDEAE3',
  },

  // ── Borders ──────────────────────────────────────────────────
  border: {
    subtle: '#EDEAE3',
    medium: '#E5E2D9',
    strong: '#D0CEC7',
  },

  // ── Overlays ─────────────────────────────────────────────────
  overlay: {
    light: 'rgba(20, 18, 16, 0.04)',
    medium: 'rgba(20, 18, 16, 0.08)',
    dark: 'rgba(20, 18, 16, 0.45)',
    emergency: 'rgba(239, 62, 40, 0.08)',
  },
};

export const Typography = {
  size: {
    xs: 9,            // Micro labels
    sm: 11,           // Tags, badges
    md: 13,           // Body small
    lg: 14,           // Body
    xl: 20,           // Section title
    '2xl': 24,        // Screen title
    '3xl': 30,        // Brand title
    '4xl': 38,        // Large display numbers
    '5xl': 42,        // Hero numbers
  },

  weight: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
    black: '900' as const,
  },

  lineHeight: {
    tight: 1.0,
    normal: 1.3,
    relaxed: 1.5,
  },

  tracking: {
    tight: -0.5,
    display: -1.0,
    normal: 0,
    wide: 0.5,
    wider: 1.5,
    widest: 2.5,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 26,
  '3xl': 36,
  full: 9999,
};

export const Shadows = {
  xs: {
    shadowColor: '#141210',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: '#141210',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#141210',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  lg: {
    shadowColor: '#141210',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  nav: {
    shadowColor: '#141210',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 8,
  },
  emergency: {
    shadowColor: '#EF3E28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 18,
    elevation: 14,
  },
  // Red "pressed" depth shadow (prototype's 0 4px 0 #C82F1C)
  emergencyDepth: {
    shadowColor: '#C82F1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
};

export const Layout = {
  TAB_BAR_HEIGHT: 82,
  TAB_BAR_BOTTOM_MARGIN: 0,
  CONTENT_BOTTOM_PADDING: 100,
  HORIZONTAL_PADDING: 22,
  STATUS_BAR_HEIGHT: 56,
};

const Theme = {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Layout,
};

export default Theme;
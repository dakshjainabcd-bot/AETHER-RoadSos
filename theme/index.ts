/**
 * AETHER Design System — Premium iOS Light Theme
 *
 * Designed to match Apple's Human Interface Guidelines.
 * White primary, SF Pro typography, iOS system colors.
 */

export const Colors = {
  // ── Backgrounds ──────────────────────────────────────────────
  background: {
    primary: '#FFFFFF',          // Pure white — main canvas
    secondary: '#F2F2F7',        // iOS grouped background (gray-6)
    tertiary: '#EFEFF4',         // Deeper grouped background
    elevated: '#FFFFFF',         // Cards, sheets
    grouped: '#F2F2F7',          // Grouped list backgrounds
  },

  // ── Labels (iOS naming convention) ──────────────────────────
  label: {
    primary: '#000000',
    secondary: 'rgba(60, 60, 67, 0.6)',
    tertiary: 'rgba(60, 60, 67, 0.3)',
    muted: 'rgba(60, 60, 67, 0.45)',
    inverse: '#FFFFFF',
    emergency: '#FF3B30',
  },

  // ── Text (backward compat alias) ─────────────────────────────
  text: {
    primary: '#000000',
    secondary: 'rgba(60, 60, 67, 0.6)',
    muted: 'rgba(60, 60, 67, 0.45)',
    inverse: '#FFFFFF',
    emergency: '#FF3B30',
  },

  // ── Brand ────────────────────────────────────────────────────
  brand: {
    primary: '#FF3B30',          // iOS Red — emergency, SOS
    secondary: '#FF6B35',        // Warm orange
    accent: '#007AFF',           // iOS Blue — actions, links
    gold: '#FF9500',             // iOS Orange — rewards
    success: '#34C759',          // iOS Green
    purple: '#5856D6',           // iOS Purple — police
  },

  // ── System Colors (iOS palette) ──────────────────────────────
  status: {
    success: '#34C759',
    warning: '#FF9500',
    danger: '#FF3B30',
    info: '#007AFF',
    neutral: '#8E8E93',
  },

  // ── Emergency Service Tints ───────────────────────────────────
  // Pastel backgrounds for the emergency number cards
  tint: {
    police: '#EBF3FF',            // Light blue
    ambulance: '#FFEDEC',         // Light red
    fire: '#FFF5E6',              // Light orange
    universal: '#EDFAF3',         // Light green
    hospital: '#FFEDEC',
    towing: '#FFF5E6',
    puncture: '#EDFAF3',
    petrol: '#F0EEFF',
  },

  // ── Emergency Service Colors ──────────────────────────────────
  service: {
    police: '#007AFF',
    ambulance: '#FF3B30',
    fire: '#FF9500',
    universal: '#34C759',
    hospital: '#FF3B30',
    towing: '#FF9500',
    puncture: '#34C759',
    petrol: '#5856D6',
  },

  // ── Fills (iOS fill system) ──────────────────────────────────
  fill: {
    primary: 'rgba(120, 120, 128, 0.2)',
    secondary: 'rgba(120, 120, 128, 0.16)',
    tertiary: 'rgba(118, 118, 128, 0.12)',
    quaternary: 'rgba(116, 116, 128, 0.08)',
  },

  // ── Separators ───────────────────────────────────────────────
  separator: {
    opaque: '#C6C6C8',
    nonOpaque: 'rgba(60, 60, 67, 0.29)',
  },

  // ── Borders ──────────────────────────────────────────────────
  border: {
    subtle: 'rgba(60, 60, 67, 0.10)',
    medium: 'rgba(60, 60, 67, 0.18)',
    strong: 'rgba(60, 60, 67, 0.30)',
  },

  // ── Overlays ─────────────────────────────────────────────────
  overlay: {
    light: 'rgba(0,0,0,0.04)',
    medium: 'rgba(0,0,0,0.08)',
    dark: 'rgba(0,0,0,0.45)',
    emergency: 'rgba(255, 59, 48, 0.08)',
  },
};

export const Typography = {
  // iOS Text Styles — matching Apple's HIG type scale
  size: {
    xs: 11,           // Caption 2
    sm: 13,           // Footnote
    md: 15,           // Subheadline
    lg: 17,           // Body / Headline
    xl: 20,           // Title 3
    '2xl': 22,        // Title 2
    '3xl': 28,        // Title 1
    '4xl': 34,        // Large Title
    '5xl': 40,        // Display
  },

  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
    black: '900' as const,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },

  // Letter spacing values (converted to letterSpacing for RN)
  tracking: {
    tight: -0.5,
    display: -0.4,   // For large titles — Apple uses tight tracking
    normal: 0,
    wide: 0.5,
    wider: 1,
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
  '2xl': 28,
  '3xl': 36,
  full: 9999,
};

export const Shadows = {
  // Very subtle, iOS-style shadows
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 28,
    elevation: 12,
  },
  // Navigation bar floating shadow
  nav: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 20,
  },
  // SOS button glow
  emergency: {
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 14,
  },
};

// Bottom tab bar dimensions — used across all screens for padding
export const Layout = {
  TAB_BAR_HEIGHT: 72,
  TAB_BAR_BOTTOM_MARGIN: 24,
  CONTENT_BOTTOM_PADDING: 116, // TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_MARGIN + 20
  HORIZONTAL_PADDING: 20,
  STATUS_BAR_HEIGHT: 52,
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
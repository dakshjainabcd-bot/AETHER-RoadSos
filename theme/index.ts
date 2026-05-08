/**
 * AETHER Design System
 *
 * WHY: Instead of hardcoding colors/sizes everywhere, we define them once here.
 * If we want to change the red color of the SOS button, we change it in ONE place
 * and it updates across the entire app automatically.
 *
 * Think of this as the "style rulebook" for the whole app.
 */

export const Colors = {
  // Background colors — the app uses a dark theme (easier to read in bright sunlight / emergencies)
  background: {
    primary: '#0A0A0A',    // Main screen background (near black)
    secondary: '#141414',  // Card/panel background
    tertiary: '#1E1E1E',   // Input fields, secondary panels
    elevated: '#242424',   // Modals, dropdowns
  },

  // Brand colors — the "AETHER look"
  brand: {
    primary: '#FF3B30',    // Emergency red — SOS button, alerts
    secondary: '#FF6B35',  // Warning orange — bystander screens
    accent: '#00D4FF',     // Electric cyan — status indicators, links
    gold: '#FFD700',       // Reward yellow — Good Samaritan reward badge
  },

  // Status colors — tell the user what's happening
  status: {
    success: '#34C759',    // Green — GPS locked, signal good
    warning: '#FF9500',    // Orange — GPS weak, mesh relay
    danger: '#FF3B30',     // Red — crash detected, SOS active
    info: '#00D4FF',       // Cyan — informational
    neutral: '#8E8E93',    // Grey — inactive
  },

  // Text colors
  text: {
    primary: '#FFFFFF',    // Main text — white on dark background
    secondary: '#EBEBF5',  // Subtitles, descriptions
    muted: '#8E8E93',      // Timestamps, metadata
    inverse: '#000000',    // Text on light backgrounds
    emergency: '#FF3B30',  // Emergency call numbers
  },

  // Border/divider colors
  border: {
    subtle: '#2C2C2E',     // Card borders
    medium: '#3A3A3C',     // Input borders
    strong: '#636366',     // Active/focused borders
  },

  // Transparent overlays
  overlay: {
    light: 'rgba(255,255,255,0.05)',
    medium: 'rgba(255,255,255,0.10)',
    dark: 'rgba(0,0,0,0.7)',
    emergency: 'rgba(255,59,48,0.15)',
  },
};

export const Typography = {
  // Font sizes — following a clear hierarchy
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },

  // Font weights
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const Spacing = {
  // Consistent spacing scale — everything is a multiple of 4px
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
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 28,
  full: 9999,
};

export const Shadows = {
  // Box shadows for cards and elevated elements
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  emergency: {
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
};

// The complete theme object — import this wherever you need styling
const Theme = {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
};

export default Theme;

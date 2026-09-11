/**
 * App-wide Theme and Semantic Color Palette for SmileGuard Doctor Mobile.
 * Accentuated with clinic Mint Green branding and Neumorphic surface definitions.
 */

import { Platform } from 'react-native';

const mintPrimary = '#10B981'; // Clinic Mint Green
const mintDark = '#047857';
const mintLight = '#A7F3D0';
const mintSurface = '#E6ECEF'; // Neumorphic base surface

export const Colors = {
  light: {
    text: '#0F172A',
    background: mintSurface,
    tint: mintPrimary,
    icon: '#64748B',
    tabIconDefault: '#64748B',
    tabIconSelected: mintPrimary,
  },
  dark: {
    text: '#F8FAFC',
    background: '#131D24',
    tint: mintLight,
    icon: '#94A3B8',
    tabIconDefault: '#94A3B8',
    tabIconSelected: mintLight,
  },
};

export const AppColors = {
  // Brand - Mint Green Clinic Identity
  primary: mintPrimary,
  primaryDark: mintDark,
  primaryLight: mintLight,
  secondary: '#1E293B',

  // Neumorphism Colors
  neuBase: '#E6ECEF',
  neuLightShadow: '#FFFFFF',
  neuDarkShadow: '#B0BAC5',
  neuBorder: 'rgba(255, 255, 255, 0.85)',
  neuInsetDark: '#CBD5E1',

  // Semantic
  danger: '#EF4444',
  dangerLight: '#F87171',
  success: '#10B981',
  successBg: '#ECFDF5',
  warningBg: '#FEF9C3',

  // AI / Diagnostic
  ai: '#0D9488',
  aiDark: '#0F766E',
  aiBg: '#F0FDFA',
  aiAccent: '#2DD4BF',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textLight: '#94A3B8',

  // Backgrounds
  background: '#E6ECEF',
  backgroundAlt: '#FFFFFF',
  backgroundLight: '#ECFDF5',
  backgroundScreen: '#E6ECEF',

  // Borders - Crisp and defined (avoiding soft bordering)
  border: '#CBD5E1',
  borderLight: '#E2E8F0',
  borderAccent: '#10B981',

  // Input
  inputBg: '#DDE4E8',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

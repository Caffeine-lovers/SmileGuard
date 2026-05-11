/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0b7fab';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

/**
 * App-wide semantic color palette.
 * Use these instead of hardcoded hex values in components.
 */
export const AppColors = {
  // Brand
  primary: '#0b7fab',
  primaryDark: '#065f83',
  secondary: '#1e293b',

  // Semantic
  danger: '#ef4444',
  dangerLight: '#f87171',
  success: '#4ade80',
  successBg: '#dcfce7',
  warningBg: '#fef9c3',

  // AI / Diagnostic
  ai: '#6366f1',
  aiDark: '#4338ca',
  aiBg: '#f5f3ff',
  aiAccent: '#22d3ee',

  // Text
  textPrimary: '#0f172a',
  textSecondary: '#4b5563',
  textMuted: '#6b7280',
  textLight: '#64748b',

  // Backgrounds
  background: '#ffffff',
  backgroundAlt: '#f9fafb',
  backgroundLight: '#f0f9ff',
  backgroundScreen: '#f8fafc',

  // Borders
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  borderAccent: '#2bf1ff7d',

  // Input
  inputBg: '#f3f4f6',
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
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

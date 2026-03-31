/**
 * SmileGuard MD — Design System Tokens
 * Derived from Quick Actions screen audit, March 2026
 */

export const theme = {
  // Brand Colors
  colors: {
    // Brand
    'brand-primary': '#3DAAB8',
    'brand-cyan': '#29ABE2',
    'brand-danger': '#F05454',

    // Surface & Background
    'bg-screen': '#D9EDF8',
    'bg-surface': '#FFFFFF',
    'bg-notes': '#F2F8FB',
    'bg-avatar-initials': '#3DAAB8',

    // Text
    'text-primary': '#1C1C1E',
    'text-secondary': '#6B7280',
    'text-link': '#3DAAB8',
    'text-on-danger': '#FFFFFF',
    'text-on-avatar': '#FFFFFF',

    // Borders & Dividers
    'border-card': '#E5E7EB',
    'border-active': '#F05454',
  },

  // Typography
  typography: {
    appName: {
      fontSize: 18,
      fontWeight: '700',
      color: '#3DAAB8',
    },
    screenHeading: {
      fontSize: 22,
      fontWeight: '800',
      color: '#29ABE2',
    },
    sectionLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: '#1C1C1E',
    },
    sectionAction: {
      fontSize: 13,
      fontWeight: '400',
      color: '#3DAAB8',
    },
    cardPatientName: {
      fontSize: 18,
      fontWeight: '700',
      color: '#1C1C1E',
    },
    cardDetailLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: '#1C1C1E',
    },
    cardDetailValue: {
      fontSize: 13,
      fontWeight: '400',
      color: '#1C1C1E',
    },
    listItemName: {
      fontSize: 15,
      fontWeight: '600',
      color: '#1C1C1E',
    },
    listItemSubtitle: {
      fontSize: 13,
      fontWeight: '400',
      color: '#6B7280',
    },
    badgeLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    buttonLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    notesText: {
      fontSize: 13,
      fontWeight: '400',
      color: '#1C1C1E',
    },
  },

  // Spacing & Layout
  spacing: {
    screenHorizontalPadding: 16,
    sectionVerticalGap: 20,
    cardInternalPadding: 16,
    cardBorderRadius: 12,
    avatarBorderRadius: 50, // full circle
    badgeBorderRadius: 20,
    buttonBorderRadius: 20,
    listItemMinHeight: 64,
  },

  // Shadows
  shadows: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
  },

  // Status Badge Colors
  statusBadges: {
    upcoming: '#F05454',
    confirmed: '#22C55E',
    completed: '#6B7280',
    cancelled: '#EF4444',
  },
} as const;

export type Theme = typeof theme;

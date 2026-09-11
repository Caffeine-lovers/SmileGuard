const { heroui } = require("@heroui/react");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Mint Green Clinic Brand Identity
        'brand-primary': '#10B981',
        'brand-mint': '#10B981',
        'brand-mint-dark': '#047857',
        'brand-mint-light': '#ECFDF5',
        'brand-cyan': '#0D9488',
        'brand-danger': '#EF4444',
        'bg-screen': '#F4F7F6',
        'bg-surface': '#FFFFFF',
        'bg-notes': '#F0FDF4',
        'bg-avatar-initials': '#047857',
        'text-primary': '#0F172A',
        'text-secondary': '#475569',
        'text-link': '#047857',
        'text-on-danger': '#FFFFFF',
        'text-on-avatar': '#FFFFFF',
        'border-card': '#CBD5E1',
        'border-active': '#10B981',
        'border-crisp': '#94A3B8',
      },
      borderRadius: {
        'none': '0px',
        'xs': '2px',
        'sm': '3px',
        'md': '4px',
        'card': '4px',
      },
      boxShadow: {
        'skeuo-card': 'inset 0 1px 0 #FFFFFF, 0 1px 3px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)',
        'skeuo-btn': 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 0 #065F46, 0 3px 6px rgba(0,0,0,0.15)',
        'skeuo-input': 'inset 0 2px 4px rgba(0,0,0,0.06)',
        'skeuo-bevel': 'inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.1)',
      }
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              DEFAULT: '#10B981',
              foreground: '#FFFFFF',
            },
            focus: '#10B981',
          },
        },
      },
    }),
  ],
};

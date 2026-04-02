module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#3DAAB8',
        'brand-cyan': '#29ABE2',
        'brand-danger': '#F05454',
        'bg-screen': '#D9EDF8',
        'bg-surface': '#FFFFFF',
        'bg-notes': '#F2F8FB',
        'bg-avatar-initials': '#3DAAB8',
        'text-primary': '#1C1C1E',
        'text-secondary': '#6B7280',
        'text-link': '#3DAAB8',
        'text-on-danger': '#FFFFFF',
        'text-on-avatar': '#FFFFFF',
        'border-card': '#E5E7EB',
        'border-active': '#F05454',
      },
      borderRadius: {
        'card': '12px',
        'pill': '20px',
      }
    },
  },
  plugins: [],
};

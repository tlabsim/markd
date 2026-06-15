/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'md-bg': {
          DEFAULT: '#ffffff',
          dark: 'hsl(212, 18%, 16%)',
        },
        'md-surface': {
          DEFAULT: '#f6f8fa',
          dark: 'hsl(212, 18%, 13%)',
        },
        'md-border': {
          DEFAULT: '#d0d7de',
          dark: 'hsl(212, 12%, 25%)',
        },
        'md-text': {
          DEFAULT: '#1f2328',
          dark: 'hsl(212, 20%, 85%)',
        },
        'md-muted': {
          DEFAULT: '#656d76',
          dark: 'hsl(212, 12%, 55%)',
        },
        'md-accent': {
          DEFAULT: '#0969da',
          dark: '#58a6ff',
        },
        'md-green': {
          DEFAULT: '#1a7f37',
          dark: '#3fb950',
        },
        'md-orange': {
          DEFAULT: '#bf8700',
          dark: '#d29922',
        },
        'md-purple': {
          DEFAULT: '#8250df',
          dark: '#bc8cff',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
          },
        },
      },
    },
  },
  plugins: [],
};

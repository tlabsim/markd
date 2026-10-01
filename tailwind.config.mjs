/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'md-bg': {
          DEFAULT: '#ffffff',
          dark: '#292d35',
        },
        'md-surface': {
          DEFAULT: '#f6f8fa',
          dark: '#202329',
        },
        'md-border': {
          DEFAULT: '#d0d7de',
          dark: '#424952',
        },
        'md-text': {
          DEFAULT: '#1f2328',
          dark: '#dbe1e7',
        },
        'md-muted': {
          DEFAULT: '#656d76',
          dark: '#a4adb7',
        },
        'md-accent': {
          DEFAULT: '#0969da',
          dark: '#aab5c4',
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

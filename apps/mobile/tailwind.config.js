/** @type {import('tailwindcss').Config} */
// Palette mirrors client/src/style.css .dark — white primary, cyan accent.
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0b0d12',
        surface: '#171b23',
        surfaceMuted: '#232936',
        border: '#303847',
        primary: '#f3f5fa',
        'primary-foreground': '#071b28',
        accent: '#38bdf8',
        'accent-muted': '#70d5ff',
        foreground: '#f3f5fa',
        muted: '#acb6c9',
        destructive: '#ff8d9a',
        success: '#7dddb0',
        warning: '#f59e0b',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
// Palette mirrors the desktop client theme (client/src/style.css .dark tokens).
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0b',
        surface: '#141416',
        surfaceMuted: '#18181b',
        border: '#1f1f23',
        primary: '#0ea5e9',
        'primary-foreground': '#000000',
        foreground: '#fafafa',
        muted: '#71717a',
        destructive: '#ef4444',
        success: '#22c55e',
        warning: '#f59e0b',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
    },
  },
  plugins: [],
};

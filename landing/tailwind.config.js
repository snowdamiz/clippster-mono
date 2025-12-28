/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(240 4% 16%)",
        background: "hsl(240 10% 4%)",
        foreground: "hsl(0 0% 98%)",
        muted: {
          DEFAULT: "hsl(240 4% 12%)",
          foreground: "hsl(240 5% 50%)",
        },
        card: {
          DEFAULT: "hsl(240 6% 7%)",
          foreground: "hsl(0 0% 98%)",
        },
        accent: {
          DEFAULT: "hsl(265 90% 60%)",
          light: "hsl(265 90% 70%)",
          muted: "hsl(265 50% 15%)",
        },
        cyan: {
          DEFAULT: "hsl(185 90% 50%)",
          light: "hsl(185 90% 60%)",
          muted: "hsl(185 50% 15%)",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-white': 'linear-gradient(to right, rgb(255 255 255 / 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '64px 64px',
      },
    },
  },
  plugins: [],
}

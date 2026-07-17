// Mirrors the desktop client theme (client/src/style.css .dark tokens).
// Keep in sync with tailwind.config.js.
export const tokens = {
  colors: {
    background: '#0a0a0b',
    surface: '#141416',
    surfaceMuted: '#18181b',
    border: '#1f1f23',
    primary: '#0ea5e9',
    primaryMuted: '#0891b2',
    accent: '#06b6d4',
    foreground: '#fafafa',
    muted: '#71717a',
    destructive: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
  },
  radii: {
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
  },
} as const;

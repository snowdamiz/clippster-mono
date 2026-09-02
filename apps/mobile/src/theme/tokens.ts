// Mirrors the desktop client dark theme (client/src/style.css .dark).
// Primary = near-white buttons; accent = cyan highlights (sidebar-accent).
export const tokens = {
  colors: {
    background: '#0a0a0b',
    surface: '#141416',
    surfaceMuted: '#18181b',
    border: '#1f1f23',
    primary: '#fafafa',
    primaryForeground: '#18181b',
    accent: '#0ea5e9',
    accentMuted: '#0891b2',
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

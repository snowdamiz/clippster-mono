// Mirrors the desktop client dark theme (client/src/style.css .dark).
// Primary = near-white buttons; accent = cyan highlights (sidebar-accent).
export const tokens = {
  colors: {
    background: '#0b0d12',
    surface: '#171b23',
    surfaceMuted: '#232936',
    border: '#303847',
    primary: '#f3f5fa',
    primaryForeground: '#071b28',
    accent: '#38bdf8',
    accentMuted: '#70d5ff',
    foreground: '#f3f5fa',
    muted: '#acb6c9',
    destructive: '#ff8d9a',
    success: '#7dddb0',
    warning: '#f59e0b',
  },
  radii: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
  },
} as const;

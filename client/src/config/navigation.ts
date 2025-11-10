export interface NavigationItem {
  name: string;
  path: string;
  icon: string;
  category?: string;
  disabled?: boolean;
  badge?: string;
  useImage?: boolean;
  adminOnly?: boolean;
  action?: 'dialog'; // New property to handle dialog actions instead of routing
}

export const navigationItems: NavigationItem[] = [
  {
    name: 'Projects',
    path: '/projects',
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  },
  {
    name: 'Raw Videos',
    path: '/videos',
    icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  },
  {
    name: 'Clips',
    path: '/clips',
    icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4',
  },
  {
    name: 'Prompts',
    path: '/prompts',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z',
  },
  {
    name: 'Admin',
    path: '/admin',
    icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
    adminOnly: true,
  },
  {
    name: 'PumpFun',
    path: '/pumpfun',
    icon: 'M8.434 20.566c1.335 0 2.591-.52 3.535-1.464l7.134-7.133a5.008 5.008 0 0 0-.001-7.072 4.969 4.969 0 0 0-3.536-1.463c-1.335 0-2.59.52-3.534 1.464l-7.134 7.133a5.01 5.01 0 0 0-.001 7.072 4.971 4.971 0 0 0 3.537 1.463zm5.011-14.254a2.979 2.979 0 0 1 2.12-.878c.802 0 1.556.312 2.122.878a3.004 3.004 0 0 1 .001 4.243l-2.893 2.892-4.242-4.244 2.892-2.891z',
    category: 'Stream Vods',
  },
  {
    name: 'Kick',
    path: '/kick',
    icon: '/kick.svg',
    category: 'Stream Vods',
    useImage: true,
  },
  {
    name: 'Twitch',
    path: '/twitch',
    icon: '/twitch.svg',
    category: 'Stream Vods',
    useImage: true,
  },
  {
    name: 'YouTube',
    path: '/youtube',
    icon: '/youtube.svg',
    category: 'Stream Vods',
    useImage: true,
  },
];

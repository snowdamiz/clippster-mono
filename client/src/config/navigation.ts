export interface NavigationItem {
  name: string
  path: string
  icon: string
}

export const navigationItems: NavigationItem[] = [
  {
    name: 'Projects',
    path: '/dashboard/projects',
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
  },
  {
    name: 'Raw Videos',
    path: '/dashboard/videos',
    icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
  },
  {
    name: 'Clips',
    path: '/dashboard/clips',
    icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4'
  },
  {
    name: 'Prompts',
    path: '/dashboard/prompts',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z'
  }
]

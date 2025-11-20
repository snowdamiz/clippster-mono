import type { Component } from 'vue';
import {
  FolderOpen,
  Video,
  LayoutGrid,
  MessageSquare,
  Bug,
  Settings,
  MoreHorizontal,
  Youtube,
  Twitch,
  Archive,
  Folder,
} from 'lucide-vue-next';

export interface NavigationItem {
  name: string;
  path: string;
  icon: string | Component;
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
    icon: Folder,
  },
  {
    name: 'Raw Videos',
    path: '/videos',
    icon: Video,
  },
  {
    name: 'Assets',
    path: '/assets',
    icon: Archive,
  },
  {
    name: 'Clips',
    path: '/clips',
    icon: LayoutGrid,
  },
  {
    name: 'Prompts',
    path: '/prompts',
    icon: MessageSquare,
  },
  {
    name: 'Bug Report',
    path: '/bug-report',
    icon: Bug,
    action: 'dialog',
  },
  {
    name: 'Admin',
    path: '/admin',
    icon: Settings,
    adminOnly: true,
  },
  {
    name: 'PumpFun',
    path: '/pumpfun',
    icon: '/capsule.svg', // Keep SVG file for PumpFun as it was already using this
    category: 'Stream Vods',
    useImage: true,
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

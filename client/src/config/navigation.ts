import type { Component } from 'vue';
import {
  Video,
  LayoutGrid,
  MessageSquare,
  Bug,
  Settings,
  Archive,
  Folder,
  Radio,
  Users,
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
    name: 'My Clips',
    path: '/clips',
    icon: LayoutGrid,
  },
  {
    name: 'Clip Live',
    path: '/live-clip',
    icon: Radio,
  },
  {
    name: 'Creators',
    path: '/creators',
    icon: Users,
  },
  {
    name: 'Stream VODs',
    path: '/vods',
    icon: Video,
  },
  {
    name: 'Assets',
    path: '/assets',
    icon: Archive,
  },
  {
    name: 'Prompts',
    path: '/prompts',
    icon: MessageSquare,
  },
  {
    name: 'Admin',
    path: '/admin',
    icon: Settings,
    adminOnly: true,
  },
  {
    name: 'Bug Report',
    path: '/bug-report',
    icon: Bug,
    action: 'dialog',
  },
];

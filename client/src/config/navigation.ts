import type { Component } from 'vue';
import {
  Video,
  LayoutGrid,
  MessageSquare,
  MessageCircle,
  Bug,
  Settings,
  Archive,
  Folder,
  Radio,
  Users,
  Clapperboard,
  Building2,
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
  orgOnly?: boolean; // Only show for organization account owners
  orgMember?: boolean; // Show for any organization member
  action?: 'dialog'; // New property to handle dialog actions instead of routing
}

export const navigationItems: NavigationItem[] = [
  {
    name: 'Creators',
    path: '/creators',
    icon: Users,
  },
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
    name: 'Video Editor',
    path: '/video-editor',
    icon: Clapperboard,
  },
  {
    name: 'Live',
    path: '/live-clip',
    icon: Radio,
  },
  {
    name: 'Stream VODs',
    path: '/vods',
    icon: Video,
  },
  {
    name: 'Messages',
    path: '/messages',
    icon: MessageCircle,
    orgMember: true, // Show for any user who is a member of at least one organization
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
    name: 'Organizations',
    path: '/organizations',
    icon: Building2,
    orgMember: true, // Show for any user who is a member of at least one organization
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

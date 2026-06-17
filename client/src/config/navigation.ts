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
  Receipt,
  Megaphone,
  Wand2,
  Handshake,
  CalendarDays,
  Headphones,
  Music,
  Disc,
} from 'lucide-vue-next';

export type NavigationGroup = 'browse' | 'create' | 'studio' | 'manage' | 'system';

export interface NavigationItem {
  name: string;
  path: string;
  icon: string | Component;
  group: NavigationGroup;
  category?: string;
  disabled?: boolean;
  badge?: string;
  useImage?: boolean;
  adminOnly?: boolean;
  orgOnly?: boolean; // Only show for organization account owners
  orgMember?: boolean; // Show for any organization member
  action?: 'dialog'; // New property to handle dialog actions instead of routing
  restrictedHidden?: boolean; // Hide for restricted accounts
  affiliateOnly?: boolean; // Only show for affiliate users
}

export const navigationGroups: Record<NavigationGroup, { label: string; order: number }> = {
  browse: { label: 'Browse', order: 1 },
  create: { label: 'Create', order: 2 },
  studio: { label: 'Studio', order: 3 },
  manage: { label: 'Manage', order: 4 },
  system: { label: '', order: 5 }, // No label for system group
};

export const navigationItems: NavigationItem[] = [
  // Browse group - discovery focused
  {
    name: 'My Creators',
    path: '/creators',
    icon: Users,
    group: 'browse',
    restrictedHidden: true,
  },
  {
    name: 'Live Streams',
    path: '/live-clip',
    icon: Radio,
    group: 'browse',
  },
  {
    name: 'Download Video',
    path: '/vods',
    icon: Video,
    group: 'browse',
  },
  {
    name: 'Download Audio',
    path: '/download-audio',
    icon: Headphones,
    group: 'browse',
  },
  {
    name: 'Messages',
    path: '/messages',
    icon: MessageCircle,
    group: 'browse',
  },
  {
    name: 'Campaigns',
    path: '/campaigns',
    icon: Megaphone,
    group: 'browse',
    restrictedHidden: true,
  },

  // Create group - content creation tools
  {
    name: 'Video Library',
    path: '/projects',
    icon: Folder,
    group: 'create',
  },
  {
    name: 'Audio Library',
    path: '/audio-library',
    icon: Music,
    group: 'create',
  },
  {
    name: 'Built Clips',
    path: '/clips',
    icon: LayoutGrid,
    group: 'create',
  },
  {
    name: 'Video Editor',
    path: '/video-editor',
    icon: Clapperboard,
    group: 'create',
  },
  {
    name: 'AI Video Creator',
    path: '/ai-video',
    icon: Wand2,
    group: 'create',
  },
  {
    name: 'Recording',
    path: '/studio/record',
    icon: Disc,
    group: 'studio',
  },

  // Manage group - organization/settings
  {
    name: 'Organizations',
    path: '/organizations',
    icon: Building2,
    group: 'manage',
    orgMember: true, // Show for any user who is a member of at least one organization
  },
  {
    name: 'Assets',
    path: '/assets',
    icon: Archive,
    group: 'manage',
    restrictedHidden: true, // Hidden if restricted and no asset upload permission
  },
  {
    name: 'Prompts',
    path: '/prompts',
    icon: MessageSquare,
    group: 'manage',
    restrictedHidden: true, // Hidden if restricted and no custom prompts permission
  },
  {
    name: 'Calendar',
    path: '/calendar',
    icon: CalendarDays,
    group: 'manage',
    restrictedHidden: true,
  },
  {
    name: 'Billing',
    path: '/billing',
    icon: Receipt,
    group: 'manage',
    restrictedHidden: true, // Hidden for restricted accounts
  },
  {
    name: 'Affiliate',
    path: '/affiliate',
    icon: Handshake,
    group: 'manage',
    affiliateOnly: true,
  },

  // System group - admin and utilities (pinned at bottom)
  {
    name: 'Admin',
    path: '/admin',
    icon: Settings,
    group: 'system',
    adminOnly: true,
  },
  {
    name: 'Bug Report',
    path: '/bug-report',
    icon: Bug,
    group: 'system',
    action: 'dialog',
  },
];

/**
 * Get navigation items grouped by their group property
 */
export function getGroupedNavigationItems(): Map<NavigationGroup, NavigationItem[]> {
  const grouped = new Map<NavigationGroup, NavigationItem[]>();

  for (const item of navigationItems) {
    const group = item.group;
    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group)!.push(item);
  }

  return grouped;
}

/**
 * Get sorted groups with their items
 */
export function getSortedNavigationGroups(): Array<{
  key: NavigationGroup;
  label: string;
  items: NavigationItem[];
}> {
  const grouped = getGroupedNavigationItems();

  return Object.entries(navigationGroups)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, { label }]) => ({
      key: key as NavigationGroup,
      label,
      items: grouped.get(key as NavigationGroup) || [],
    }))
    .filter((group) => group.items.length > 0);
}

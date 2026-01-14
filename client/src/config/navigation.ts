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
} from 'lucide-vue-next';

export type NavigationGroup = 'browse' | 'create' | 'manage' | 'system';

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
}

export const navigationGroups: Record<NavigationGroup, { label: string; order: number }> = {
  browse: { label: 'Browse', order: 1 },
  create: { label: 'Create', order: 2 },
  manage: { label: 'Manage', order: 3 },
  system: { label: '', order: 4 }, // No label for system group
};

export const navigationItems: NavigationItem[] = [
  // Browse group - discovery focused
  {
    name: 'Creators',
    path: '/creators',
    icon: Users,
    group: 'browse',
  },
  {
    name: 'Campaigns',
    path: '/campaigns',
    icon: Megaphone,
    group: 'browse',
  },

  // Create group - content creation tools
  {
    name: 'Projects',
    path: '/projects',
    icon: Folder,
    group: 'create',
  },
  {
    name: 'My Clips',
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
    name: 'Live',
    path: '/live-clip',
    icon: Radio,
    group: 'create',
  },
  {
    name: 'Stream VODs',
    path: '/vods',
    icon: Video,
    group: 'create',
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
  },
  {
    name: 'Prompts',
    path: '/prompts',
    icon: MessageSquare,
    group: 'manage',
  },
  {
    name: 'Messages',
    path: '/messages',
    icon: MessageCircle,
    group: 'manage',
    orgMember: true, // Show for any user who is a member of at least one organization
  },
  {
    name: 'Billing',
    path: '/billing',
    icon: Receipt,
    group: 'manage',
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

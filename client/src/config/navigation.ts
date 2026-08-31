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
  Paintbrush,
  Image,
  Headphones,
  Music,
  Disc,
  Sparkles,
} from 'lucide-vue-next';

export type NavigationGroup = 'browse' | 'library' | 'create' | 'studio' | 'manage' | 'system';

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
  navHidden?: boolean; // Temporarily hidden from navigation (code retained for later use)
  /** Stable app-tour hotspot id (data-tour-id). Defaults to path-derived nav-* */
  tourId?: string;
}

export const navigationGroups: Record<NavigationGroup, { label: string; order: number }> = {
  browse: { label: 'Browse', order: 1 },
  library: { label: 'Library', order: 2 },
  create: { label: 'Design Studio', order: 3 },
  studio: { label: 'Studio', order: 4 },
  manage: { label: 'Manage', order: 5 },
  system: { label: '', order: 6 }, // No label for system group
};

export const navigationItems: NavigationItem[] = [
  // Browse group - discovery focused
  {
    name: 'My Creators',
    path: '/creators',
    icon: Users,
    group: 'browse',
    restrictedHidden: true,
    tourId: 'nav-creators',
  },
  {
    name: 'Live Streams',
    path: '/live-clip',
    icon: Radio,
    group: 'browse',
    tourId: 'nav-live-clip',
  },
  {
    name: 'Download Video',
    path: '/vods',
    icon: Video,
    group: 'browse',
    tourId: 'nav-vods',
  },
  {
    name: 'Download Audio',
    path: '/download-audio',
    icon: Headphones,
    group: 'browse',
    tourId: 'nav-download-audio',
  },
  {
    name: 'Messages',
    path: '/messages',
    icon: MessageCircle,
    group: 'browse',
    tourId: 'nav-messages',
  },
  {
    name: 'Campaigns',
    path: '/campaigns',
    icon: Megaphone,
    group: 'browse',
    adminOnly: true,
    tourId: 'nav-campaigns',
  },

  // Library group - media libraries
  {
    name: 'Video',
    path: '/projects',
    icon: Folder,
    group: 'library',
    tourId: 'nav-projects',
  },
  {
    name: 'Audio',
    path: '/audio-library',
    icon: Music,
    group: 'library',
    tourId: 'nav-audio-library',
  },
  {
    name: 'Image',
    path: '/image-library',
    icon: Image,
    group: 'library',
    tourId: 'nav-image-library',
  },
  {
    name: 'Built Clips',
    path: '/clips',
    icon: LayoutGrid,
    group: 'library',
    tourId: 'nav-clips',
  },

  // Create group - editors and AI tools
  {
    name: 'Video Editor',
    path: '/video-editor',
    icon: Clapperboard,
    group: 'create',
    tourId: 'nav-video-editor',
  },
  {
    name: 'Image Editor',
    path: '/design-studio',
    icon: Paintbrush,
    group: 'create',
    badge: 'Beta',
    tourId: 'nav-design-studio',
  },
  {
    name: 'AI Video Editor',
    path: '/ai-video',
    icon: Wand2,
    group: 'create',
  },
  {
    name: 'AI Thumbnail Creator',
    path: '/ai-thumbnail',
    icon: Sparkles,
    group: 'create',
  },
  {
    name: 'Recording',
    path: '/studio/record',
    icon: Disc,
    group: 'studio',
    tourId: 'nav-studio-record',
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
    tourId: 'nav-prompts',
  },
  {
    name: 'Calendar',
    path: '/calendar',
    icon: CalendarDays,
    group: 'manage',
    restrictedHidden: true,
    tourId: 'nav-calendar',
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

<template>
  <PageLayout title="Admin" description="System administration and management tools" :icon="ShieldCheck">
    <template #badge>
      <Badge v-if="isModerator && !isAdmin" variant="neutral">Moderator</Badge>
      <Badge v-else variant="brand">Admin</Badge>
    </template>

    <div class="flex flex-col gap-6 px-5 py-4">
      <section v-for="group in groups" :key="group.title" class="flex flex-col gap-2.5">
        <SectionHeader :title="group.title" />
        <ListGroup :columns="2">
          <ListItem
            v-for="tool in group.tools"
            :key="tool.id"
            :title="tool.title"
            :description="tool.description"
            :icon="tool.icon"
            :to="tool.route"
          >
            <template v-if="tool.badge" #trailing>
              <Badge variant="brand" class="tabular">{{ tool.badge > 99 ? '99+' : tool.badge }}</Badge>
            </template>
          </ListItem>
        </ListGroup>
      </section>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import {
    ShieldCheck,
    Users,
    Building2,
    FileText,
    Activity,
    BarChart3,
    KeyRound,
    UserPlus,
    Settings,
    Percent,
    Handshake,
    Headset,
    MessagesSquare,
    ScrollText,
    Mail,
    Megaphone,
    Sparkles,
    Newspaper,
  } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { ListGroup, ListItem } from '@/components/ui/list-group';
  import { SectionHeader } from '@/components/ui/section-header';
  import PageLayout from '@/components/PageLayout.vue';
  import { useAuthStore } from '@/stores/auth';
  import api from '@/services/api';

  const authStore = useAuthStore();
  const unreadSupportCount = ref(0);
  let unreadPollInterval: ReturnType<typeof setInterval> | null = null;

  // Role checks
  const isAdmin = computed(() => authStore.user?.is_admin || false);
  const isModerator = computed(() => authStore.user?.is_moderator || false);

  interface Tool {
    id: string;
    title: string;
    description: string;
    icon: typeof Users;
    route: string;
    badge?: number;
  }

  // Admin-only tools
  const usersTools = computed<Tool[]>(() => {
    const tools: Tool[] = [];
    
    // Admin-only: Users and Organizations management
    if (isAdmin.value) {
      tools.push(
        {
          id: 'users',
          title: 'Users',
          description: 'Accounts, credits and subscriptions',
          icon: Users,
          route: '/admin/users',
        },
        {
          id: 'organizations',
          title: 'Organizations',
          description: 'Organizations and their credits',
          icon: Building2,
          route: '/admin/organizations',
        }
      );
    }
    
    // Mod+Admin: Org Applications
    if (isAdmin.value || isModerator.value) {
      tools.push({
        id: 'org-applications',
        title: 'Org applications',
        description: 'Review organization account applications',
        icon: FileText,
        route: '/admin/org-applications',
      });
    }
    
    return tools;
  });

  // Mod+Admin tools
  const contentTools = computed<Tool[]>(() => {
    const tools: Tool[] = [];
    
    if (isAdmin.value || isModerator.value) {
      tools.push(
        {
          id: 'bug-reports',
          title: 'Bug reports',
          description: 'Track and manage reported issues',
          icon: FileText,
          route: '/admin/bug-reports',
        },
        {
          id: 'ai-usage',
          title: 'AI usage',
          description: 'AI service consumption and performance',
          icon: Activity,
          route: '/admin/ai-usage',
        },
        {
          id: 'analytics',
          title: 'Analytics',
          description: 'Key user actions and events',
          icon: BarChart3,
          route: '/admin/analytics',
        },
        {
          id: 'customer-service',
          title: 'Customer service',
          description: 'Support conversations and tickets',
          icon: Headset,
          route: '/admin/customer-service',
          badge: unreadSupportCount.value || undefined,
        },
        {
          id: 'staff-messages',
          title: 'Staff messages',
          description: 'Internal chat for admins and moderators',
          icon: MessagesSquare,
          route: '/admin/staff-messages',
        }
      );
    }
    
    return tools;
  });

  // Admin-only revenue tools
  const revenueTools = computed<Tool[]>(() => {
    if (!isAdmin.value) return [];
    
    return [
      {
        id: 'platform-campaigns',
        title: 'Platform campaigns',
        description: 'Clippster-owned campaigns and rewards',
        icon: Sparkles,
        route: '/admin/platform-campaigns',
      },
      {
        id: 'affiliates',
        title: 'Affiliates',
        description: 'Affiliate accounts, commissions and payouts',
        icon: Handshake,
        route: '/admin/affiliates',
      },
    ];
  });

  // Admin-only system tools
  const systemTools = computed<Tool[]>(() => {
    if (!isAdmin.value) return [];
    
    return [
      {
        id: 'news',
        title: 'News',
        description: 'Breaking news feed for AI context',
        icon: Newspaper,
        route: '/admin/news',
      },
      {
        id: 'beta-codes',
        title: 'Beta codes',
        description: 'Generate and manage beta access codes',
        icon: KeyRound,
        route: '/admin/beta-codes',
      },
      {
        id: 'discount-codes',
        title: 'Discount codes',
        description: 'Promotional discount codes',
        icon: Percent,
        route: '/admin/discount-codes',
      },
      {
        id: 'waitlist',
        title: 'Waitlist',
        description: 'Early access sign-ups',
        icon: UserPlus,
        route: '/admin/waitlist',
      },
      {
        id: 'settings',
        title: 'Settings',
        description: 'Feature flags and UI configuration',
        icon: Settings,
        route: '/admin/settings',
      },
      {
        id: 'mod-logs',
        title: 'Moderator logs',
        description: 'Moderator actions and activity',
        icon: ScrollText,
        route: '/admin/mod-logs',
      },
      {
        id: 'messaging',
        title: 'Email campaigns',
        description: 'Email users or the waitlist',
        icon: Mail,
        route: '/admin/messaging',
      },
      {
        id: 'announcements',
        title: 'Announcements',
        description: 'In-app announcements',
        icon: Megaphone,
        route: '/admin/announcements',
      },
    ];
  });

  /** Destination groups, in display order; empty groups are hidden. */
  const groups = computed(() =>
    [
      { title: 'Users & access', tools: usersTools.value },
      { title: 'Content & reports', tools: contentTools.value },
      { title: 'Revenue', tools: revenueTools.value },
      { title: 'System', tools: systemTools.value },
    ].filter((group) => group.tools.length > 0)
  );

  async function fetchUnreadSupportCount() {
    if (!isAdmin.value && !isModerator.value) return;
    try {
      const response = await api.get('/admin/support/unread-count');
      unreadSupportCount.value = response.data.unread_count ?? 0;
    } catch {
      // silently ignore
    }
  }

  onMounted(() => {
    fetchUnreadSupportCount();
    unreadPollInterval = setInterval(fetchUnreadSupportCount, 30_000);
  });

  onUnmounted(() => {
    if (unreadPollInterval) clearInterval(unreadPollInterval);
  });
</script>

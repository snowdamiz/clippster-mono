<template>
  <header
    class="fixed top-0 left-64 right-0 h-16 px-6 flex items-center justify-between border-b border-border/40 bg-background z-10"
  >
    <nav class="flex items-center gap-2 text-sm">
      <template v-for="(crumb, index) in breadcrumbs" :key="index">
        <svg
          v-if="index > 0"
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5 text-muted-foreground/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <router-link
          v-if="crumb.path && index < breadcrumbs.length - 1"
          :to="crumb.path"
          class="text-muted-foreground hover:text-foreground capitalize transition-colors"
        >
          {{ crumb.title }}
        </router-link>
        <span v-else class="text-foreground capitalize">{{ crumb.title }}</span>
      </template>
    </nav>

    <div class="flex items-center gap-4">
      <!-- Credit Balance -->
      <router-link to="/pricing" class="flex items-center gap-2 cursor-pointer" title="View Pricing & Purchase Credits">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span class="text-sm font-semibold text-white" v-if="!loadingBalance">
          <span v-if="hoursRemaining === 'unlimited'">Credits: Unlimited</span>
          <span v-else>Credits: {{ hoursRemaining }} {{ hoursRemaining === 1 ? 'hr' : 'hrs' }}</span>
        </span>
        <span class="text-sm font-semibold text-white" v-else><span class="animate-pulse">Loading...</span></span>
      </router-link>
    </div>
  </header>
</template>

<script setup lang="ts">
  import { computed, ref, onMounted } from 'vue';
  import { useRoute } from 'vue-router';
  import { useAuthStore } from '@/stores/auth';
  import { useBreadcrumb } from '@/composables/useBreadcrumb';

  const route = useRoute();
  const authStore = useAuthStore();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const hoursRemaining = ref(0 | 'unlimited');
  const loadingBalance = ref(false);

  // Get breadcrumb title from composable
  const { breadcrumbTitle } = useBreadcrumb();

  interface Breadcrumb {
    title: string;
    path?: string;
  }

  const breadcrumbs = computed<Breadcrumb[]>(() => {
    // Access breadcrumbTitle to make computed reactive to it
    const dynamicTitle = breadcrumbTitle.value;

    const pathSegments = route.path.split('/').filter((s) => s);
    const crumbs: Breadcrumb[] = [];

    if (pathSegments.length === 0) return crumbs;

    // Handle nested routes
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      const isLast = i === pathSegments.length - 1;

      // Check if this is a UUID segment (8-4-4-4-12 format)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUUID = uuidPattern.test(segment);

      // Format the title
      let title = segment;
      let shouldSkip = false;

      if (segment === 'new') {
        // Get the parent segment to create "New [Parent]"
        const parent = pathSegments[i - 1] || '';
        title = `New ${parent.slice(0, -1)}`; // Remove trailing 's' for singular
      } else if (segment === 'edit') {
        // Show "Edit" in the breadcrumb
        title = 'Edit';
      } else if (isUUID) {
        // Replace UUID with the breadcrumb title from composable
        if (dynamicTitle) {
          title = dynamicTitle;
        } else {
          // Skip UUID segments that don't have a breadcrumb title yet
          shouldSkip = true;
        }
      }

      if (shouldSkip) continue;

      // Build the path - but not for UUIDs (they don't have routes) or if it's the last segment
      let linkPath: string | undefined = undefined;
      if (!isLast && !isUUID) {
        linkPath = '/' + pathSegments.slice(0, i + 1).join('/');
      }

      crumbs.push({
        title,
        path: linkPath,
      });
    }

    return crumbs;
  });

  async function fetchBalance() {
    if (!authStore.token) return;

    loadingBalance.value = true;
    try {
      const response = await fetch(`${API_BASE}/api/credits/balance`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          hoursRemaining.value =
            data.balance.hours_remaining === 'unlimited'
              ? 'unlimited'
              : parseFloat(data.balance.hours_remaining.toFixed(1));
        }
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      loadingBalance.value = false;
    }
  }

  onMounted(() => {
    fetchBalance();
    // Refresh balance every 30 seconds
    setInterval(fetchBalance, 30000);
  });
</script>

<template>
  <header
    class="fixed top-8 left-64 right-0 h-16 px-6 flex items-center justify-between border-b border-border/40 bg-background z-10"
  >
    <nav class="flex items-center gap-2 text-sm">
      <template v-for="(crumb, index) in breadcrumbs" :key="index">
        <ChevronRight v-if="index > 0" class="h-3.5 w-3.5 text-muted-foreground/50" />
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
  </header>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { useRoute } from 'vue-router';
  import { useBreadcrumb } from '@/composables/useBreadcrumb';
  import { ChevronRight } from 'lucide-vue-next';

  const route = useRoute();

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
</script>

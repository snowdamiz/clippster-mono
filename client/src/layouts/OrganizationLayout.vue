<template>
  <DashboardLayout>
    <!-- Show setup dialog if needed (blocks all org content) -->
    <OrganizationSetupDialog
      :show="showSetupDialog"
      :organization="organization"
      @setup-complete="handleSetupComplete"
    />

    <!--
      isReady is a LOCAL ref that starts false on every mount.
      This prevents the hub from rendering before THIS mount's loadOrganization
      has finished — even when the shared state cache already has loading=false
      from a previous visit (back navigation, HMR reload, etc.).
      showSetupDialog provides a second gate: if setup is still required, the
      hub never mounts regardless.
    -->
    <router-view v-if="isReady && !showSetupDialog" v-slot="{ Component, route: viewRoute }">
      <!-- Enter-only page transition, same as DashboardLayout -->
      <transition name="page">
        <component :is="Component" :key="viewRoute.path" />
      </transition>
    </router-view>

    <!-- Page-shaped placeholder while the organization loads -->
    <div v-else-if="!isReady" class="flex h-full w-full flex-col" aria-busy="true">
      <div class="flex h-[var(--page-header-height)] shrink-0 items-center gap-2.5 border-b border-line-subtle px-5">
        <div class="skeleton size-5 rounded-md" />
        <div class="skeleton h-3.5 w-40" />
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 px-5 py-4">
        <div v-for="i in 4" :key="i" class="skeleton h-[66px] rounded-xl" />
      </div>
    </div>
  </DashboardLayout>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import { useOrganization } from '@/composables/useOrganization';
  import DashboardLayout from '@/layouts/DashboardLayout.vue';
  import OrganizationSetupDialog from '@/components/OrganizationSetupDialog.vue';

  const showSetupDialog = ref(false);

  // isReady is intentionally LOCAL (not from shared state) so it resets to
  // false on every mount cycle. The hub will never render until we have
  // fresh confirmation that setup is complete for this navigation.
  const isReady = ref(false);

  const {
    organization,
    role,
    loadOrganization,
  } = useOrganization();

  // Treat missing/falsey setup_completed as requiring payment (API may omit field)
  const needsSetup = computed(() => {
    const org = organization.value as any;
    if (!org) return false;
    const priceCents = org.admin_price_cents ?? 0;
    const setupDone = org.setup_completed === true;
    return !setupDone && role.value === 'owner' && priceCents > 0;
  });

  watch(needsSetup, (needs) => {
    showSetupDialog.value = needs;
  });

  const handleSetupComplete = async () => {
    showSetupDialog.value = false;
    await loadOrganization(true);
  };

  onMounted(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('setup') === 'complete') {
      window.history.replaceState({}, '', window.location.pathname);
      await loadOrganization(true);
    } else {
      await loadOrganization();
    }

    // After load: evaluate setup requirement before allowing hub to render
    if (needsSetup.value) {
      showSetupDialog.value = true;
    }

    // Always mark ready AFTER setup check so router-view respects showSetupDialog
    isReady.value = true;
  });
</script>

<style scoped>
  .page-enter-active {
    animation: enter var(--duration-base) var(--ease-out) backwards;
  }
</style>

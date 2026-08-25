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
    <router-view v-if="isReady && !showSetupDialog" />
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
  /* No additional styles needed - DashboardLayout handles structure */
</style>

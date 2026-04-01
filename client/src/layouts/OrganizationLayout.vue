<template>
  <DashboardLayout>
    <!-- Show setup dialog if needed (blocks all org content) -->
    <OrganizationSetupDialog
      :show="showSetupDialog"
      :organization="organization"
      @setup-complete="handleSetupComplete"
    />
    
    <!-- Render child routes only if setup is complete OR not required -->
    <router-view v-if="!showSetupDialog" />
  </DashboardLayout>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import { useRoute } from 'vue-router';
  import { useOrganization } from '@/composables/useOrganization';
  import DashboardLayout from '@/layouts/DashboardLayout.vue';
  import OrganizationSetupDialog from '@/components/OrganizationSetupDialog.vue';

  const route = useRoute();
  const showSetupDialog = ref(false);

  const {
    loading,
    organization,
    role,
    loadOrganization,
  } = useOrganization();

  // Check if setup is required
  const needsSetup = computed(() => {
    return (
      !loading.value &&
      !(organization.value as any)?.setup_completed &&
      role.value === 'owner' &&
      ((organization.value as any)?.admin_price_cents || 0) > 0
    );
  });

  // Watch for setup requirement changes
  watch(needsSetup, (needs) => {
    showSetupDialog.value = needs;
  }, { immediate: true });

  // Handle setup completion
  const handleSetupComplete = async () => {
    showSetupDialog.value = false;
    // Reload organization data to get updated setup_completed status
    await loadOrganization();
  };

  onMounted(async () => {
    // Check if returning from Stripe setup
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('setup') === 'complete') {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Reload to get fresh org data
      await loadOrganization();
    }
  });
</script>

<style scoped>
  /* No additional styles needed - DashboardLayout handles structure */
</style>

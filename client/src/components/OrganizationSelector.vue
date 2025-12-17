<template>
  <div class="relative" ref="dropdownRef">
    <!-- Trigger Button -->
    <button
      @click="toggleDropdown"
      class="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600 transition-colors w-full"
    >
      <div
        class="w-6 h-6 rounded-md bg-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0 relative"
      >
        <img
          v-if="currentOrganization?.logo_url && !failedLogos.has(currentOrganization.id)"
          :src="currentOrganization.logo_url"
          :alt="currentOrganization.name"
          class="w-full h-full object-cover absolute inset-0 z-20"
          referrerpolicy="no-referrer"
          @error="handleLogoError($event, currentOrganization.id)"
        />
        <div v-else class="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted/30 to-primary/10"></div>
        <Building2
          v-if="!currentOrganization?.logo_url || failedLogos.has(currentOrganization.id)"
          class="h-3.5 w-3.5 text-zinc-400 relative z-10"
        />
      </div>
      <span class="flex-1 text-sm text-white truncate text-left">
        {{ currentOrganization?.name || 'Select Organization' }}
      </span>
      <ChevronDown :class="['h-4 w-4 text-zinc-400 transition-transform', isOpen ? 'rotate-180' : '']" />
    </button>

    <!-- Dropdown -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden"
      >
        <!-- Loading State -->
        <div v-if="loading" class="px-3 py-4 text-center">
          <Loader2 class="h-5 w-5 animate-spin text-zinc-400 mx-auto" />
        </div>

        <!-- Organizations List -->
        <div v-else-if="organizations.length > 0" class="py-1 max-h-64 overflow-y-auto">
          <button
            v-for="org in organizations"
            :key="org.id"
            @click="selectOrganization(org)"
            :class="[
              'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left',
              currentOrganization?.id === org.id ? 'bg-zinc-800/50' : '',
            ]"
          >
            <div
              class="w-8 h-8 rounded-md bg-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0 relative"
            >
              <img
                v-if="org.logo_url && !failedLogos.has(org.id)"
                :src="org.logo_url"
                :alt="org.name"
                class="w-full h-full object-cover absolute inset-0 z-20"
                referrerpolicy="no-referrer"
                @error="handleLogoError($event, org.id)"
              />
              <div v-else class="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted/30 to-primary/10"></div>
              <Building2 v-if="!org.logo_url || failedLogos.has(org.id)" class="h-4 w-4 text-zinc-400 relative z-10" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-white truncate">{{ org.name }}</div>
              <div class="text-xs text-zinc-500 capitalize">{{ org.role }}</div>
            </div>
            <Check v-if="currentOrganization?.id === org.id" class="h-4 w-4 text-violet-400 flex-shrink-0" />
          </button>
        </div>

        <!-- Empty State -->
        <div v-else class="px-3 py-4 text-center text-sm text-zinc-500">You're not a member of any organizations</div>

        <!-- Footer Actions -->
        <div class="border-t border-zinc-700 p-2">
          <router-link
            v-if="canCreateOrg"
            to="/organization/setup"
            @click="isOpen = false"
            class="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <Plus class="h-4 w-4" />
            Create Organization
          </router-link>
          <div v-else class="px-3 py-2 text-xs text-zinc-500">You already own an organization</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { Building2, ChevronDown, Check, Plus, Loader2 } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';

  const props = defineProps<{
    modelValue?: number | string | null;
  }>();

  // Track failed logo images
  const failedLogos = ref<Set<string | number>>(new Set());

  function handleLogoError(event: Event, orgId: string | number) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    failedLogos.value.add(orgId);
  }

  const emit = defineEmits<{
    'update:modelValue': [value: number | string | null];
    change: [organization: any];
  }>();

  const router = useRouter();
  const authStore = useAuthStore();

  const isOpen = ref(false);
  const loading = ref(true);
  const organizations = ref<any[]>([]);
  const dropdownRef = ref<HTMLElement | null>(null);

  const currentOrganization = computed(() => {
    if (!props.modelValue) return null;
    return organizations.value.find((o) => o.id === props.modelValue) || null;
  });

  const canCreateOrg = computed(() => {
    return authStore.user?.account_type !== 'organization' || !authStore.user?.owned_organization_id;
  });

  function toggleDropdown() {
    isOpen.value = !isOpen.value;
  }

  function selectOrganization(org: any) {
    emit('update:modelValue', org.id);
    emit('change', org);
    isOpen.value = false;
    router.push(`/organization/${org.id}`);
  }

  function handleClickOutside(event: MouseEvent) {
    if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
      isOpen.value = false;
    }
  }

  async function loadOrganizations() {
    loading.value = true;
    try {
      const result = await authStore.getOrganizations();
      if (result.success) {
        organizations.value = result.organizations;

        // If no org selected but user has orgs, select the first one
        if (!props.modelValue && organizations.value.length > 0) {
          // Prefer owned organization
          const ownedOrg = organizations.value.find((o) => o.role === 'owner');
          if (ownedOrg) {
            emit('update:modelValue', ownedOrg.id);
          } else {
            emit('update:modelValue', organizations.value[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    if (authStore.isAuthenticated) {
      loadOrganizations();
    }
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  // Reload when auth changes
  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (isAuth) {
        loadOrganizations();
      } else {
        organizations.value = [];
      }
    }
  );
</script>

<style scoped>
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition: all 0.15s ease;
  }

  .dropdown-enter-from,
  .dropdown-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
</style>

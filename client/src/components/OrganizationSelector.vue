<template>
  <DropdownMenu v-model:open="isOpen">
    <DropdownMenuTrigger
      class="group -mx-1.5 flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-md px-1.5 text-sm font-semibold transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] data-[state=open]:bg-surface-hover"
      :class="muted ? 'text-fg-muted hover:text-fg data-[state=open]:text-fg' : 'text-fg'"
      title="Switch organization"
      aria-label="Switch organization"
    >
      <Avatar :src="currentOrganization?.logo_url" :name="currentOrganization?.name" :icon="Building2" shape="square" size="xs" />
      <span class="truncate">{{ currentOrganization?.name || (loading ? 'Loading…' : 'Select organization') }}</span>
      <ChevronsUpDown class="size-3.5 shrink-0 text-fg-subtle group-hover:text-fg-muted" />
    </DropdownMenuTrigger>

    <DropdownMenuContent align="start" class="w-64">
      <DropdownMenuLabel>Organizations</DropdownMenuLabel>

      <div v-if="loading" class="flex justify-center py-3">
        <Loader2 class="size-4 animate-spin text-fg-subtle" />
      </div>

      <div v-else-if="organizations.length > 0" class="max-h-64 overflow-y-auto">
        <DropdownMenuItem
          v-for="org in organizations"
          :key="org.id"
          class="h-auto py-1.5"
          @select="selectOrganization(org)"
        >
          <Avatar :src="org.logo_url" :name="org.name" :icon="Building2" shape="square" size="sm" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm text-fg">{{ org.name }}</span>
            <span class="block text-2xs capitalize text-fg-subtle">{{ org.role }}</span>
          </span>
          <Check v-if="isCurrent(org)" class="!text-brand" />
        </DropdownMenuItem>
      </div>

      <p v-else class="px-2 py-3 text-center text-xs text-fg-subtle">You're not a member of any organizations</p>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Avatar } from '@/components/ui/avatar';

  const props = defineProps<{
    modelValue?: number | string | null;
    /** Render the trigger as a muted breadcrumb segment. */
    muted?: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: number | string | null];
    change: [organization: any];
  }>();

  const router = useRouter();
  const authStore = useAuthStore();

  const isOpen = ref(false);
  const loading = ref(true);
  const organizations = ref<any[]>([]);

  // Route params are strings while API ids are numbers — compare loosely.
  function isCurrent(org: any) {
    return props.modelValue != null && String(org.id) === String(props.modelValue);
  }

  const currentOrganization = computed(() => {
    if (!props.modelValue) return null;
    return organizations.value.find((o) => isCurrent(o)) || null;
  });

  function selectOrganization(org: any) {
    emit('update:modelValue', org.id);
    emit('change', org);
    isOpen.value = false;
    router.push(`/organization/${org.id}`);
  }

  async function loadOrganizations() {
    loading.value = true;
    try {
      const result = await authStore.getOrganizations();
      if (result.success) {
        organizations.value = result.organizations ?? [];

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
    if (authStore.isAuthenticated) {
      loadOrganizations();
    }
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

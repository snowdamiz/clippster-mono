<template>
  <Dialog :open="open" @update:open="$emit('close')">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Instagram class="h-5 w-5 text-pink-500" />
          Select Organization
        </DialogTitle>
        <DialogDescription>Choose which organization to publish under</DialogDescription>
      </DialogHeader>

      <div class="py-4">
        <!-- Loading State -->
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 3" :key="i" class="p-3 bg-muted/50 rounded-lg animate-pulse">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-muted"></div>
              <div class="flex-1">
                <div class="h-4 w-32 bg-muted rounded"></div>
                <div class="h-3 w-20 bg-muted rounded mt-1.5"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="organizations.length === 0" class="text-center py-8">
          <div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Building class="h-5 w-5 text-muted-foreground" />
          </div>
          <p class="text-foreground text-sm font-medium mb-1">No Organizations</p>
          <p class="text-muted-foreground text-xs">You need to be part of an organization to publish clips</p>
        </div>

        <!-- Organizations List -->
        <div v-else class="space-y-2 max-h-[300px] overflow-y-auto">
          <button
            v-for="org in organizations"
            :key="org.id"
            class="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent hover:border-accent transition-colors text-left"
            @click="selectOrganization(org)"
          >
            <!-- Org Avatar/Logo -->
            <div
              class="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0 border border-border overflow-hidden"
            >
              <img v-if="org.logo_url" :src="org.logo_url" :alt="org.name" class="w-10 h-10 object-cover" />
              <span v-else class="text-sm font-bold text-pink-500">
                {{ getInitials(org.name) }}
              </span>
            </div>

            <!-- Org Info -->
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm text-foreground truncate">
                {{ org.name }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ org.role === 'owner' ? 'Owner' : org.role === 'admin' ? 'Admin' : 'Member' }}
              </div>
            </div>

            <!-- Role Badge -->
            <span
              :class="[
                'px-2 py-1 rounded-md text-xs font-medium',
                org.role === 'owner'
                  ? 'bg-amber-500/10 text-amber-500'
                  : org.role === 'admin'
                    ? 'bg-purple-500/10 text-purple-500'
                    : 'bg-muted text-muted-foreground',
              ]"
            >
              {{ org.role }}
            </span>

            <!-- Arrow -->
            <ChevronRight class="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </button>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('close')">Cancel</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
  import { Button } from '@/components/ui/button';
  import { Instagram, Building, ChevronRight } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';

  interface Organization {
    id: string | number;
    name: string;
    logo_url?: string | null;
    role: string;
  }

  const props = defineProps<{
    open: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'select', org: Organization): void;
  }>();

  const authStore = useAuthStore();
  const loading = ref(false);
  const organizations = ref<Organization[]>([]);

  // Load organizations when dialog opens
  watch(
    () => props.open,
    async (isOpen) => {
      if (isOpen) {
        await loadOrganizations();
      }
    },
    { immediate: true }
  );

  async function loadOrganizations() {
    loading.value = true;
    try {
      const result = await authStore.getOrganizations();
      if (result.success && result.organizations) {
        organizations.value = result.organizations;
      } else {
        organizations.value = [];
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      organizations.value = [];
    } finally {
      loading.value = false;
    }
  }

  function selectOrganization(org: Organization) {
    emit('select', org);
    emit('close');
  }

  function getInitials(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
</script>

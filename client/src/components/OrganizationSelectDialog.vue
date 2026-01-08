<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
        @click.self="$emit('close')"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 flex-shrink-0" />

            <!-- Header -->
            <div
              class="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-pink-500/30"
                >
                  <Instagram class="h-5 w-5 text-pink-400" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-white">Select Organization</h2>
                  <p class="text-zinc-400 text-xs">Choose which organization to publish under</p>
                </div>
              </div>
              <button
                @click="$emit('close')"
                class="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border border-zinc-800"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Content -->
            <div class="flex-1 p-5 sm:p-6 overflow-y-auto custom-scrollbar">
              <!-- Loading State -->
              <div v-if="loading" class="space-y-3">
                <div v-for="i in 3" :key="i" class="p-4 bg-zinc-800/50 rounded-xl animate-pulse">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-zinc-700/50"></div>
                    <div class="flex-1">
                      <div class="h-4 w-32 bg-zinc-700/50 rounded"></div>
                      <div class="h-3 w-24 bg-zinc-700/50 rounded mt-1.5"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else-if="organizations.length === 0" class="text-center py-8">
                <div class="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                  <Building class="h-5 w-5 text-zinc-500" />
                </div>
                <p class="text-zinc-400 text-sm font-medium mb-1">No Organizations</p>
                <p class="text-zinc-500 text-xs">You need to be part of an organization to publish clips</p>
              </div>

              <!-- Organizations List -->
              <div v-else class="space-y-2">
                <div
                  v-for="org in organizations"
                  :key="org.id"
                  class="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 transition-colors cursor-pointer"
                  @click="selectOrganization(org)"
                >
                  <!-- Org Avatar/Logo -->
                  <div
                    class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0 border border-zinc-700 overflow-hidden"
                  >
                    <img v-if="org.logo_url" :src="org.logo_url" :alt="org.name" class="w-10 h-10 object-cover" />
                    <span v-else class="text-sm font-bold text-pink-400">
                      {{ getInitials(org.name) }}
                    </span>
                  </div>

                  <!-- Org Info -->
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm text-white truncate">
                      {{ org.name }}
                    </div>
                    <div class="text-xs text-zinc-500 truncate">
                      {{ org.role === 'owner' ? 'Owner' : org.role === 'admin' ? 'Admin' : 'Member' }}
                    </div>
                  </div>

                  <!-- Role Badge -->
                  <span
                    :class="[
                      'px-2.5 py-1 rounded-lg text-xs font-medium border',
                      org.role === 'owner'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : org.role === 'admin'
                          ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700',
                    ]"
                  >
                    {{ org.role }}
                  </span>

                  <!-- Arrow -->
                  <ChevronRight class="w-4 h-4 text-zinc-500" />
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Instagram, X, Building, ChevronRight } from 'lucide-vue-next';
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

<style scoped>
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* Custom scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
</style>

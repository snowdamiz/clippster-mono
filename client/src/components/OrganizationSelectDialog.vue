<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
        @click.self="$emit('close')"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md sm:max-w-lg w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 flex-shrink-0" />

            <div class="p-5 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
              <!-- Header -->
              <div class="mb-4 sm:mb-6 text-center">
                <div
                  class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-pink-500/30 mb-3 sm:mb-4"
                >
                  <Instagram class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-pink-400" />
                </div>
                <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">Select Organization</h2>
                <p class="text-zinc-400 text-xs sm:text-sm mt-1">Choose which organization to publish under</p>
              </div>

              <!-- Loading State -->
              <div v-if="loading" class="space-y-3">
                <div
                  v-for="i in 3"
                  :key="i"
                  class="p-3 sm:p-4 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl animate-pulse"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-zinc-800"></div>
                    <div class="flex-1">
                      <div class="h-4 w-32 bg-zinc-800 rounded"></div>
                      <div class="h-3 w-20 bg-zinc-800 rounded mt-1.5"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else-if="organizations.length === 0" class="text-center py-8 sm:py-10">
                <div
                  class="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-zinc-800/50 border border-zinc-700 mb-3 sm:mb-4"
                >
                  <Building class="h-5 w-5 sm:h-6 sm:w-6 text-zinc-500" />
                </div>
                <p class="text-white text-sm sm:text-base font-medium mb-1">No Organizations</p>
                <p class="text-zinc-500 text-xs sm:text-sm">You need to be part of an organization to publish clips</p>
              </div>

              <!-- Organizations List -->
              <div v-else class="space-y-2 sm:space-y-3">
                <button
                  v-for="org in organizations"
                  :key="org.id"
                  class="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl hover:bg-zinc-800/80 hover:border-zinc-700 transition-all duration-200 text-left group"
                  @click="selectOrganization(org)"
                >
                  <!-- Org Avatar/Logo -->
                  <div
                    class="w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0 border border-zinc-700 overflow-hidden"
                  >
                    <img v-if="org.logo_url" :src="org.logo_url" :alt="org.name" class="w-full h-full object-cover" />
                    <span v-else class="text-sm sm:text-base font-bold text-pink-400">
                      {{ getInitials(org.name) }}
                    </span>
                  </div>

                  <!-- Org Info -->
                  <div class="flex-1 min-w-0">
                    <div
                      class="font-medium text-sm sm:text-base text-white truncate group-hover:text-pink-50 transition-colors"
                    >
                      {{ org.name }}
                    </div>
                    <div class="text-xs sm:text-sm text-zinc-500">
                      {{ org.role === 'owner' ? 'Owner' : org.role === 'admin' ? 'Admin' : 'Member' }}
                    </div>
                  </div>

                  <!-- Role Badge -->
                  <span
                    :class="[
                      'px-2 sm:px-2.5 py-1 rounded-md sm:rounded-lg text-xs font-medium border',
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
                  <ChevronRight
                    class="w-4 h-4 sm:w-5 sm:h-5 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all flex-shrink-0"
                  />
                </button>
              </div>

              <!-- Actions -->
              <div class="mt-4 sm:mt-6 pt-4 sm:pt-5 border-t border-zinc-800">
                <button
                  type="button"
                  @click="$emit('close')"
                  class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 text-sm"
                >
                  Cancel
                </button>
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
    background: rgb(63 63 70);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(82 82 91);
  }
</style>

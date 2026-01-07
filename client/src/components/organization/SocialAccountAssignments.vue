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
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-lg w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
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
                  <h2 class="text-lg font-semibold text-white">Manage Access</h2>
                  <p class="text-zinc-400 text-xs">@{{ account.username }}</p>
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
              <!-- Description -->
              <p class="text-zinc-400 text-sm mb-4">Assign members who can use this account to publish posts</p>

              <!-- Search/Filter -->
              <div class="relative mb-4">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search members..."
                  class="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all text-sm"
                />
              </div>

              <!-- Members List -->
              <div class="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                <div
                  v-for="member in filteredMembers"
                  :key="member.user_id"
                  class="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 transition-colors cursor-pointer"
                  :class="{ 'opacity-50 pointer-events-none': saving }"
                  @click="toggleAssignment(member.user_id, !isAssigned(member.user_id))"
                >
                  <!-- Checkbox -->
                  <div
                    class="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
                    :class="
                      isAssigned(member.user_id)
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-transparent'
                        : 'border-zinc-600 hover:border-zinc-500'
                    "
                  >
                    <Check v-if="isAssigned(member.user_id)" class="h-3 w-3 text-white" />
                  </div>

                  <!-- Member Avatar -->
                  <div
                    class="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-zinc-700 overflow-hidden"
                  >
                    <img
                      v-if="member.user.avatar_url && !failedAvatars.has(member.user_id)"
                      :src="member.user.avatar_url"
                      :alt="member.user.name || member.user.email"
                      class="w-9 h-9 rounded-full object-cover"
                      referrerpolicy="no-referrer"
                      @error="handleAvatarError($event, member.user_id)"
                    />
                    <span v-else class="text-xs font-medium text-zinc-400">
                      {{ getInitials(member.user.name || member.user.email) }}
                    </span>
                  </div>

                  <!-- Member Info -->
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm text-white truncate">
                      {{ member.user.name || member.user.email }}
                    </div>
                    <div v-if="member.user.name" class="text-xs text-zinc-500 truncate">
                      {{ member.user.email }}
                    </div>
                  </div>

                  <!-- Role Badge -->
                  <span
                    :class="[
                      'px-2.5 py-1 rounded-lg text-xs font-medium border',
                      member.role === 'owner'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : member.role === 'admin'
                          ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700',
                    ]"
                  >
                    {{ member.role }}
                  </span>
                </div>

                <!-- Empty Search State -->
                <div v-if="filteredMembers.length === 0 && searchQuery" class="text-center py-8">
                  <div class="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                    <Search class="h-5 w-5 text-zinc-500" />
                  </div>
                  <p class="text-zinc-500 text-sm">No members match your search</p>
                </div>

                <!-- Empty State -->
                <div v-if="members.length === 0" class="text-center py-8">
                  <div class="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                    <Users class="h-5 w-5 text-zinc-500" />
                  </div>
                  <p class="text-zinc-500 text-sm">No members in this organization</p>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div
              class="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex-shrink-0"
            >
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-pink-500"></div>
                <span class="text-sm text-zinc-400">
                  {{ assignedCount }} member{{ assignedCount !== 1 ? 's' : '' }} assigned
                </span>
              </div>
              <button
                @click="$emit('close')"
                class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 hover:border-zinc-600 text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Instagram, Search, Check, X, Users } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import { assignSocialAccount, unassignSocialAccount, type SocialAccount } from '@/services/socialAccountsApi';

  interface Member {
    id: number;
    user_id: number;
    role: string;
    user: {
      id: number;
      email: string;
      name: string | null;
      avatar_url: string | null;
    };
  }

  const props = defineProps<{
    account: SocialAccount;
    organizationId: string | number;
    members: Member[];
    open: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'updated'): void;
  }>();

  const { showToast } = useToast();

  const searchQuery = ref('');
  const saving = ref(false);
  const assignedUserIds = ref<Set<number>>(new Set());
  const failedAvatars = ref<Set<number>>(new Set());

  // Initialize assigned users from account data
  watch(
    () => props.open,
    (isOpen) => {
      if (isOpen && props.account.assignments) {
        assignedUserIds.value = new Set(props.account.assignments.map((a) => a.user_id));
      }
    },
    { immediate: true }
  );

  const filteredMembers = computed(() => {
    if (!searchQuery.value) return props.members;

    const query = searchQuery.value.toLowerCase();
    return props.members.filter((member) => {
      const name = member.user.name?.toLowerCase() || '';
      const email = member.user.email.toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  });

  const assignedCount = computed(() => assignedUserIds.value.size);

  function isAssigned(userId: number): boolean {
    return assignedUserIds.value.has(userId);
  }

  async function toggleAssignment(userId: number, assign: boolean) {
    saving.value = true;

    try {
      if (assign) {
        const response = await assignSocialAccount(props.organizationId, props.account.id, [userId]);

        if (response.success) {
          assignedUserIds.value.add(userId);
          showToast('Member assigned', 'success');
          emit('updated');
        } else {
          showToast(response.error || 'Failed to assign member', 'error');
        }
      } else {
        const response = await unassignSocialAccount(props.organizationId, props.account.id, userId);

        if (response.success) {
          assignedUserIds.value.delete(userId);
          showToast('Member unassigned', 'success');
          emit('updated');
        } else {
          showToast(response.error || 'Failed to unassign member', 'error');
        }
      }
    } catch (error) {
      console.error('Failed to update assignment:', error);
      showToast('Failed to update assignment', 'error');
    } finally {
      saving.value = false;
    }
  }

  function getInitials(name: string): string {
    return name
      .split(/[\s@]+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function handleAvatarError(event: Event, userId: number) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    failedAvatars.value.add(userId);
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

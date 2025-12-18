<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
        @click.self="closeDialog"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[80vh] flex flex-col"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

            <div class="p-5 sm:p-6 flex flex-col flex-1 overflow-hidden">
              <!-- Header -->
              <div class="mb-5 text-center flex-shrink-0">
                <div
                  class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-4"
                >
                  <Users class="h-6 w-6 text-violet-400" />
                </div>
                <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight">Manage Assignments</h2>
                <p class="text-zinc-400 text-sm mt-1">Assign "{{ profile?.name }}" to team members</p>
              </div>

              <!-- Loading State -->
              <div v-if="loading" class="flex-1 flex items-center justify-center">
                <Loader2 class="h-8 w-8 animate-spin text-zinc-500" />
              </div>

              <!-- Member List -->
              <div v-else class="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                <div
                  v-for="member in members"
                  :key="member.user_id"
                  class="flex items-center gap-3 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors cursor-pointer"
                  @click="toggleAssignment(member.user_id)"
                >
                  <!-- Checkbox -->
                  <div
                    class="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all"
                    :class="
                      isAssigned(member.user_id)
                        ? 'bg-violet-500 border-violet-500'
                        : 'border-zinc-600 hover:border-zinc-500'
                    "
                  >
                    <Check v-if="isAssigned(member.user_id)" class="h-3 w-3 text-white" />
                  </div>

                  <!-- Avatar -->
                  <div class="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                    <img
                      v-if="member.user?.avatar_url"
                      :src="member.user.avatar_url"
                      :alt="member.user.name || member.user.email"
                      class="w-full h-full object-cover"
                      referrerpolicy="no-referrer"
                    />
                    <User v-else class="h-4 w-4 text-zinc-500" />
                  </div>

                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-white truncate">
                      {{ member.user?.name || member.user?.email }}
                    </p>
                    <p v-if="member.user?.name" class="text-xs text-zinc-500 truncate">
                      {{ member.user.email }}
                    </p>
                  </div>

                  <!-- Role Badge -->
                  <span
                    :class="[
                      'px-2 py-0.5 rounded text-xs font-medium flex-shrink-0',
                      member.role === 'owner'
                        ? 'bg-amber-500/20 text-amber-400'
                        : member.role === 'admin'
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'bg-zinc-700 text-zinc-400',
                    ]"
                  >
                    {{ member.role }}
                  </span>
                </div>

                <!-- Empty State -->
                <div v-if="members.length === 0" class="text-center py-8 text-zinc-500">
                  <Users class="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No members in this organization</p>
                </div>
              </div>

              <!-- Summary -->
              <div class="pt-4 mt-4 border-t border-zinc-800 flex-shrink-0">
                <div class="flex items-center justify-between text-sm text-zinc-400 mb-4">
                  <span>{{ selectedUserIds.length }} of {{ members.length }} members selected</span>
                  <div class="flex gap-2">
                    <button type="button" @click="selectAll" class="text-violet-400 hover:text-violet-300 text-xs">
                      Select All
                    </button>
                    <span class="text-zinc-600">|</span>
                    <button type="button" @click="selectNone" class="text-zinc-500 hover:text-zinc-400 text-xs">
                      Clear
                    </button>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex gap-3">
                  <button
                    type="button"
                    @click="closeDialog"
                    class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 text-sm"
                    :disabled="saving"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="saveAssignments"
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl font-semibold transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    :disabled="saving"
                  >
                    <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
                    {{ saving ? 'Saving...' : 'Save Assignments' }}
                  </button>
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
  import { Users, User, Check, Loader2 } from 'lucide-vue-next';
  import {
    assignProfile,
    unassignProfile,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';

  interface Member {
    id: number;
    user_id: number;
    role: string;
    user?: {
      id: number;
      email: string;
      name: string | null;
      avatar_url: string | null;
    };
  }

  interface Props {
    show: boolean;
    organizationId: string | number;
    profile: ServerOrganizationCreatorProfile | null;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'saved'): void;
  }>();

  const authStore = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();

  const loading = ref(false);
  const saving = ref(false);
  const members = ref<Member[]>([]);
  const selectedUserIds = ref<number[]>([]);
  const originalAssignedIds = ref<number[]>([]);

  watch(
    () => props.show,
    async (newVal) => {
      if (newVal && props.profile) {
        loading.value = true;

        try {
          // Load organization members
          const result = await authStore.getOrganizationMembers(props.organizationId);
          if (result.success) {
            members.value = result.members || [];
          }

          // Set initial assignments from profile
          originalAssignedIds.value = props.profile.assignments?.map((a) => a.user_id) || [];
          selectedUserIds.value = [...originalAssignedIds.value];
        } catch (err) {
          console.error('Failed to load members:', err);
        } finally {
          loading.value = false;
        }
      }
    }
  );

  function closeDialog() {
    if (!saving.value) {
      emit('close');
    }
  }

  function isAssigned(userId: number): boolean {
    return selectedUserIds.value.includes(userId);
  }

  function toggleAssignment(userId: number) {
    const index = selectedUserIds.value.indexOf(userId);
    if (index >= 0) {
      selectedUserIds.value.splice(index, 1);
    } else {
      selectedUserIds.value.push(userId);
    }
  }

  function selectAll() {
    selectedUserIds.value = members.value.map((m) => m.user_id);
  }

  function selectNone() {
    selectedUserIds.value = [];
  }

  async function saveAssignments() {
    if (!props.profile) return;

    saving.value = true;

    try {
      // Determine what changed
      const toAdd = selectedUserIds.value.filter((id) => !originalAssignedIds.value.includes(id));
      const toRemove = originalAssignedIds.value.filter((id) => !selectedUserIds.value.includes(id));

      // Add new assignments
      if (toAdd.length > 0) {
        const result = await assignProfile(props.organizationId, props.profile.id, toAdd);
        if (!result.success) {
          throw new Error(result.error || 'Failed to assign members');
        }
      }

      // Remove unassigned
      for (const userId of toRemove) {
        const result = await unassignProfile(props.organizationId, props.profile.id, userId);
        if (!result.success) {
          console.warn(`Failed to unassign user ${userId}:`, result.error);
        }
      }

      const changeCount = toAdd.length + toRemove.length;
      if (changeCount > 0) {
        showSuccess('Assignments Updated', `${toAdd.length} added, ${toRemove.length} removed`);
      }

      emit('saved');
      emit('close');
    } catch (err: any) {
      console.error('Failed to save assignments:', err);
      showError('Save Failed', err.message || 'An error occurred');
    } finally {
      saving.value = false;
    }
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
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: hsl(240 3.7% 15.9% / 0.5);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: hsl(240 3.7% 15.9% / 0.7);
  }
</style>

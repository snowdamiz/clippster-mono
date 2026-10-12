<template>
  <Modal
    :open="show"
    title="Manage assignments"
    :description="`Assign “${profile?.name ?? ''}” to team members`"
    :icon="Users"
    size="md"
    :dismissible="!saving"
    :hide-close="saving"
    flush
    @close="closeDialog"
  >
    <!-- Selection summary -->
    <div class="flex items-center justify-between gap-3 border-b border-line-subtle px-5 py-2">
      <span class="tabular text-xs text-fg-muted">
        {{ selectedUserIds.length }} of {{ members.length }} members selected
      </span>
      <div class="flex items-center gap-1">
        <Button type="button" variant="ghost" size="xs" :disabled="loading || saving" @click="selectAll">
          Select all
        </Button>
        <Button type="button" variant="ghost" size="xs" :disabled="loading || saving" @click="selectNone">
          Clear
        </Button>
      </div>
    </div>

    <div class="px-3 py-2">
      <!-- Loading State (always reloads: selections depend on the profile being edited) -->
      <div v-if="loading" class="flex flex-col gap-1" aria-busy="true">
        <div v-for="i in 4" :key="i" class="flex items-center gap-3 px-2.5 py-2">
          <div class="skeleton size-4 rounded" />
          <div class="skeleton size-8 rounded-full" />
          <div class="flex flex-1 flex-col gap-1.5">
            <div class="skeleton h-3 w-1/3" />
            <div class="skeleton h-2.5 w-1/2" />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-else-if="members.length === 0"
        size="sm"
        :icon="Users"
        title="No members"
        description="No members in this organization"
      />

      <!-- Member List -->
      <div v-else class="flex animate-fade-in flex-col gap-0.5">
        <MemberPickRow
          v-for="member in members"
          :key="member.user_id"
          :name="member.user?.name || member.user?.email || ''"
          :email="member.user?.name ? member.user.email : null"
          :avatar-url="member.user?.avatar_url"
          :role="member.role"
          :checked="isAssigned(member.user_id)"
          :disabled="saving"
          @toggle="toggleAssignment(member.user_id)"
        />
      </div>
    </div>

    <template #footer>
      <Button type="button" variant="ghost" :disabled="saving" @click="closeDialog">Cancel</Button>
      <Button type="button" variant="primary" :loading="saving" @click="saveAssignments">
        {{ saving ? 'Saving...' : 'Save assignments' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Users } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Modal } from '@/components/ui/modal';
  import MemberPickRow from '@/components/organization/shared/MemberPickRow.vue';
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
          const result = await authStore.getOrganizationMembers(String(props.organizationId));
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

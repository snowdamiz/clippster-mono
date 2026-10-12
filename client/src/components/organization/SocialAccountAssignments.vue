<template>
  <Modal :open="open" title="Manage access" size="md" flush @close="$emit('close')">
    <template #header>
      <header class="flex shrink-0 items-start gap-3 px-5 pb-1 pt-4 pr-12">
        <PlatformLogo :platform="account.platform" size="lg" class="mt-0.5" />
        <div class="min-w-0 flex-1">
          <h2 class="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-fg">Manage access</h2>
          <p class="mt-0.5 truncate text-sm text-fg-muted">
            Assign members who can use <span class="text-fg">@{{ account.username }}</span> to publish posts
          </p>
        </div>
      </header>
    </template>

    <div class="border-b border-line-subtle px-5 pb-3 pt-2">
      <SearchField v-model="searchQuery" placeholder="Search members..." />
    </div>

    <div class="px-3 py-2">
      <div v-if="filteredMembers.length > 0" class="flex flex-col gap-0.5">
        <MemberPickRow
          v-for="member in filteredMembers"
          :key="member.user_id"
          :name="member.user?.name || member.user?.email || ''"
          :email="member.user?.name ? member.user?.email : null"
          :avatar-url="member.user?.avatar_url"
          :role="member.role"
          :checked="isAssigned(member.user_id)"
          :disabled="saving"
          @toggle="toggleAssignment(member.user_id, !isAssigned(member.user_id))"
        />
      </div>

      <!-- Empty Search State -->
      <EmptyState
        v-else-if="searchQuery"
        size="sm"
        :icon="Search"
        title="No matches"
        description="No members match your search"
      />

      <!-- Empty State -->
      <EmptyState
        v-else-if="members.length === 0"
        size="sm"
        :icon="Users"
        title="No members"
        description="No members in this organization"
      />
    </div>

    <template #footer>
      <span class="tabular mr-auto text-xs text-fg-muted">
        {{ assignedCount }} member{{ assignedCount !== 1 ? 's' : '' }} assigned
      </span>
      <Button variant="primary" @click="$emit('close')">Done</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Search, Users } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Modal } from '@/components/ui/modal';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import { SearchField } from '@/components/ui/search-field';
  import MemberPickRow from './shared/MemberPickRow.vue';
  import { useToast } from '@/composables/useToast';
  import { assignSocialAccount, unassignSocialAccount, type SocialAccount } from '@/services/socialAccountsApi';

  interface Member {
    id: number;
    user_id: number;
    role: string;
    user?: {
      id: number;
      email: string;
      name?: string;
      avatar_url?: string;
      created_by_organization_id?: number;
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
      const name = member.user?.name?.toLowerCase() || '';
      const email = member.user?.email.toLowerCase() || '';
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
</script>

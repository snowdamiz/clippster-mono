<template>
  <Dialog :open="open" @update:open="$emit('close')">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Instagram class="h-5 w-5 text-pink-500" />
          Manage Access - @{{ account.username }}
        </DialogTitle>
        <DialogDescription>Assign members who can use this account to publish posts</DialogDescription>
      </DialogHeader>

      <div class="py-4">
        <!-- Search/Filter -->
        <div class="relative mb-4">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Search members..." class="pl-9" />
        </div>

        <!-- Members List -->
        <div class="space-y-2 max-h-[300px] overflow-y-auto">
          <div
            v-for="member in filteredMembers"
            :key="member.user_id"
            class="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer"
            :class="{ 'opacity-50 pointer-events-none': saving }"
            @click="toggleAssignment(member.user_id, !isAssigned(member.user_id))"
          >
            <!-- Checkbox -->
            <Checkbox :checked="isAssigned(member.user_id)" class="pointer-events-none" />

            <!-- Member Avatar -->
            <div class="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <img
                v-if="member.user.avatar_url"
                :src="member.user.avatar_url"
                :alt="member.user.name || member.user.email"
                class="w-8 h-8 rounded-full object-cover"
              />
              <span v-else class="text-xs font-medium text-muted-foreground">
                {{ getInitials(member.user.name || member.user.email) }}
              </span>
            </div>

            <!-- Member Info -->
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm text-foreground truncate">
                {{ member.user.name || member.user.email }}
              </div>
              <div v-if="member.user.name" class="text-xs text-muted-foreground truncate">
                {{ member.user.email }}
              </div>
            </div>

            <!-- Role Badge -->
            <span
              :class="[
                'px-2 py-0.5 rounded text-xs font-medium',
                member.role === 'owner'
                  ? 'bg-amber-500/20 text-amber-500'
                  : member.role === 'admin'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground',
              ]"
            >
              {{ member.role }}
            </span>
          </div>

          <!-- Empty Search State -->
          <div v-if="filteredMembers.length === 0 && searchQuery" class="text-center py-8 text-muted-foreground">
            No members match your search
          </div>

          <!-- Empty State -->
          <div v-if="members.length === 0" class="text-center py-8 text-muted-foreground">
            No members in this organization
          </div>
        </div>
      </div>

      <DialogFooter>
        <div class="flex items-center justify-between w-full">
          <span class="text-sm text-muted-foreground">
            {{ assignedCount }} member{{ assignedCount !== 1 ? 's' : '' }} can use this account
          </span>
          <Button variant="outline" @click="$emit('close')">Done</Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Instagram, Search } from 'lucide-vue-next';
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
</script>

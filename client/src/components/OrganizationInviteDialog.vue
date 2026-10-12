<template>
  <Modal
    :open="modelValue"
    title="Organization invitation"
    description="You've been invited to join an organization"
    :icon="Users"
    size="md"
    :dismissible="!isProcessing"
    :hide-close="isProcessing"
    @close="close"
  >
    <div v-if="invitation" class="flex flex-col gap-3">
      <!-- Organization -->
      <div class="flex items-center gap-3">
        <Avatar
          :src="invitation.organization_logo"
          :name="invitation.organization_name"
          :icon="Building2"
          shape="square"
        />
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-sm font-semibold text-fg">{{ invitation.organization_name }}</h3>
          <p class="text-xs text-fg-muted">
            Join as <Badge variant="neutral" class="ml-0.5 capitalize">{{ invitation.role }}</Badge>
          </p>
        </div>
      </div>

      <!-- Details -->
      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt class="flex items-center gap-1.5 text-fg-subtle"><UserCircle class="size-3.5" /> Invited by</dt>
        <dd class="truncate text-fg">{{ invitation.inviter_name || 'Organization Admin' }}</dd>
        <dt class="flex items-center gap-1.5 text-fg-subtle"><Clock class="size-3.5" /> Expires</dt>
        <dd class="text-fg">{{ formatExpiryDate(invitation.expires_at) }}</dd>
      </dl>

      <p class="text-sm text-fg-muted">
        <span class="font-medium text-fg">{{ invitation.inviter_name || 'An organization admin' }}</span>
        invited you to join
        <span class="font-medium text-fg">{{ invitation.organization_name }}</span>
        to become a member of their organization.
      </p>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="isProcessing" @click="decline">Decline</Button>
      <Button variant="primary" :loading="isProcessing" @click="accept">
        <Check v-if="!isProcessing" />
        Accept invitation
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Users, Building2, UserCircle, Clock, Check } from 'lucide-vue-next';
  import { Avatar } from '@/components/ui/avatar';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Modal } from '@/components/ui/modal';
  import type { OrganizationInvitation } from '@/services/organizationsApi';

  interface Props {
    modelValue: boolean;
    invitation: OrganizationInvitation | null;
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void;
    (e: 'accept', invitation: OrganizationInvitation): void;
    (e: 'decline', invitation: OrganizationInvitation): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const isProcessing = ref(false);

  // Reset processing state when dialog closes
  watch(() => props.modelValue, (open) => {
    if (!open) {
      isProcessing.value = false;
    }
  });

  const close = () => {
    if (!isProcessing.value) {
      emit('update:modelValue', false);
    }
  };

  const accept = () => {
    if (props.invitation && !isProcessing.value) {
      isProcessing.value = true;
      emit('accept', props.invitation);
    }
  };

  const decline = () => {
    if (props.invitation && !isProcessing.value) {
      emit('decline', props.invitation);
      close();
    }
  };

  const formatExpiryDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `${diffDays} days`;
    return date.toLocaleDateString();
  };
</script>

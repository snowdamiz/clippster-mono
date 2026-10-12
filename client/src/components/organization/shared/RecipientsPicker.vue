<script setup lang="ts">
  /**
   * "Who receives this?" block for the share dialogs: a share-with-everyone
   * switch and, when off, a checklist of members.
   *
   *   <RecipientsPicker v-model:share-with-all="shareWithAll" v-model:selected="ids" :members="members" />
   */
  import { Switch } from '@/components/ui/switch';
  import MemberPickRow from './MemberPickRow.vue';

  defineProps<{
    members: Array<{ user_id: number; user: { id: number; name: string | null; email: string } }>;
    disabled?: boolean;
  }>();

  const shareWithAll = defineModel<boolean>('shareWithAll', { required: true });
  const selected = defineModel<number[]>('selected', { required: true });

  function toggle(userId: number) {
    selected.value = selected.value.includes(userId)
      ? selected.value.filter((id) => id !== userId)
      : [...selected.value, userId];
  }
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
    <label class="flex cursor-pointer items-center justify-between gap-4 px-3.5 py-3">
      <span class="min-w-0">
        <span class="block text-sm font-medium text-fg">Share with all members</span>
        <span class="block text-xs text-fg-subtle">
          {{ shareWithAll ? 'Everyone in the organization gets access' : `${selected.length} member(s) selected` }}
        </span>
      </span>
      <Switch v-model="shareWithAll" :disabled="disabled" />
    </label>

    <div v-if="!shareWithAll" class="max-h-[200px] overflow-y-auto border-t border-line-subtle p-1.5">
      <MemberPickRow
        v-for="member in members"
        :key="member.user_id"
        compact
        :name="member.user.name || member.user.email"
        :email="member.user.email"
        :checked="selected.includes(member.user_id)"
        :disabled="disabled"
        @toggle="toggle(member.user_id)"
      />
      <p v-if="members.length === 0" class="px-2.5 py-3 text-xs text-fg-subtle">No members in this organization</p>
    </div>
  </div>
</template>

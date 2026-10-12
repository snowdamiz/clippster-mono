<script setup lang="ts">
  /**
   * Organization campaign card: the shared `CampaignCard` (so org and public
   * campaign lists look the same) with the join type in the meta line (instead
   * of the organization's own name) and the admin actions (edit, status
   * changes, delete) at the end of the title row.
   */
  import { CheckCircle, MoreHorizontal, Pause, Pencil, Play, Trash2 } from 'lucide-vue-next';
  import CampaignCard from '@/components/campaigns/CampaignCard.vue';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import type { Campaign } from '@/services/campaignApi';

  defineProps<{
    campaign: Campaign;
    isAdmin: boolean;
  }>();

  const emit = defineEmits<{
    view: [];
    edit: [];
    activate: [];
    pause: [];
    complete: [];
    delete: [];
  }>();
</script>

<template>
  <CampaignCard :campaign="campaign" class="h-full" @open="emit('view')">
    <template #meta>
      <span class="truncate" :title="campaign.join_type === 'open' ? 'Open to all' : 'Application required'">
        {{ campaign.join_type === 'open' ? 'Open' : 'Apply' }}
      </span>
    </template>

    <template v-if="isAdmin" #actions>
      <div class="-my-1 -mr-1.5 flex shrink-0 items-center" @click.stop @keydown.enter.stop>
        <Button variant="ghost" size="icon-xs" title="Edit" aria-label="Edit campaign" @click="emit('edit')">
          <Pencil />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon-xs" title="More actions" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="min-w-40">
            <DropdownMenuItem v-if="campaign.status === 'draft'" @click="emit('activate')">
              <Play />
              Activate
            </DropdownMenuItem>
            <DropdownMenuItem v-if="campaign.status === 'active'" @click="emit('pause')">
              <Pause />
              Pause
            </DropdownMenuItem>
            <DropdownMenuItem v-if="campaign.status === 'paused'" @click="emit('activate')">
              <Play />
              Resume
            </DropdownMenuItem>
            <DropdownMenuItem v-if="campaign.status !== 'completed'" @click="emit('complete')">
              <CheckCircle />
              Complete
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="text-danger focus:bg-danger-soft [&>svg]:!text-danger" @click="emit('delete')">
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </template>
  </CampaignCard>
</template>

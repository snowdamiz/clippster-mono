<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
        @click.self="handleCancel"
      >
        <Transition name="dialog" appear>
          <div class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden">
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

            <div class="p-5 sm:p-6">
              <!-- Header -->
              <div class="mb-5 text-center">
                <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-4">
                  <Megaphone class="h-6 w-6 text-violet-400" />
                </div>
                <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {{ campaigns.length === 1 ? 'Campaign Clip?' : 'Select Campaign' }}
                </h2>
                <p class="text-zinc-400 text-sm mt-1">
                  {{ campaigns.length === 1 
                    ? 'This creator is part of a campaign you joined.'
                    : 'This creator is part of multiple campaigns you joined.' 
                  }}
                </p>
              </div>

              <!-- Single Campaign Confirmation -->
              <div v-if="campaigns.length === 1" class="space-y-4">
                <div class="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-primary/10 overflow-hidden flex-shrink-0">
                      <img
                        v-if="campaigns[0].cover_image_url"
                        :src="campaigns[0].cover_image_url"
                        class="w-full h-full object-cover"
                      />
                      <Megaphone v-else class="w-full h-full p-2 text-primary/40" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-white truncate">{{ campaigns[0].title }}</div>
                      <div class="text-xs text-zinc-500">
                        {{ campaigns[0].organization?.name }} · ${{ formatCpm(campaigns[0].cpm) }}/1K views
                      </div>
                    </div>
                  </div>
                </div>

                <p class="text-sm text-zinc-400 text-center">
                  Campaign assets (watermark, intro/outro) will be applied automatically.
                </p>

                <div class="flex gap-3">
                  <button
                    @click="handleNoCampaign"
                    class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 text-sm"
                  >
                    No, regular clip
                  </button>
                  <button
                    @click="handleSelectCampaign(campaigns[0])"
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold transition-all text-sm"
                  >
                    Yes, for campaign
                  </button>
                </div>
              </div>

              <!-- Multiple Campaigns Selection -->
              <div v-else class="space-y-4">
                <div class="space-y-2 max-h-64 overflow-y-auto">
                  <button
                    v-for="campaign in campaigns"
                    :key="campaign.id"
                    @click="selectedCampaignId = campaign.id"
                    class="w-full p-3 rounded-xl border transition-all text-left flex items-center gap-3"
                    :class="selectedCampaignId === campaign.id
                      ? 'bg-violet-500/20 border-violet-500/50'
                      : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800'"
                  >
                    <div class="w-10 h-10 rounded-lg bg-primary/10 overflow-hidden flex-shrink-0">
                      <img
                        v-if="campaign.cover_image_url"
                        :src="campaign.cover_image_url"
                        class="w-full h-full object-cover"
                      />
                      <Megaphone v-else class="w-full h-full p-2 text-primary/40" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-white truncate">{{ campaign.title }}</div>
                      <div class="text-xs text-zinc-500">
                        {{ campaign.organization?.name }} · ${{ formatCpm(campaign.cpm) }}/1K views
                      </div>
                    </div>
                    <div
                      class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      :class="selectedCampaignId === campaign.id
                        ? 'border-violet-500 bg-violet-500'
                        : 'border-zinc-600'"
                    >
                      <Check v-if="selectedCampaignId === campaign.id" class="w-3 h-3 text-white" />
                    </div>
                  </button>

                  <!-- No campaign option -->
                  <button
                    @click="selectedCampaignId = null"
                    class="w-full p-3 rounded-xl border transition-all text-left flex items-center gap-3"
                    :class="selectedCampaignId === null
                      ? 'bg-zinc-700/50 border-zinc-500'
                      : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800'"
                  >
                    <div class="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center flex-shrink-0">
                      <X class="w-5 h-5 text-zinc-400" />
                    </div>
                    <div class="flex-1">
                      <div class="font-medium text-white">No campaign</div>
                      <div class="text-xs text-zinc-500">Regular clip without campaign assets</div>
                    </div>
                    <div
                      class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      :class="selectedCampaignId === null
                        ? 'border-zinc-500 bg-zinc-500'
                        : 'border-zinc-600'"
                    >
                      <Check v-if="selectedCampaignId === null" class="w-3 h-3 text-white" />
                    </div>
                  </button>
                </div>

                <div class="flex gap-3">
                  <button
                    @click="handleCancel"
                    class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    @click="handleConfirmSelection"
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold transition-all text-sm"
                  >
                    Continue
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
import { Megaphone, Check, X } from 'lucide-vue-next';
import type { Campaign } from '@/services/campaignApi';

const props = defineProps<{
  isOpen: boolean;
  campaigns: Campaign[];
}>();

const emit = defineEmits<{
  (e: 'select', campaign: Campaign | null): void;
  (e: 'cancel'): void;
}>();

const selectedCampaignId = ref<number | null>(null);

watch(() => props.isOpen, (open) => {
  if (open && props.campaigns.length > 0) {
    selectedCampaignId.value = props.campaigns[0].id;
  }
});

const formatCpm = (cpm: string | number) => {
  const value = typeof cpm === 'string' ? parseFloat(cpm) : cpm;
  return value.toFixed(2);
};

const handleSelectCampaign = (campaign: Campaign) => {
  emit('select', campaign);
};

const handleNoCampaign = () => {
  emit('select', null);
};

const handleConfirmSelection = () => {
  if (selectedCampaignId.value === null) {
    emit('select', null);
  } else {
    const campaign = props.campaigns.find(c => c.id === selectedCampaignId.value);
    emit('select', campaign || null);
  }
};

const handleCancel = () => {
  emit('cancel');
};
</script>

<style scoped>
/* Modal transition */
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
</style>

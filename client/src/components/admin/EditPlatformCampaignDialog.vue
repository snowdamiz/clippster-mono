<template>
  <Modal
    :open="modelValue"
    title="Edit platform campaign"
    description="Update campaign details"
    :icon="Pencil"
    :dismissible="!isProcessing"
    @update:open="(open) => !open && close()"
  >
    <PlatformCampaignFields
      v-model:title="form.title"
      v-model:description="form.description"
      v-model:starts-at="form.starts_at"
      v-model:ends-at="form.ends_at"
    >
      <Field label="Status">
        <CustomDropdown v-model="form.status" :options="statusOptions" placeholder="Select status" />
      </Field>
    </PlatformCampaignFields>

    <Alert v-if="error" variant="destructive" class="mt-4">
      <AlertTriangle />
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <template #footer>
      <Button variant="ghost" :disabled="isProcessing" @click="close">Cancel</Button>
      <Button variant="primary" :loading="isProcessing" :disabled="!canUpdate || isProcessing" @click="updateCampaign">
        {{ isProcessing ? 'Saving…' : 'Save changes' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Pencil, AlertTriangle } from 'lucide-vue-next';
import api from '@/services/api';
import CustomDropdown from '@/components/CustomDropdown.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import PlatformCampaignFields from './PlatformCampaignFields.vue';

interface Campaign {
  id: number;
  title: string;
  description: string;
  status: string;
  starts_at: string;
  ends_at: string;
}

interface Props {
  modelValue: boolean;
  campaign: Campaign | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  updated: [];
}>();

const isProcessing = ref(false);
const error = ref('');

const statuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' }
];

const form = ref({
  title: '',
  description: '',
  status: 'active',
  starts_at: '',
  ends_at: ''
});

const statusOptions = statuses.map((status) => ({ label: status.label, value: status.value }));

const canUpdate = computed(() => form.value.title.length >= 3);

function close() {
  if (!isProcessing.value) {
    emit('update:modelValue', false);
  }
}

async function updateCampaign() {
  if (!canUpdate.value || !props.campaign) return;

  isProcessing.value = true;
  error.value = '';

  try {
    await api.put(`/admin/platform-campaigns/${props.campaign.id}`, form.value);
    emit('updated');
    emit('update:modelValue', false);
  } catch (err: any) {
    console.error('Failed to update campaign:', err);
    error.value = err.response?.data?.error || err.message || 'Failed to update campaign';
  } finally {
    isProcessing.value = false;
  }
}

watch(() => props.campaign, (campaign) => {
  if (campaign) {
    form.value = {
      title: campaign.title || '',
      description: campaign.description || '',
      status: campaign.status || 'active',
      starts_at: campaign.starts_at || '',
      ends_at: campaign.ends_at || ''
    };
  }
}, { immediate: true });
</script>

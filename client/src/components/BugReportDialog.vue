<template>
  <Modal
    :open="show"
    title="Report a bug"
    description="Help us improve by reporting issues."
    :icon="Bug"
    size="md"
    :dismissible="!submitting"
    :hide-close="submitting"
    @close="$emit('close')"
  >
    <form id="bug-report-form" class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <Field label="Title" for="bug-report-title" required>
        <Input
          id="bug-report-title"
          v-model="form.title"
          type="text"
          required
          placeholder="Brief description of the bug"
        />
      </Field>

      <Field label="Description" for="bug-report-description" required>
        <Textarea
          id="bug-report-description"
          v-model="form.description"
          required
          rows="3"
          placeholder="Describe the bug in detail, including steps to reproduce it"
          class="resize-none"
        />
      </Field>

      <Field label="Severity">
        <CustomDropdown v-model="form.severity" :options="severityOptions" placeholder="Select severity" />
      </Field>

      <div class="grid grid-cols-2 gap-3">
        <Field for="bug-report-expected">
          <template #label>Expected behavior <span class="font-normal text-fg-subtle">(optional)</span></template>
          <Textarea
            id="bug-report-expected"
            v-model="form.expected_behavior"
            rows="3"
            placeholder="What should have happened"
            class="resize-none"
          />
        </Field>

        <Field for="bug-report-actual">
          <template #label>Actual behavior <span class="font-normal text-fg-subtle">(optional)</span></template>
          <Textarea
            id="bug-report-actual"
            v-model="form.actual_behavior"
            rows="3"
            placeholder="What actually happened"
            class="resize-none"
          />
        </Field>
      </div>

      <Alert v-if="error" ref="statusAlert" variant="destructive">
        <AlertCircle />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <Alert v-if="success" ref="statusAlert" variant="success">
        <CheckCircle />
        <AlertDescription>{{ success }}</AlertDescription>
      </Alert>
    </form>

    <template #footer>
      <Button variant="ghost" :disabled="submitting" @click="$emit('close')">Cancel</Button>
      <Button type="submit" form="bug-report-form" variant="primary" :loading="submitting" :disabled="!formIsValid">
        {{ submitting ? 'Submitting...' : 'Submit report' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch, nextTick } from 'vue';
  import { Bug, AlertCircle, CheckCircle } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import api from '@/services/api';

  interface Props {
    show: boolean;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'submitted'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const authStore = useAuthStore();
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const success = ref<string | null>(null);

  const form = ref({
    title: '',
    description: '',
    severity: 'medium',
    expected_behavior: '',
    actual_behavior: '',
  });

  const severityOptions = [
    { label: 'Low — minor inconvenience', value: 'low' },
    { label: 'Medium — feature not working correctly', value: 'medium' },
    { label: 'High — major functionality broken', value: 'high' },
    { label: 'Critical — app unusable or data loss', value: 'critical' },
  ];

  const formIsValid = computed(() => {
    return form.value.title.trim() !== '' && form.value.description.trim() !== '';
  });

  const resetForm = () => {
    form.value = {
      title: '',
      description: '',
      severity: 'medium',
      expected_behavior: '',
      actual_behavior: '',
    };
    error.value = null;
    success.value = null;
    submitting.value = false;
  };

  const handleSubmit = async () => {
    if (!formIsValid.value || submitting.value) return;

    submitting.value = true;
    error.value = null;
    success.value = null;

    try {
      const requestBody = {
        title: form.value.title.trim(),
        description: form.value.description.trim(),
        severity: form.value.severity,
        expected_behavior: form.value.expected_behavior.trim() || null,
        actual_behavior: form.value.actual_behavior.trim() || null,
        user_wallet_address: authStore.walletAddress,
      };

      const response = await api.post('/bug-reports', requestBody);

      const data = response.data;

      if (data.success) {
        success.value = 'Bug report submitted successfully! Thank you for helping us improve.';
        // Close dialog after a short delay to show success message
        setTimeout(() => {
          resetForm();
          emit('close');
          emit('submitted');
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to submit bug report');
      }
    } catch (err) {
      console.error('Bug report submission error:', err);
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred while submitting the bug report';
    } finally {
      submitting.value = false;
    }
  };

  // Keep the result message visible when the form is taller than the dialog body
  const statusAlert = ref<{ $el?: HTMLElement } | null>(null);
  watch([error, success], async () => {
    await nextTick();
    statusAlert.value?.$el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  });

  // Reset form when dialog opens/closes
  watch(
    () => props.show,
    (newShow) => {
      if (!newShow) {
        resetForm();
      }
    }
  );
</script>

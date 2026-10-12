<template>
  <Modal
    :open="show"
    :title="props.application ? 'Edit organization account' : 'Apply for organization account'"
    :description="props.application ? 'Update your application' : 'Tell us about your organization'"
    :icon="Building2"
    size="lg"
    :dismissible="!submitting"
    :hide-close="submitting"
    @close="$emit('close')"
  >
    <form id="org-application-form" class="flex flex-col gap-4" novalidate @submit.prevent="handleSubmit">
      <Field label="Organization name" for="org-name" required>
        <Input id="org-name" v-model="form.name" type="text" required placeholder="e.g., Acme Studios" />
      </Field>

      <Field label="Description" for="description" required hint="Minimum 10 characters.">
        <Textarea
          id="description"
          v-model="form.description"
          required
          minlength="10"
          rows="3"
          class="resize-none"
          placeholder="Brief description of your organization"
        />
      </Field>

      <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Field label="Contact email" for="contact-email" required>
          <Input id="contact-email" v-model="form.contact_email" type="email" required placeholder="your@email.com" />
        </Field>

        <Field label="Expected team size" for="team-size" required>
          <CustomDropdown
            id="team-size"
            v-model="form.team_size"
            :options="teamSizeOptions"
            placeholder="Select team size"
          />
        </Field>
      </div>

      <Field for="website">
        <template #label>
          Website or social media link
          <span class="font-normal text-fg-subtle">(optional)</span>
        </template>
        <Input
          id="website"
          v-model="form.website"
          type="url"
          placeholder="https://example.com or https://twitter.com/username"
        />
      </Field>

      <Field label="Use case" for="use-case" required hint="Minimum 10 characters.">
        <Textarea
          id="use-case"
          v-model="form.use_case"
          required
          minlength="10"
          rows="3"
          class="resize-none"
          placeholder="How will your organization use Clippster? What are your primary goals?"
        />
      </Field>

      <Field>
        <template #label>
          Organization logo
          <span class="font-normal text-fg-subtle">(optional)</span>
        </template>
        <div class="flex items-center gap-3">
          <Avatar :src="logoPreview" :icon="Building2" shape="square" />
          <input ref="logoInputRef" type="file" accept="image/*" class="hidden" @change="handleLogoUpload" />
          <Button type="button" variant="secondary" size="sm" :loading="uploadingLogo" @click="logoInputRef?.click()">
            <Upload v-if="!uploadingLogo" />
            {{ uploadingLogo ? 'Uploading...' : logoPreview ? 'Change logo' : 'Upload logo' }}
          </Button>
          <span class="text-xs text-fg-subtle">PNG, JPG or SVG (max 5MB)</span>
        </div>
      </Field>

      <Alert v-if="error" variant="destructive">
        <AlertCircle />
        <AlertDescription class="text-fg">{{ error }}</AlertDescription>
      </Alert>

      <Alert v-if="success" variant="success">
        <CheckCircle />
        <AlertDescription class="text-fg">{{ success }}</AlertDescription>
      </Alert>
    </form>

    <template #footer>
      <Button variant="ghost" :disabled="submitting" @click="$emit('close')">Cancel</Button>
      <Button
        variant="primary"
        type="submit"
        form="org-application-form"
        :disabled="!formIsValid"
        :loading="submitting"
      >
        {{
          submitting
            ? props.application
              ? 'Updating...'
              : 'Submitting...'
            : props.application
              ? 'Update application'
              : 'Submit application'
        }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Building2, AlertCircle, CheckCircle, Upload } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Avatar } from '@/components/ui/avatar';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { Textarea } from '@/components/ui/textarea';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import api from '@/services/api';

  interface Props {
    show: boolean;
    application?: any | null;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'submitted'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const authStore = useAuthStore();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const success = ref<string | null>(null);
  const logoInputRef = ref<HTMLInputElement | null>(null);
  const logoPreview = ref<string | null>(null);
  const uploadingLogo = ref(false);
  const uploadedLogoUrl = ref<string | null>(null);
  const pendingLogoFile = ref<File | null>(null);

  const form = ref({
    name: '',
    description: '',
    website: '',
    team_size: '',
    use_case: '',
    contact_email: authStore.user?.email || '',
  });

  const teamSizeOptions = [
    { label: '1-5 members', value: '1-5' },
    { label: '6-10 members', value: '6-10' },
    { label: '11-25 members', value: '11-25' },
    { label: '26-50 members', value: '26-50' },
    { label: '51+ members', value: '51+' },
  ];

  const formIsValid = computed(() => {
    return (
      form.value.name.trim().length >= 2 &&
      form.value.description.trim().length >= 10 &&
      form.value.team_size !== '' &&
      form.value.use_case.trim().length >= 10 &&
      form.value.contact_email.trim() !== '' &&
      form.value.contact_email.includes('@')
    );
  });

  const resetForm = () => {
    form.value = {
      name: '',
      description: '',
      website: '',
      team_size: '',
      use_case: '',
      contact_email: authStore.user?.email || '',
    };
    logoPreview.value = null;
    uploadedLogoUrl.value = null;
    pendingLogoFile.value = null;
    error.value = null;
    success.value = null;
    submitting.value = false;
  };

  async function handleLogoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showErrorToast('File Too Large', 'Logo must be less than 5MB');
      input.value = '';
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showErrorToast('Invalid File', 'Please select an image file');
      input.value = '';
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      logoPreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // If editing existing application, upload immediately
    if (props.application?.id) {
      uploadingLogo.value = true;
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post(`/organization-applications/${props.application.id}/logo`, formData, {
          headers: {
            'Content-Type': undefined,
          },
        });

        if (response.data.success && response.data.url) {
          uploadedLogoUrl.value = response.data.logo_url; // Store the raw URL
          showSuccessToast('Logo Uploaded', 'Logo has been uploaded successfully');
        } else {
          showErrorToast('Upload Failed', response.data.error || 'Failed to upload logo');
          logoPreview.value = null;
        }
      } catch (err: any) {
        console.error('Logo upload error:', err);
        showErrorToast('Upload Failed', err.response?.data?.error || 'Failed to upload logo');
        logoPreview.value = null;
      } finally {
        uploadingLogo.value = false;
        input.value = '';
      }
    } else {
      // For new applications, store the file to upload after creation
      pendingLogoFile.value = file;
      input.value = '';
    }
  }

  const handleSubmit = async () => {
    if (!formIsValid.value || submitting.value) return;

    submitting.value = true;
    error.value = null;
    success.value = null;

    try {
      const requestBody = {
        name: form.value.name.trim(),
        description: form.value.description.trim(),
        website: form.value.website.trim() || null,
        team_size: form.value.team_size,
        use_case: form.value.use_case.trim(),
        contact_email: form.value.contact_email.trim(),
      };

      let response;
      if (props.application) {
        // Update existing application
        response = await api.put(`/organization-applications/${props.application.id}`, requestBody);
      } else {
        // Create new application
        response = await api.post('/organization-applications', requestBody);
      }

      const data = response.data;

      if (data.success) {
        // If new application and we have a pending logo file, upload it now
        if (!props.application && pendingLogoFile.value && data.application?.id) {
          uploadingLogo.value = true;
          try {
            const logoFormData = new FormData();
            logoFormData.append('file', pendingLogoFile.value);

            await api.post(`/organization-applications/${data.application.id}/logo`, logoFormData, {
              headers: {
                'Content-Type': undefined,
              },
            });
          } catch (logoErr) {
            console.error('Failed to upload logo after application creation:', logoErr);
            // Don't fail the whole process if logo upload fails
          } finally {
            uploadingLogo.value = false;
            pendingLogoFile.value = null;
          }
        }

        const message = props.application
          ? 'Your application has been updated successfully'
          : 'We will review your application and get back to you soon';
        success.value = `Application ${props.application ? 'updated' : 'submitted'} successfully! ${message}`;
        showSuccessToast(props.application ? 'Application Updated' : 'Application Submitted', message);
        // Close dialog after a short delay to show success message
        setTimeout(() => {
          resetForm();
          emit('close');
          emit('submitted');
        }, 1500);
      } else {
        throw new Error(data.error || `Failed to ${props.application ? 'update' : 'submit'} application`);
      }
    } catch (err: any) {
      console.error('Organization application submission error:', err);

      // Extract detailed error messages from backend
      if (err.response?.data?.details) {
        const details = err.response.data.details;
        const errorMessages = [];

        for (const [field, messages] of Object.entries(details)) {
          if (Array.isArray(messages)) {
            errorMessages.push(`${field}: ${messages.join(', ')}`);
          }
        }

        error.value =
          errorMessages.length > 0
            ? errorMessages.join('; ')
            : err.response.data.error || `Failed to ${props.application ? 'update' : 'submit'} application`;
      } else if (err.response?.data?.error) {
        error.value = err.response.data.error;
      } else {
        error.value =
          err instanceof Error
            ? err.message
            : `An unexpected error occurred while ${props.application ? 'updating' : 'submitting'} your application`;
      }
    } finally {
      submitting.value = false;
    }
  };

  // Reset form when dialog opens/closes
  watch(
    () => props.show,
    (newShow) => {
      if (newShow) {
        if (props.application) {
          // Pre-fill form with existing application data
          form.value = {
            name: props.application.name,
            description: props.application.description,
            website: props.application.website || '',
            team_size: props.application.team_size,
            use_case: props.application.use_case,
            contact_email: props.application.contact_email,
          };
          // Set logo preview if exists (presigned URL from backend)
          logoPreview.value = props.application.logo_url || null;
          uploadedLogoUrl.value = props.application.logo_url || null;
        } else {
          // Pre-fill email for new application
          form.value.contact_email = authStore.user?.email || '';
        }
      } else {
        resetForm();
      }
    }
  );
</script>

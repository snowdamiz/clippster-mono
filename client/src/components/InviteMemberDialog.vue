<template>
  <Modal
    :open="modelValue"
    title="Add team member"
    description="Invite someone to join your organization"
    :icon="UserPlus"
    size="md"
    @update:open="emit('update:modelValue', $event)"
  >
    <form id="invite-member-form" class="flex flex-col gap-4" novalidate @submit.prevent="canSubmit && submit()">
      <SegmentedControl v-model="mode" :options="modeOptions" block />

      <!-- Keyed by mode so switching eases in instead of popping -->
      <div :key="mode" class="flex animate-enter flex-col gap-4">
        <!-- Invite Mode -->
        <template v-if="mode === 'invite'">
          <p class="text-xs text-fg-muted">
            Send an email invitation to an existing Clippster user. The email must be associated with an active account.
          </p>

          <Field label="Email address" for="invite-email">
            <Input id="invite-email" v-model="inviteData.email" type="email" placeholder="colleague@example.com" />
          </Field>

          <Field label="Role" for="invite-role">
            <CustomDropdown id="invite-role" v-model="inviteData.role" :options="roleOptions" placeholder="Select role" />
          </Field>
        </template>

        <!-- Create Account Mode -->
        <template v-else>
          <p class="text-xs text-fg-muted">
            Create an account directly for a team member. You'll share the login credentials with them.
          </p>

          <Field label="Full name" for="create-name">
            <Input id="create-name" v-model="createData.name" type="text" placeholder="John Doe" />
          </Field>

          <Field label="Email address" for="create-email">
            <Input id="create-email" v-model="createData.email" type="email" placeholder="newmember@example.com" />
          </Field>

          <Field label="Password" for="create-password" hint="At least 8 characters.">
            <template #label-end>
              <Button type="button" variant="link" size="xs" class="h-auto px-0" @click="generatePassword">
                <Sparkles />
                Generate secure password
              </Button>
            </template>
            <div class="relative">
              <Input
                id="create-password"
                v-model="createData.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Temporary password"
                class="pr-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                class="absolute right-1 top-1/2 -translate-y-1/2"
                :title="showPassword ? 'Hide password' : 'Show password'"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" />
                <Eye v-else />
              </Button>
            </div>
          </Field>

          <Field label="Role" for="create-role">
            <CustomDropdown id="create-role" v-model="createData.role" :options="roleOptions" placeholder="Select role" />
          </Field>
        </template>
      </div>
    </form>

    <template #footer>
      <Button variant="ghost" @click="close">Cancel</Button>
      <Button variant="primary" type="submit" form="invite-member-form" :disabled="!canSubmit">
        {{ mode === 'invite' ? 'Send invitation' : 'Create account' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Mail, UserPlus, UserCog, Eye, EyeOff, Sparkles } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import CustomDropdown from '@/components/CustomDropdown.vue';

  const props = defineProps<{
    modelValue: boolean;
    organizationId: number | string;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    memberAdded: [];
  }>();

  const authStore = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();

  const mode = ref<'invite' | 'create'>('invite');
  const showPassword = ref(false);

  const inviteData = ref({
    email: '',
    role: 'member',
  });

  const createData = ref({
    name: '',
    email: '',
    password: '',
    role: 'member',
  });

  const roleOptions = [
    { label: 'Member', value: 'member' },
    { label: 'Admin', value: 'admin' },
  ];

  const modeOptions: SegmentedOption<'invite' | 'create'>[] = [
    { value: 'invite', label: 'Send invite', icon: Mail },
    { value: 'create', label: 'Create account', icon: UserCog },
  ];

  const canSubmit = computed(() => {
    if (mode.value === 'invite') {
      return inviteData.value.email.includes('@') && inviteData.value.email.includes('.');
    } else {
      return (
        createData.value.email.includes('@') &&
        createData.value.email.includes('.') &&
        createData.value.password.length >= 8
      );
    }
  });

  // Reset form when dialog opens/closes
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (!isOpen) {
        setTimeout(() => {
          mode.value = 'invite';
          inviteData.value = { email: '', role: 'member' };
          createData.value = { name: '', email: '', password: '', role: 'member' };
        }, 300);
      }
    }
  );

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    createData.value.password = password;
    showPassword.value = true;
  }

  function submit() {
    if (mode.value === 'invite') {
      // Invite mode: close dialog immediately and process in background
      const email = inviteData.value.email;
      const role = inviteData.value.role;

      // Close dialog immediately
      emit('update:modelValue', false);

      // Process in background
      authStore
        .inviteOrganizationMember(String(props.organizationId), email, role)
        .then((result) => {
          if (result.success) {
            showSuccess('Invitation sent', `Invitation sent to ${email}`);
            emit('memberAdded');
          } else {
            showError('Failed to send invitation', result.error || 'An error occurred');
          }
        })
        .catch((err: any) => {
          showError('Failed to send invitation', err.message || 'An error occurred');
        });
    } else {
      // Create account mode: close dialog immediately and process in background
      const name = createData.value.name;
      const email = createData.value.email;
      const password = createData.value.password;
      const role = createData.value.role;

      // Close dialog immediately
      emit('update:modelValue', false);

      // Process in background
      authStore
        .createOrganizationMember(String(props.organizationId), email, password, role, name)
        .then((result) => {
          if (result.success) {
            showSuccess('Account created', `Account created for ${email}`);
            emit('memberAdded');
          } else {
            showError('Failed to create account', result.error || 'An error occurred');
          }
        })
        .catch((err: any) => {
          showError('Failed to create account', err.message || 'An error occurred');
        });
    }
  }

  function close() {
    emit('update:modelValue', false);
  }
</script>

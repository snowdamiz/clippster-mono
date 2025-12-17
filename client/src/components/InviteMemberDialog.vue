<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]"
        @click.self="close"
        @keydown.esc="close"
      >
        <Transition name="dialog" appear>
          <div
            v-if="modelValue"
            class="relative bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-2xl max-w-md w-full mx-4 overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

            <!-- Close Button -->
            <button
              @click="close"
              :disabled="loading"
              class="absolute right-4 top-4 z-10 p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              <X class="h-4 w-4 text-zinc-400" />
            </button>

            <div class="p-6">
              <!-- Header -->
              <div class="mb-6">
                <h2 class="text-xl font-bold text-white mb-1">Add Team Member</h2>
                <p class="text-zinc-400 text-sm">Invite someone to join your organization</p>
              </div>

              <!-- Mode Tabs -->
              <div class="flex gap-2 mb-6 bg-zinc-800/50 p-1 rounded-lg">
                <button
                  @click="mode = 'invite'"
                  :class="[
                    'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all',
                    mode === 'invite' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white',
                  ]"
                >
                  <span class="flex items-center justify-center gap-2">
                    <Mail class="h-4 w-4" />
                    Send Invite
                  </span>
                </button>
                <button
                  @click="mode = 'create'"
                  :class="[
                    'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all',
                    mode === 'create' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white',
                  ]"
                >
                  <span class="flex items-center justify-center gap-2">
                    <UserPlus class="h-4 w-4" />
                    Create Account
                  </span>
                </button>
              </div>

              <!-- Invite Mode -->
              <div v-if="mode === 'invite'" class="space-y-4">
                <p class="text-sm text-zinc-400">
                  Send an email invitation to an existing Clippster user or someone who will create their own account.
                </p>

                <div>
                  <label for="invite-email" class="block text-sm font-medium text-zinc-300 mb-1.5">Email Address</label>
                  <input
                    id="invite-email"
                    v-model="inviteData.email"
                    type="email"
                    placeholder="colleague@example.com"
                    class="w-full px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                  />
                </div>

                <div>
                  <label for="invite-role" class="block text-sm font-medium text-zinc-300 mb-1.5">Role</label>
                  <select
                    id="invite-role"
                    v-model="inviteData.role"
                    class="w-full px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div class="bg-zinc-800/50 rounded-lg p-3">
                  <div class="flex items-start gap-2">
                    <Info class="h-4 w-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                    <p class="text-xs text-zinc-400">
                      The user will receive an email with a link to accept the invitation. If they don't have a
                      Clippster account, they'll need to create one first.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Create Account Mode -->
              <div v-if="mode === 'create'" class="space-y-4">
                <p class="text-sm text-zinc-400">
                  Create an account directly for a team member. You'll share the login credentials with them.
                </p>

                <div>
                  <label for="create-email" class="block text-sm font-medium text-zinc-300 mb-1.5">Email Address</label>
                  <input
                    id="create-email"
                    v-model="createData.email"
                    type="email"
                    placeholder="newmember@example.com"
                    class="w-full px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                  />
                </div>

                <div>
                  <label for="create-password" class="block text-sm font-medium text-zinc-300 mb-1.5">Password</label>
                  <div class="relative">
                    <input
                      id="create-password"
                      v-model="createData.password"
                      :type="showPassword ? 'text' : 'password'"
                      placeholder="Temporary password"
                      class="w-full px-3 py-2.5 pr-10 rounded-lg border border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                    />
                    <button
                      type="button"
                      @click="showPassword = !showPassword"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                    >
                      <EyeOff v-if="showPassword" class="h-4 w-4" />
                      <Eye v-else class="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    @click="generatePassword"
                    class="mt-2 text-xs text-violet-400 hover:text-violet-300"
                  >
                    Generate secure password
                  </button>
                </div>

                <div>
                  <label for="create-role" class="block text-sm font-medium text-zinc-300 mb-1.5">Role</label>
                  <select
                    id="create-role"
                    v-model="createData.role"
                    class="w-full px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <div class="flex items-start gap-2">
                    <AlertTriangle class="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p class="text-xs text-amber-200">
                      The member should change their password after first login. Share credentials securely.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Error Message -->
              <div v-if="error" class="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                <div class="flex items-start gap-2">
                  <AlertTriangle class="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p class="text-sm text-red-400">{{ error }}</p>
                </div>
              </div>

              <!-- Success Message -->
              <div v-if="success" class="mt-4 rounded-lg bg-green-500/10 border border-green-500/30 p-3">
                <div class="flex items-start gap-2">
                  <Check class="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <p class="text-sm text-green-400">{{ success }}</p>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex gap-3 mt-6">
                <button
                  @click="close"
                  class="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-300 font-medium text-sm"
                >
                  Cancel
                </button>

                <button
                  @click="submit"
                  :disabled="!canSubmit || loading"
                  class="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
                  {{ mode === 'invite' ? 'Send Invitation' : 'Create Account' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { X, Mail, UserPlus, Info, Eye, EyeOff, AlertTriangle, Check, Loader2 } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';

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
  const loading = ref(false);
  const error = ref('');
  const success = ref('');
  const showPassword = ref(false);

  const inviteData = ref({
    email: '',
    role: 'member',
  });

  const createData = ref({
    email: '',
    password: '',
    role: 'member',
  });

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

  // Reset form when mode changes
  watch(mode, () => {
    error.value = '';
    success.value = '';
  });

  // Reset form when dialog opens/closes
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (!isOpen) {
        setTimeout(() => {
          mode.value = 'invite';
          inviteData.value = { email: '', role: 'member' };
          createData.value = { email: '', password: '', role: 'member' };
          error.value = '';
          success.value = '';
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

  async function submit() {
    error.value = '';
    success.value = '';

    if (mode.value === 'invite') {
      loading.value = true;
      try {
        const result = await authStore.inviteOrganizationMember(
          props.organizationId,
          inviteData.value.email,
          inviteData.value.role
        );

        if (result.success) {
          success.value = `Invitation sent to ${inviteData.value.email}`;
          emit('memberAdded');
          setTimeout(() => close(), 2000);
        } else {
          error.value = result.error || 'Failed to send invitation';
        }
      } catch (err: any) {
        error.value = err.message || 'An error occurred';
      } finally {
        loading.value = false;
      }
    } else {
      // Create account mode: close dialog immediately and process in background
      const email = createData.value.email;
      const password = createData.value.password;
      const role = createData.value.role;

      // Close dialog immediately
      emit('update:modelValue', false);

      // Process in background
      authStore
        .createOrganizationMember(props.organizationId, email, password, role)
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
    if (!loading.value) {
      emit('update:modelValue', false);
    }
  }
</script>

<style scoped>
  /* Modal backdrop transition */
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

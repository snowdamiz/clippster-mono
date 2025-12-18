<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]"
        @keydown.esc.prevent
      >
        <Transition name="dialog" appear>
          <div
            v-if="modelValue"
            class="relative bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-2xl max-w-lg w-full mx-4 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-type-dialog-title"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

            <div class="p-8">
              <!-- Header -->
              <div class="text-center mb-8">
                <div class="flex justify-center mb-4">
                  <div class="p-3 rounded-full bg-violet-500/10 border border-violet-500/20">
                    <Sparkles class="h-8 w-8 text-violet-400" />
                  </div>
                </div>
                <h2 id="account-type-dialog-title" class="text-2xl font-bold text-white mb-2">Welcome to Clippster!</h2>
                <p class="text-zinc-400 text-sm">How will you be using Clippster?</p>
              </div>

              <!-- Account Type Options -->
              <div class="space-y-4 mb-8">
                <!-- Personal Account Option -->
                <button
                  @click="selectedType = 'personal'"
                  :class="[
                    'w-full p-5 rounded-xl border-2 transition-all text-left group',
                    selectedType === 'personal'
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800',
                  ]"
                >
                  <div class="flex items-start gap-4">
                    <div
                      :class="[
                        'p-2.5 rounded-lg transition-colors',
                        selectedType === 'personal' ? 'bg-violet-500/20' : 'bg-zinc-700',
                      ]"
                    >
                      <User :class="['h-5 w-5', selectedType === 'personal' ? 'text-violet-400' : 'text-zinc-400']" />
                    </div>
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <h3 class="font-semibold text-white">Personal Account</h3>
                        <span
                          v-if="selectedType === 'personal'"
                          class="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full"
                        >
                          Selected
                        </span>
                      </div>
                      <p class="text-sm text-zinc-400">I'm an individual creator or working independently</p>
                    </div>
                  </div>
                </button>

                <!-- Organization Account Option -->
                <button
                  @click="selectedType = 'organization'"
                  :class="[
                    'w-full p-5 rounded-xl border-2 transition-all text-left group',
                    selectedType === 'organization'
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800',
                  ]"
                >
                  <div class="flex items-start gap-4">
                    <div
                      :class="[
                        'p-2.5 rounded-lg transition-colors',
                        selectedType === 'organization' ? 'bg-violet-500/20' : 'bg-zinc-700',
                      ]"
                    >
                      <Building2
                        :class="['h-5 w-5', selectedType === 'organization' ? 'text-violet-400' : 'text-zinc-400']"
                      />
                    </div>
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <h3 class="font-semibold text-white">Organization Account</h3>
                        <span
                          v-if="selectedType === 'organization'"
                          class="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full"
                        >
                          Selected
                        </span>
                      </div>
                      <p class="text-sm text-zinc-400">I'm managing a team or company with multiple users</p>
                      <ul class="mt-2 space-y-1">
                        <li class="flex items-center gap-1.5 text-xs text-zinc-500">
                          <Check class="h-3 w-3 text-green-500" />
                          Invite team members
                        </li>
                        <li class="flex items-center gap-1.5 text-xs text-zinc-500">
                          <Check class="h-3 w-3 text-green-500" />
                          Shared credit pool
                        </li>
                        <li class="flex items-center gap-1.5 text-xs text-zinc-500">
                          <Check class="h-3 w-3 text-green-500" />
                          Team management
                        </li>
                      </ul>
                    </div>
                  </div>
                </button>
              </div>

              <!-- Continue Button -->
              <button
                @click="handleContinue"
                :disabled="!selectedType || loading"
                class="w-full group relative overflow-hidden rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div class="px-6 py-3 flex items-center justify-center gap-2">
                  <Loader2 v-if="loading" class="h-5 w-5 animate-spin text-white" />
                  <ArrowRight v-else class="h-5 w-5 text-white" />
                  <span class="font-semibold text-white">
                    {{ loading ? 'Setting up...' : 'Continue' }}
                  </span>
                </div>
              </button>

              <!-- Note -->
              <p class="mt-4 text-xs text-zinc-500 text-center">You can change this later in your account settings</p>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { User, Building2, Check, ArrowRight, Sparkles, Loader2 } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { useRouter } from 'vue-router';

  defineProps<{
    modelValue: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    selected: [type: 'personal' | 'organization'];
  }>();

  const authStore = useAuthStore();
  const router = useRouter();

  const selectedType = ref<'personal' | 'organization' | null>(null);
  const loading = ref(false);

  async function handleContinue() {
    if (!selectedType.value) return;

    loading.value = true;

    try {
      const result = await authStore.setAccountType(selectedType.value);

      if (result.success) {
        emit('selected', selectedType.value);

        if (result.needsOrgSetup) {
          // Redirect to organization setup
          router.push('/organization/setup');
        } else {
          // Personal account - go to projects
          router.push('/projects');
        }

        emit('update:modelValue', false);
      }
    } catch (error) {
      console.error('Failed to set account type:', error);
    } finally {
      loading.value = false;
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

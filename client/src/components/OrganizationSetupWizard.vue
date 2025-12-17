<template>
  <div class="min-h-screen bg-background flex items-center justify-center p-4">
    <div class="w-full max-w-lg">
      <!-- Progress Indicator -->
      <div class="flex items-center justify-center gap-2 mb-8">
        <div
          v-for="step in totalSteps"
          :key="step"
          :class="['h-2 rounded-full transition-all', step <= currentStep ? 'bg-violet-500 w-8' : 'bg-zinc-700 w-2']"
        />
      </div>

      <!-- Card -->
      <div
        class="relative bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-2xl overflow-hidden"
      >
        <!-- Decorative top accent -->
        <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

        <div class="p-8">
          <!-- Step 1: Organization Name -->
          <div v-if="currentStep === 1">
            <div class="text-center mb-8">
              <div class="flex justify-center mb-4">
                <div class="p-3 rounded-full bg-violet-500/10 border border-violet-500/20">
                  <Building2 class="h-8 w-8 text-violet-400" />
                </div>
              </div>
              <h2 class="text-2xl font-bold text-white mb-2">Create your organization</h2>
              <p class="text-zinc-400 text-sm">Give your team a name to get started</p>
            </div>

            <div class="space-y-4">
              <div>
                <label for="org-name" class="block text-sm font-medium text-zinc-300 mb-2">Organization Name</label>
                <input
                  id="org-name"
                  v-model="orgData.name"
                  type="text"
                  placeholder="e.g., Acme Studios"
                  class="w-full px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                  @keydown.enter="nextStep"
                />
              </div>
            </div>
          </div>

          <!-- Step 2: Description (Optional) -->
          <div v-if="currentStep === 2">
            <div class="text-center mb-8">
              <div class="flex justify-center mb-4">
                <div class="p-3 rounded-full bg-violet-500/10 border border-violet-500/20">
                  <FileText class="h-8 w-8 text-violet-400" />
                </div>
              </div>
              <h2 class="text-2xl font-bold text-white mb-2">Add a description</h2>
              <p class="text-zinc-400 text-sm">Help team members understand what your organization does</p>
            </div>

            <div class="space-y-4">
              <div>
                <label for="org-description" class="block text-sm font-medium text-zinc-300 mb-2">
                  Description
                  <span class="text-zinc-500">(optional)</span>
                </label>
                <textarea
                  id="org-description"
                  v-model="orgData.description"
                  rows="4"
                  placeholder="What does your organization do?"
                  class="w-full px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 resize-none"
                />
              </div>
            </div>
          </div>

          <!-- Step 3: Logo (Optional) -->
          <div v-if="currentStep === 3">
            <div class="text-center mb-8">
              <div class="flex justify-center mb-4">
                <div class="p-3 rounded-full bg-violet-500/10 border border-violet-500/20">
                  <ImageIcon class="h-8 w-8 text-violet-400" />
                </div>
              </div>
              <h2 class="text-2xl font-bold text-white mb-2">Add a logo</h2>
              <p class="text-zinc-400 text-sm">Give your organization a visual identity</p>
            </div>

            <div class="space-y-4">
              <!-- Logo Preview -->
              <div class="flex justify-center">
                <div
                  class="w-24 h-24 rounded-xl bg-zinc-800 border-2 border-dashed border-zinc-600 flex items-center justify-center overflow-hidden"
                >
                  <img v-if="logoPreview" :src="logoPreview" alt="Logo preview" class="w-full h-full object-cover" />
                  <Building2 v-else class="h-8 w-8 text-zinc-500" />
                </div>
              </div>

              <!-- Upload Button -->
              <div class="flex justify-center">
                <label
                  class="cursor-pointer px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm text-zinc-300"
                >
                  <input type="file" accept="image/*" class="hidden" @change="handleLogoUpload" />
                  <span class="flex items-center gap-2">
                    <Upload class="h-4 w-4" />
                    {{ logoPreview ? 'Change Logo' : 'Upload Logo' }}
                  </span>
                </label>
              </div>

              <p class="text-center text-xs text-zinc-500">PNG, JPG or SVG (max 2MB)</p>
            </div>
          </div>

          <!-- Step 4: Confirmation -->
          <div v-if="currentStep === 4">
            <div class="text-center mb-8">
              <div class="flex justify-center mb-4">
                <div class="p-3 rounded-full bg-green-500/10 border border-green-500/20">
                  <Check class="h-8 w-8 text-green-400" />
                </div>
              </div>
              <h2 class="text-2xl font-bold text-white mb-2">You're all set!</h2>
              <p class="text-zinc-400 text-sm">Review your organization details</p>
            </div>

            <div class="bg-zinc-800/50 rounded-xl p-6 space-y-4">
              <div class="flex items-center gap-4">
                <div
                  class="w-16 h-16 rounded-xl bg-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0"
                >
                  <img v-if="logoPreview" :src="logoPreview" alt="Logo" class="w-full h-full object-cover" />
                  <Building2 v-else class="h-6 w-6 text-zinc-400" />
                </div>
                <div>
                  <h3 class="font-semibold text-white text-lg">{{ orgData.name }}</h3>
                  <p v-if="orgData.description" class="text-sm text-zinc-400 line-clamp-2">
                    {{ orgData.description }}
                  </p>
                </div>
              </div>

              <div class="pt-4 border-t border-zinc-700 space-y-2">
                <div class="flex items-center gap-2 text-sm text-zinc-400">
                  <UserCheck class="h-4 w-4 text-green-500" />
                  <span>You'll be the owner and admin</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-zinc-400">
                  <Users class="h-4 w-4 text-green-500" />
                  <span>Invite team members anytime</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-zinc-400">
                  <CreditCard class="h-4 w-4 text-green-500" />
                  <span>Manage shared credits for your team</span>
                </div>
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

          <!-- Navigation Buttons -->
          <div class="flex gap-3 mt-8">
            <button
              v-if="currentStep > 1"
              @click="prevStep"
              class="flex-1 px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-300 font-medium"
            >
              Back
            </button>

            <button
              v-if="currentStep < totalSteps"
              @click="nextStep"
              :disabled="!canProceed"
              class="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>

            <button
              v-if="currentStep === totalSteps"
              @click="createOrganization"
              :disabled="loading"
              class="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Loader2 v-if="loading" class="h-5 w-5 animate-spin" />
              {{ loading ? 'Creating...' : 'Create Organization' }}
            </button>
          </div>

          <!-- Skip Link -->
          <button
            v-if="currentStep === 2 || currentStep === 3"
            @click="nextStep"
            class="w-full mt-3 text-sm text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import {
    Building2,
    FileText,
    ImageIcon,
    Check,
    Upload,
    UserCheck,
    Users,
    CreditCard,
    Loader2,
    AlertTriangle,
  } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';

  const router = useRouter();
  const authStore = useAuthStore();

  const currentStep = ref(1);
  const totalSteps = 4;
  const loading = ref(false);
  const error = ref('');

  const orgData = ref({
    name: '',
    description: '',
    logo_url: '',
  });

  const logoPreview = ref<string | null>(null);
  const logoFile = ref<File | null>(null);

  const canProceed = computed(() => {
    if (currentStep.value === 1) {
      return orgData.value.name.trim().length >= 2;
    }
    return true;
  });

  function nextStep() {
    if (canProceed.value && currentStep.value < totalSteps) {
      currentStep.value++;
      error.value = '';
    }
  }

  function prevStep() {
    if (currentStep.value > 1) {
      currentStep.value--;
      error.value = '';
    }
  }

  function handleLogoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        error.value = 'Logo must be less than 2MB';
        return;
      }

      logoFile.value = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        logoPreview.value = e.target?.result as string;
      };
      reader.readAsDataURL(file);
      error.value = '';
    }
  }

  async function createOrganization() {
    loading.value = true;
    error.value = '';

    try {
      // TODO: Upload logo if present and get URL
      // For now, we'll skip the logo upload

      const result = await authStore.createOrganization({
        name: orgData.value.name,
        description: orgData.value.description || undefined,
        logo_url: orgData.value.logo_url || undefined,
      });

      if (result.success) {
        router.push(`/organization/${result.organization.id}`);
      } else {
        error.value = result.error || 'Failed to create organization';
      }
    } catch (err: any) {
      error.value = err.message || 'An error occurred';
    } finally {
      loading.value = false;
    }
  }
</script>

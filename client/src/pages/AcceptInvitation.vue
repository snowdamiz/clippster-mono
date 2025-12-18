<template>
  <div class="min-h-screen bg-background flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-20">
        <Loader2 class="h-8 w-8 animate-spin text-violet-500 mx-auto mb-4" />
        <p class="text-zinc-400">Loading invitation...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
        <div class="flex justify-center mb-4">
          <div class="p-3 rounded-full bg-red-500/10 border border-red-500/20">
            <AlertTriangle class="h-8 w-8 text-red-400" />
          </div>
        </div>
        <h2 class="text-xl font-bold text-white mb-2">Invalid Invitation</h2>
        <p class="text-zinc-400 text-sm mb-6">{{ error }}</p>
        <router-link to="/login" class="inline-block px-6 py-2.5 bg-violet-600 rounded-lg text-white font-medium">
          Go to Login
        </router-link>
      </div>

      <!-- Invitation Card -->
      <div
        v-else-if="invitation"
        class="relative bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-2xl overflow-hidden"
      >
        <!-- Decorative top accent -->
        <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

        <div class="p-8">
          <!-- Organization Logo/Icon -->
          <div class="flex justify-center mb-6">
            <div
              class="w-20 h-20 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden"
            >
              <img
                v-if="invitation.organization_logo"
                :src="invitation.organization_logo"
                :alt="invitation.organization_name"
                class="w-full h-full object-cover"
              />
              <Building2 v-else class="h-8 w-8 text-zinc-500" />
            </div>
          </div>

          <!-- Invitation Details -->
          <div class="text-center mb-8">
            <h2 class="text-2xl font-bold text-white mb-2">You're Invited!</h2>
            <p class="text-zinc-400">
              <span v-if="invitation.inviter_name" class="text-zinc-300">{{ invitation.inviter_name }}</span>
              <span v-else>Someone</span>
              has invited you to join
            </p>
            <p class="text-xl font-semibold text-white mt-2">{{ invitation.organization_name }}</p>
          </div>

          <!-- Role Badge -->
          <div class="flex justify-center mb-6">
            <span class="px-3 py-1.5 bg-violet-500/20 text-violet-400 rounded-full text-sm font-medium">
              You'll join as {{ invitation.role }}
            </span>
          </div>

          <!-- Not Logged In -->
          <div v-if="!authStore.isAuthenticated" class="space-y-4">
            <p class="text-center text-sm text-zinc-400">
              Please sign in or create an account to accept this invitation.
            </p>
            <button
              @click="showAuthModal = true"
              class="w-full px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-medium transition-colors"
            >
              Sign In to Accept
            </button>
          </div>

          <!-- Logged In -->
          <div v-else class="space-y-4">
            <div class="bg-zinc-800/50 rounded-lg p-4 text-center">
              <p class="text-sm text-zinc-400">Signed in as</p>
              <p class="text-white font-medium">{{ authStore.user?.email }}</p>
            </div>

            <div v-if="emailMismatch" class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <AlertTriangle class="h-5 w-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p class="text-sm text-amber-200">
                    This invitation was sent to a different email address. You may need to sign out and sign in with the
                    correct account.
                  </p>
                </div>
              </div>
            </div>

            <button
              @click="acceptInvitation"
              :disabled="accepting"
              class="w-full px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Loader2 v-if="accepting" class="h-5 w-5 animate-spin" />
              {{ accepting ? 'Accepting...' : 'Accept Invitation' }}
            </button>

            <button
              @click="router.push('/projects')"
              class="w-full px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 font-medium transition-colors"
            >
              Decline
            </button>
          </div>

          <!-- Expiry Notice -->
          <p class="mt-6 text-center text-xs text-zinc-500">
            This invitation expires {{ formatExpiry(invitation.expires_at) }}
          </p>
        </div>
      </div>

      <!-- Auth Modal -->
      <AuthModal v-model="showAuthModal" @update:model-value="onAuthModalClose" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { Building2, AlertTriangle, Loader2 } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import AuthModal from '@/components/AuthModal.vue';

  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();

  const loading = ref(true);
  const error = ref('');
  const accepting = ref(false);
  const showAuthModal = ref(false);

  const invitation = ref<{
    organization_name: string;
    organization_logo?: string;
    role: string;
    inviter_name?: string;
    expires_at: string;
    email?: string;
  } | null>(null);

  const token = computed(() => route.params.token as string);

  const emailMismatch = computed(() => {
    if (!invitation.value?.email || !authStore.user?.email) return false;
    return invitation.value.email.toLowerCase() !== authStore.user.email.toLowerCase();
  });

  onMounted(async () => {
    await loadInvitation();
  });

  // Watch for auth changes
  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (isAuth && showAuthModal.value) {
        showAuthModal.value = false;
      }
    }
  );

  async function loadInvitation() {
    loading.value = true;
    error.value = '';

    try {
      const result = await authStore.getInvitationDetails(token.value);

      if (result.success) {
        invitation.value = result.invitation;
      } else {
        error.value = result.error || 'Invalid or expired invitation';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to load invitation';
    } finally {
      loading.value = false;
    }
  }

  async function acceptInvitation() {
    accepting.value = true;

    try {
      const result = await authStore.acceptInvitation(token.value);

      if (result.success) {
        router.push(`/organization/${result.organization_id}`);
      } else {
        error.value = result.error || 'Failed to accept invitation';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to accept invitation';
    } finally {
      accepting.value = false;
    }
  }

  function onAuthModalClose(isOpen: boolean) {
    if (!isOpen && authStore.isAuthenticated) {
      // User just logged in, try to auto-accept
      acceptInvitation();
    }
  }

  function formatExpiry(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'soon';
    if (diffDays === 1) return 'tomorrow';
    return `in ${diffDays} days`;
  }
</script>

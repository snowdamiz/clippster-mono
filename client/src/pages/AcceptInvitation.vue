<template>
  <div class="h-full">
    <AccountPageCard v-if="loading" loading loading-text="Loading invitation…" />

    <!-- Error -->
    <AccountPageCard v-else-if="error" title="Invalid invitation" :description="error" :icon="AlertTriangle" tone="danger">
      <template #footer>
        <router-link to="/login" :class="buttonVariants({ variant: 'primary' })">Go to sign in</router-link>
      </template>
    </AccountPageCard>

    <!-- Invitation -->
    <AccountPageCard v-else-if="invitation" title="You're invited">
      <template #media>
        <Avatar
          :src="invitation.organization_logo"
          :name="invitation.organization_name"
          :icon="Building2"
          shape="square"
          class="mt-0.5"
        />
      </template>
      <template #description>
        <span class="text-fg">{{ invitation.inviter_name || 'Someone' }}</span>
        has invited you to join
        <span class="font-medium text-fg">{{ invitation.organization_name }}</span>.
      </template>

      <InfoList class="border-t border-line-subtle">
        <InfoRow label="Role">
          <Badge variant="brand" size="md" class="capitalize">{{ invitation.role }}</Badge>
        </InfoRow>
        <InfoRow v-if="authStore.isAuthenticated" label="Signed in as" :value="authStore.user?.email" />
        <InfoRow label="Expires" :value="formatExpiry(invitation.expires_at)" />
      </InfoList>

      <p v-if="!authStore.isAuthenticated" class="mt-3 text-xs text-fg-muted">
        Sign in or create an account to accept this invitation.
      </p>

      <Alert v-else-if="emailMismatch" variant="warning" class="mt-3">
        <AlertTriangle />
        <AlertDescription>
          This invitation was sent to a different email address. You may need to sign out and sign in with the correct
          account.
        </AlertDescription>
      </Alert>

      <template #footer>
        <Button v-if="!authStore.isAuthenticated" variant="primary" @click="showAuthModal = true">
          Sign in to accept
        </Button>
        <template v-else>
          <Button variant="ghost" @click="router.push('/projects')">Decline</Button>
          <Button variant="primary" :loading="accepting" @click="acceptInvitation">
            {{ accepting ? 'Accepting...' : 'Accept invitation' }}
          </Button>
        </template>
      </template>
    </AccountPageCard>

    <!-- Auth Modal -->
    <AuthModal v-model="showAuthModal" @update:model-value="onAuthModalClose" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { Building2, AlertTriangle } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import AuthModal from '@/components/AuthModal.vue';
  import AccountPageCard from '@/components/AccountPageCard.vue';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Avatar } from '@/components/ui/avatar';
  import { InfoList, InfoRow } from '@/components/ui/info-list';

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

<template>
  <AccountPageCard v-if="loading" loading loading-text="Verifying your email…" />

  <!-- Success -->
  <AccountPageCard
    v-else-if="success"
    title="Email verified"
    description="Your email address has been changed. You can now use your new email to sign in."
    :icon="CheckCircle"
    tone="success"
  >
    <template #footer>
      <Button variant="primary" @click="handleContinue">Continue to app</Button>
    </template>
  </AccountPageCard>

  <!-- Error -->
  <AccountPageCard v-else-if="error" title="Verification failed" :description="error" :icon="AlertTriangle" tone="danger">
    <template #footer>
      <Button variant="primary" @click="handleRetry">
        <RefreshCw />
        Try again
      </Button>
    </template>
  </AccountPageCard>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useAuthStore } from '../stores/auth';
  import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-vue-next';
  import AccountPageCard from '@/components/AccountPageCard.vue';
  import { Button } from '@/components/ui/button';

  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();

  const loading = ref(true);
  const success = ref(false);
  const error = ref('');

  const verifyEmail = async () => {
    loading.value = true;
    error.value = '';

    const token = route.params.token as string;

    if (!token) {
      error.value = 'Invalid verification link. Please request a new email change.';
      loading.value = false;
      return;
    }

    const result = await (authStore as any).verifyEmailChange(token);

    if (result.success) {
      success.value = true;
    } else {
      error.value = result.error || 'Failed to verify email change';
    }

    loading.value = false;
  };

  const handleContinue = () => {
    if (authStore.isAuthenticated) {
      router.push('/projects');
    } else {
      router.push('/login');
    }
  };

  const handleRetry = () => {
    verifyEmail();
  };

  onMounted(() => {
    verifyEmail();
  });
</script>

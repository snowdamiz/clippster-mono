<template>
  <AccountPageCard v-if="loading" loading loading-text="Processing…" />

  <!-- Success -->
  <AccountPageCard
    v-else-if="success"
    title="Password reset"
    description="Your password has been reset. You can now sign in with your new password."
    :icon="CheckCircle"
    tone="success"
  >
    <template #footer>
      <router-link to="/login" :class="buttonVariants({ variant: 'primary' })">Go to sign in</router-link>
    </template>
  </AccountPageCard>

  <!-- Invalid / expired token -->
  <AccountPageCard
    v-else-if="error && !canRetry"
    title="Link expired"
    :description="error"
    :icon="AlertTriangle"
    tone="danger"
  >
    <template #footer>
      <router-link to="/login" :class="buttonVariants({ variant: 'primary' })">Request new link</router-link>
    </template>
  </AccountPageCard>

  <!-- Reset form -->
  <AccountPageCard v-else title="Set new password" description="Enter your new password below." :icon="KeyRound">
    <form id="reset-password-form" class="flex flex-col gap-4" @submit.prevent="handleResetPassword">
      <Field label="New password" for="password">
        <Input
          id="password"
          v-model="password"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
          placeholder="At least 8 characters"
        />
      </Field>
      <Field
        label="Confirm password"
        for="confirm"
        :error="password && confirmPassword && password !== confirmPassword ? 'Passwords do not match' : null"
      >
        <Input
          id="confirm"
          v-model="confirmPassword"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
          placeholder="Confirm your password"
          :aria-invalid="(!!confirmPassword && password !== confirmPassword) || undefined"
        />
      </Field>

      <Alert v-if="error && canRetry" variant="destructive">
        <AlertTriangle />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
    </form>

    <template #footer>
      <Button
        type="submit"
        form="reset-password-form"
        variant="primary"
        :loading="submitting"
        :disabled="password !== confirmPassword || password.length < 8"
      >
        <KeyRound v-if="!submitting" />
        {{ submitting ? 'Resetting...' : 'Reset password' }}
      </Button>
    </template>
  </AccountPageCard>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useAuthStore } from '../stores/auth';
  import { CheckCircle, AlertTriangle, KeyRound } from 'lucide-vue-next';
  import AccountPageCard from '@/components/AccountPageCard.vue';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Alert, AlertDescription } from '@/components/ui/alert';

  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();

  const loading = ref(false);
  const submitting = ref(false);
  const success = ref(false);
  const error = ref('');
  const canRetry = ref(true);
  const password = ref('');
  const confirmPassword = ref('');

  const token = ref('');

  const handleResetPassword = async () => {
    if (password.value !== confirmPassword.value) {
      return;
    }

    submitting.value = true;
    error.value = '';

    const result = await authStore.resetPassword(token.value, password.value);

    if (result.success) {
      success.value = true;
    } else {
      error.value = result.error || 'Failed to reset password';
      // Check if error indicates expired/invalid token
      if (error.value.includes('expired') || error.value.includes('invalid')) {
        canRetry.value = false;
      }
    }

    submitting.value = false;
  };

  onMounted(() => {
    // Get token from route params
    token.value = route.params.token as string;

    if (!token.value) {
      error.value = 'Invalid reset link. Please request a new one.';
      canRetry.value = false;
    }

    // If user is already authenticated, redirect
    if (authStore.isAuthenticated) {
      router.push('/projects');
    }
  });
</script>

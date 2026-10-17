<template>
  <SharedAuthDialog
    :model-value="modelValue"
    :mandatory="mandatory"
    :auth="authStore"
    :referral-code="referralCode"
    @update:model-value="emit('update:modelValue', $event)"
    @authenticated="authenticated"
  />
</template>

<script setup lang="ts">
  import { useRoute, useRouter } from 'vue-router';
  import SharedAuthDialog from './SharedAuthDialog.vue';
  import { useAuthStore } from '@/stores/auth';
  import { getDefaultRoute } from '@/router';

  defineProps<{ modelValue: boolean; mandatory?: boolean }>();
  const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
  const authStore = useAuthStore();
  const route = useRoute();
  const router = useRouter();
  const referralCode = typeof route.query.ref === 'string' ? route.query.ref : localStorage.getItem('referral_code');
  if (referralCode) localStorage.setItem('referral_code', referralCode);

  function authenticated(isNewUser: boolean) {
    localStorage.removeItem('referral_code');
    const user = authStore.user;
    if (user) router.push(isNewUser && !user.is_admin ? '/billing?new_user=true' : getDefaultRoute(user));
  }
</script>

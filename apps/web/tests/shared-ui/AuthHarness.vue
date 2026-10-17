<template>
  <SharedAuthDialog v-model="open" :auth="adapter" mandatory @authenticated="signedIn++" />
  <output aria-label="Authenticated">{{ signedIn }}</output>
  <output aria-label="Provider">{{ provider }}</output>
</template>
<script setup lang="ts">
  import { reactive, ref } from 'vue'
  import SharedAuthDialog from '@/components/SharedAuthDialog.vue'
  import type { AuthDialogAdapter } from '@/components/authDialog'
  const open = ref(true),
    signedIn = ref(0),
    provider = ref('')
  const adapter = reactive<AuthDialogAdapter>({
    loading: false,
    error: null,
    pendingVerificationEmail: null,
    user: null,
    async authenticateWithGoogle() {
      provider.value = 'google'
      adapter.user = { id: 1 }
      return { success: true }
    },
    async loginWithEmail() {
      adapter.user = { id: 1 }
      return { success: true }
    },
    async registerWithEmail(email) {
      adapter.pendingVerificationEmail = email
      return { success: true }
    },
    async verifyEmailOtp(_email, code) {
      adapter.error = code === '123456' ? null : 'Invalid verification code'
      return { success: code === '123456' }
    },
    async resendVerificationEmail() {
      return { success: true }
    },
    async forgotPassword() {
      return { success: true }
    },
    async resetPassword() {
      return { success: true }
    },
    clearPendingVerification() {
      adapter.pendingVerificationEmail = null
      adapter.error = null
    }
  })
</script>

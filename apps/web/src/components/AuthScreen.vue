<template>
  <SharedAuthDialog
    :model-value="true"
    mandatory
    :auth="adapter"
    :referral-code="referralCode"
    :reset-token="resetToken"
    @authenticated="signedIn"
    @password-reset="clearCallback"
  />
</template>
<script setup lang="ts">
  import { reactive } from 'vue'
  import SharedAuthDialog from '../../../../client/src/components/SharedAuthDialog.vue'
  import type { AuthDialogAdapter, AuthDialogResult } from '../../../../client/src/components/authDialog'
  import { auth, client, errorMessage } from '../api'
  import type { AuthUser } from '@clippster/shared-types'
  const emit = defineEmits<{ authenticated: [user: AuthUser] }>()
  const params = new URLSearchParams(location.search)
  const referralCode = params.get('ref') || localStorage.getItem('referral_code')
  if (referralCode) localStorage.setItem('referral_code', referralCode)
  const resetToken = location.pathname.startsWith('/reset-password')
    ? params.get('token') || location.pathname.split('/')[2] || null
    : null
  const callbackErrors: Record<string, string> = {
    google_failed: 'Google sign-in failed. Please try again.',
    google_expired: 'Your sign-in expired. Please try again.',
    google_cancelled: 'Google sign-in was cancelled. Please try again.'
  }
  let signedInUser: AuthUser | undefined
  const adapter = reactive<AuthDialogAdapter>({
    loading: false,
    error: callbackErrors[params.get('auth_error') || ''] || null,
    pendingVerificationEmail: null,
    user: null,
    authenticateWithGoogle: (referral) =>
      perform(async () => {
        const result = await client.post<{ url: string }>(
          '/auth/google/start',
          { referral_code: referral },
          { skipAuth: true }
        )
        location.assign(result.url)
        return { success: false }
      }),
    loginWithEmail: (email, password) =>
      perform(async () => {
        // Preserve EMAIL_NOT_VERIFIED on a non-2xx response, just like the desktop adapter.
        const { data } = await client.requestWithStatus<Awaited<ReturnType<typeof auth.login>>>('/auth/email/login', {
          method: 'POST',
          body: { email, password },
          skipAuth: true
        })
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          adapter.pendingVerificationEmail = email
          return { success: false, needsVerification: true }
        }
        return accept(data)
      }),
    registerWithEmail: (email, password, referral) =>
      perform(async () => {
        const result = await client.post<Awaited<ReturnType<typeof auth.register>>>(
          '/auth/email/register',
          { email, password, referral_code: referral },
          { skipAuth: true }
        )
        accept(result)
        adapter.pendingVerificationEmail = email
        return result
      }),
    verifyEmailOtp: (email, otp) => perform(async () => accept(await auth.verifyOtp(email, otp))),
    resendVerificationEmail: (email) => perform(async () => accept(await auth.resendVerification(email))),
    forgotPassword: (email) => perform(async () => accept(await auth.forgotPassword(email))),
    resetPassword: (token, password) => perform(async () => accept(await auth.resetPassword(token, password))),
    clearPendingVerification: () => {
      adapter.pendingVerificationEmail = null
      adapter.error = null
    }
  })
  function accept<T extends AuthDialogResult & { user?: AuthUser; error?: string; message?: string }>(result: T): T {
    if (!result.success) throw new Error(result.error || result.message || 'Unable to sign in.')
    if (result.user) {
      signedInUser = result.user
      adapter.user = result.user
    }
    return result
  }
  async function perform(action: () => Promise<AuthDialogResult>) {
    if (adapter.loading) return { success: false }
    adapter.loading = true
    adapter.error = null
    try {
      return await action()
    } catch (cause) {
      adapter.error = errorMessage(cause)
      return { success: false }
    } finally {
      adapter.loading = false
    }
  }
  function clearCallback() {
    history.replaceState(null, '', '/')
  }
  function signedIn() {
    if (!signedInUser) return
    localStorage.removeItem('referral_code')
    clearCallback()
    emit('authenticated', signedInUser)
  }
  if (params.has('auth_error')) clearCallback()
</script>

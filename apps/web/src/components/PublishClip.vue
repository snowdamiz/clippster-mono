<template>
  <section class="grid gap-3 border-t border-white/10 p-4">
    <h3 class="font-semibold">Publish clip</h3>
    <p class="text-xs text-zinc-400">Publish the built version to a connected account, or schedule it for later. Organization clips requiring approval are submitted for review before they can publish.</p>
    <p v-if="!accounts.length" class="text-sm"><a href="/account/social" target="_top" class="text-cyan-400">Connect a social account</a> to publish.</p>
    <form v-else class="grid gap-3" @submit.prevent="publish">
      <label class="text-xs">Account<select v-model="accountKey" required class="field mt-2"><option v-for="account in accounts" :key="`${account.organizationId || 'personal'}:${account.id}`" :value="`${account.organizationId || 'personal'}:${account.id}`">{{ account.organizationId ? 'Organization' : 'Personal' }} · {{ account.platform }} · {{ account.username || account.display_name }}</option></select></label>
      <label class="text-xs">Caption<textarea v-model="caption" class="field mt-2" maxlength="5000" rows="3" /></label>
      <label class="text-xs">Schedule (optional, at least five minutes ahead)<input v-model="scheduledAt" type="datetime-local" class="field mt-2" /></label>
      <button class="button-primary" :disabled="saving || submitted">{{ saving ? 'Submitting…' : submitted ? 'Submitted' : requiresReview ? 'Submit for approval' : scheduledAt ? 'Schedule post' : 'Publish now' }}</button>
    </form>
    <p v-if="message" role="status" class="text-sm text-cyan-300">{{ message }}</p>
  </section>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { WEB_PUBLISH_PLATFORMS } from '@clippster/shared-types'
import { workspaceClient as client, errorMessage } from '../api'
const props = defineProps<{ projectId: string; clipId: string }>()
const accounts = ref<Array<{ id: number; platform: string; username?: string; display_name?: string; organizationId?: number }>>([])
const accountKey = ref(''), caption = ref(''), scheduledAt = ref(''), message = ref(''), saving = ref(false), submitted = ref(false)
const chosenAccount = computed(() => accounts.value.find(account => `${account.organizationId || 'personal'}:${account.id}` === accountKey.value))
const reviewingOrganizationId = ref<number | null>(null)
const requiresReview = computed(() => !!reviewingOrganizationId.value && chosenAccount.value?.organizationId === reviewingOrganizationId.value)
const requestId = crypto.randomUUID()
onMounted(async () => {
  try {
    const permissions = await client.get<{ restricted?: boolean; restrictions?: { require_clip_approval?: boolean; allow_personal_social?: boolean; restricting_org_id?: number } }>('/web/account/user/restrictions')
    if (permissions.restrictions?.require_clip_approval) reviewingOrganizationId.value = permissions.restrictions.restricting_org_id || null
    const results = await Promise.allSettled([
      permissions.restrictions?.require_clip_approval || permissions.restricted && permissions.restrictions?.allow_personal_social === false ? Promise.resolve({ social_accounts: [] }) : client.get<{ social_accounts: typeof accounts.value }>('/web/account/user/social-accounts'),
      client.get<{ organizations: Array<{ id: number; role: string }> }>('/web/account/organizations')
    ])
    if (results[0].status === 'fulfilled') accounts.value = results[0].value.social_accounts
    if (results[1].status === 'fulfilled') {
      const organizationAccounts = await Promise.allSettled(results[1].value.organizations.map(async organization => {
        const path = ['owner', 'admin'].includes(organization.role) ? 'social-accounts' : 'my-social-accounts'
        const result = await client.get<{ accounts: typeof accounts.value }>(`/web/account/organizations/${organization.id}/${path}`)
        return result.accounts.map(account => ({ ...account, organizationId: organization.id }))
      }))
      for (const result of organizationAccounts) { if (result.status === 'fulfilled') accounts.value.push(...result.value); else message.value = errorMessage(result.reason) }
    } else message.value = errorMessage(results[1].reason)
    if (results[0].status === 'rejected' && !accounts.value.length) message.value = errorMessage(results[0].reason)
  }
  catch (cause) { message.value = errorMessage(cause) }
  finally {
    accounts.value = accounts.value.filter(account => WEB_PUBLISH_PLATFORMS.includes(account.platform))
    if (accounts.value[0]) accountKey.value = `${accounts.value[0].organizationId || 'personal'}:${accounts.value[0].id}`
  }
})
async function publish() {
  if (!confirm(requiresReview.value ? 'Submit this clip for organization approval?' : scheduledAt.value ? 'Schedule this clip for publishing?' : 'Publish this clip now?')) return
  saving.value = true; message.value = ''
  try {
    const result = await client.post<{ post?: { status?: string } }>(`/web/projects/${props.projectId}/clips/${props.clipId}/publish`, { requestId, accountId: chosenAccount.value?.id, organizationId: chosenAccount.value?.organizationId, caption: caption.value, scheduledAt: scheduledAt.value ? new Date(scheduledAt.value).toISOString() : undefined })
    submitted.value = true; message.value = result.post?.status === 'awaiting_approval' ? 'Submitted for organization approval. An owner or admin can review it in Organization → Posts.' : scheduledAt.value ? 'Scheduled. View it in Calendar.' : 'Submitted. Check Posts for publishing status.'
  } catch (cause) { message.value = errorMessage(cause) } finally { saving.value = false }
}
</script>

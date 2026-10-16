<template>
  <PageLayout :title="title" :description="description" :show-header="true" :icon="icon">
    <div class="h-full overflow-y-auto p-6">
      <p v-if="error" role="alert" class="mb-4 rounded-lg border border-red-400/30 p-4 text-red-300">{{ error }} <a :href="billingUrl" target="_top" class="underline">Manage plan</a></p>
      <p v-if="loading" role="status">Loading…</p>
      <template v-else-if="!blocked">
        <div class="mb-6 flex flex-wrap items-center gap-3">
          <input v-model="search" class="field max-w-sm" :aria-label="`Search ${title}`" placeholder="Search…" />
          <button class="button-secondary" @click="load">Refresh</button>
          <button v-if="view === 'prompts'" class="button-primary" @click="edit()">New Prompt</button>
          <template v-if="view === 'campaigns'">
            <button class="button-secondary" @click="campaignScope = 'all'; load()">Discover</button>
            <button class="button-secondary" @click="campaignScope = 'mine'; load()">My Campaigns</button>
            <button class="button-secondary" @click="campaignScope = 'submissions'; load()">My Submissions</button>
            <button class="button-secondary" @click="campaignScope = 'earnings'; load()">Earnings</button>
          </template>
        </div>

        <template v-if="view === 'calendar'">
          <div class="mb-4 flex items-center gap-4">
            <button class="button-secondary" aria-label="Previous period" @click="moveDate(-1)">←</button>
            <h2>{{ cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }}</h2>
            <button class="button-secondary" aria-label="Next period" @click="moveDate(1)">→</button>
            <button class="button-secondary" @click="cursor = new Date()">Today</button>
            <select v-model="calendarMode" class="field w-auto" aria-label="Calendar view"><option value="month">Month</option><option value="week">Week</option></select>
          </div>
          <p class="mb-4 text-sm text-zinc-400">Publish and schedule built clips from your Video Library. Times are shown in {{ Intl.DateTimeFormat().resolvedOptions().timeZone }}.</p>
          <div class="grid grid-cols-7 border-l border-t border-white/10">
            <div v-for="day in days" :key="day.toISOString()" class="min-h-28 border-b border-r border-white/10 p-2">
              <span class="text-xs text-zinc-400">{{ day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) }}</span>
              <button v-for="post in eventsOn(day)" :key="post.key" class="mt-2 block w-full rounded bg-cyan-400/10 p-2 text-left text-xs" @click="selected = post">{{ post.title }} · {{ post.status }}</button>
            </div>
          </div>
        </template>
        <div v-else-if="view === 'campaigns' && campaignScope === 'earnings'" class="grid gap-4">
          <div class="grid gap-4 sm:grid-cols-3"><div v-for="(value, label) in earnings" :key="label" class="rounded-xl border border-white/10 p-5"><p class="text-sm capitalize text-zinc-400">{{ label.replaceAll('_', ' ') }}</p><p class="mt-2 text-xl">{{ value }}</p></div></div>
          <h2 class="text-lg font-semibold">Payments</h2>
          <article v-for="payment in filtered" :key="payment.id" class="rounded-xl border border-white/10 p-5"><h3>{{ payment.campaign?.title || 'Campaign payment' }}</h3><p>{{ payment.amount }} · {{ payment.status }}</p><p class="text-sm text-zinc-400">{{ new Date(payment.paid_at || payment.inserted_at).toLocaleDateString() }}</p></article>
        </div>
        <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article v-for="item in filtered" :key="item.id" class="rounded-xl border border-white/10 bg-white/[.02] p-5">
            <h2 class="mb-2 text-lg font-semibold">{{ item.name || item.title || item.campaign?.title || 'Submitted clip' }}</h2>
            <p class="mb-4 line-clamp-4 whitespace-pre-wrap text-sm text-zinc-400">{{ item.content || item.description || 'No description' }}</p>
            <div class="flex flex-wrap gap-2">
              <template v-if="view === 'prompts'">
                <button class="button-secondary" @click="copy(item.content)">Copy</button>
                <button class="button-secondary" @click="edit(item)">{{ item.system ? 'View' : 'Edit' }}</button>
                <button v-if="!item.system" class="button-secondary" @click="remove(item)">Delete</button>
              </template>
              <template v-if="view === 'campaigns' && campaignScope === 'submissions'"><p class="w-full text-sm">{{ item.status }} · {{ item.view_count || 0 }} views · {{ item.platform }}</p><a :href="safeLink(item.clip_url)" target="_blank" rel="noopener noreferrer" class="button-secondary">View clip</a></template>
              <button v-if="view === 'campaigns'" class="button-primary" @click="showCampaign(campaignScope === 'submissions' ? item.campaign_id : item.id)">View Campaign</button>
            </div>
          </article>
        </div>
        <p v-if="view !== 'calendar' && !filtered.length" class="py-16 text-center text-zinc-400">No {{ title.toLowerCase() }} found.</p>
      </template>
    </div>
    <dialog v-if="view === 'prompts'" ref="editor" class="m-auto w-[95vw] max-w-xl rounded-xl border border-white/10 bg-zinc-950 p-6 text-white backdrop:bg-black/80">
      <form class="grid gap-4" @submit.prevent="save">
        <h2 class="text-xl font-semibold">{{ draft.system ? 'System prompt' : draft.id ? 'Edit' : 'Create' }} prompt</h2>
        <label>Name<input v-model="draft.name" class="field mt-2" required maxlength="120" :readonly="draft.system" /></label>
        <label>Prompt<textarea v-model="draft.content" class="field mt-2" rows="10" required :maxlength="4000" :readonly="draft.system" /></label>
        <p v-if="draft.system" class="text-sm text-zinc-400">System prompts are read-only.</p>
        <p v-if="dialogError" role="alert" class="text-red-300">{{ dialogError }}</p>
        <div class="flex gap-3"><button v-if="!draft.system" class="button-primary" :disabled="saving">Save</button><button type="button" class="button-secondary" @click="editor?.close()">Close</button></div>
      </form>
    </dialog>
    <div v-if="selected" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" @click.self="selected = null">
      <section role="dialog" aria-modal="true" aria-label="Details" class="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 p-6">
        <button class="button-secondary float-right" @click="selected = null">Close</button>
        <h2 class="mb-4 text-xl font-semibold">{{ selected.title || selected.caption || 'Scheduled post' }}</h2>
        <p class="whitespace-pre-wrap text-zinc-300">{{ selected.description || selected.caption }}</p>
        <template v-if="view === 'campaigns'">
          <p class="my-4 text-sm">{{ selected.join_type === 'open' ? 'Open campaign' : 'Application required' }} · {{ selected.status }} · {{ selected.allowed_platforms?.join(', ') }}</p>
          <p class="my-4 text-sm">Payment: {{ selected.payment_model === 'per_clip' ? selected.per_clip_amount + ' per clip' : selected.cpm + ' CPM' }}</p>
          <a v-for="resource in selected.resources || []" :key="resource.id" :href="safeLink(resource.url)" target="_blank" rel="noopener noreferrer" class="mb-2 block text-cyan-400">{{ resource.title || resource.name || 'Resource' }}</a>
          <p v-if="selected.participation" class="my-4 text-cyan-300">Your participation: {{ selected.participation.status }}</p>
          <template v-else><label class="mt-4 block">Application note<textarea v-model="applicationNote" class="field mt-2" /></label>
          <button class="button-primary my-4" :disabled="saving || selected.status !== 'active'" @click="applyCampaign">{{ selected.join_type === 'open' ? 'Join campaign' : 'Apply to campaign' }}</button></template>
          <form v-if="selected.participation?.status === 'approved'" class="grid gap-3 border-t border-white/10 pt-4" @submit.prevent="submitCampaign">
            <label>Published clip URL<input v-model="clipUrl" type="url" required class="field mt-2" placeholder="https://…" /></label>
            <label>Platform<select v-model="platform" required class="field"><option v-for="p in selected.allowed_platforms || ['tiktok', 'instagram', 'youtube', 'twitter']" :key="p">{{ p }}</option></select></label>
            <button class="button-secondary" :disabled="saving">Submit clip</button>
          </form>
        </template>
        <template v-else>
          <p class="my-4">{{ selected.status }} · {{ new Date(selected.date).toLocaleString() }}</p>
          <form v-if="selected.can_edit" class="mb-4 grid gap-3" @submit.prevent="reschedulePost">
            <label>Caption<textarea v-model="selected.caption" class="field mt-2" /></label>
            <label>New scheduled time<input v-model="rescheduleAt" type="datetime-local" required class="field mt-2" /></label>
            <button class="button-primary" :disabled="saving">Save schedule</button>
          </form>
          <button v-if="selected.can_cancel" class="button-secondary" :disabled="saving" @click="cancelPost">Cancel scheduled post</button>
          <a v-if="selected.post_url" :href="safeLink(selected.post_url)" target="_blank" rel="noopener noreferrer" class="button-secondary">View post</a>
        </template>
        <p v-if="dialogError" role="status" class="mt-4 text-cyan-300">{{ dialogError }}</p>
      </section>
    </div>
  </PageLayout>
</template>
<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { MessageSquare, CalendarDays, Megaphone } from 'lucide-vue-next'
import PageLayout from '@/components/PageLayout.vue'
import { workspaceClient as client, errorMessage } from '../api'
import { SYSTEM_DETECTION_PROMPTS, hasCreatorToolsAccess } from '@clippster/shared-types'
const props = defineProps<{ view: string; billingUrl: string }>()
const titles: Record<string, string> = { campaigns: 'Campaigns', prompts: 'Prompts', calendar: 'Calendar' }
const title = computed(() => titles[props.view])
const icon = computed(() => ({ campaigns: Megaphone, prompts: MessageSquare, calendar: CalendarDays })[props.view])
const description = computed(() => props.view === 'prompts' ? 'Manage your AI prompts and templates' : props.view === 'calendar' ? 'Plan and manage your published and scheduled content' : 'Discover campaigns and submit your clips')
const loading = ref(true), saving = ref(false), blocked = ref(false), error = ref(''), dialogError = ref(''), search = ref('')
const items = ref<any[]>([]), selected = ref<any>(null)
const campaignScope = ref('all')
const earnings = ref<Record<string, string | number>>({})
const editor = ref<HTMLDialogElement>(), draft = ref<any>({})
const applicationNote = ref(''), clipUrl = ref(''), platform = ref(''), rescheduleAt = ref('')
const cursor = ref(new Date()), calendarMode = ref('month')
const account = '/web/account'
const filtered = computed(() => items.value
  .filter(item => `${item.name || item.title || item.campaign?.title || ''} ${item.content || item.description || ''}`.toLowerCase().includes(search.value.toLowerCase())))
const days = computed(() => {
  const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), calendarMode.value === 'month' ? 1 : cursor.value.getDate())
  first.setDate(first.getDate() - first.getDay())
  return Array.from({ length: calendarMode.value === 'month' ? 42 : 7 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i))
})
function eventsOn(day: Date) { return items.value.filter(item => new Date(item.date).toDateString() === day.toDateString() && item.title.toLowerCase().includes(search.value.toLowerCase())) }
function moveDate(direction: number) { const d = new Date(cursor.value); if (calendarMode.value === 'month') { d.setDate(1); d.setMonth(d.getMonth() + direction) } else d.setDate(d.getDate() + direction * 7); cursor.value = d }
function safeLink(value: unknown) { try { const url = new URL(String(value)); return url.protocol === 'https:' ? url.href : undefined } catch { return undefined } }
async function checked(operation: Promise<any>) { const result = await operation; if (result.success === false) throw new Error(result.error || 'Request failed'); return result }
async function load() {
  loading.value = true; error.value = ''; blocked.value = false
  try {
    if (props.view === 'prompts') items.value = [...SYSTEM_DETECTION_PROMPTS, ...(await client.get<any>('/web/prompts')).prompts]
    if (props.view === 'campaigns') {
      const paths: Record<string, string> = { all: '/campaigns', mine: '/user/campaigns', submissions: '/user/submissions', earnings: '/user/earnings' }
      const result = await client.get<any>(account + paths[campaignScope.value])
      items.value = result.campaigns || result.submissions || result.payments || []
      earnings.value = result.summary || {}
    }
    if (props.view === 'calendar') {
      const me = await client.get<any>('/auth/me')
      const orgId = me.user?.owned_organization_id
      const flags = await client.get<any>(account + '/settings/feature-flags')
      const campaignsAllowed = hasCreatorToolsAccess(me.user) && (flags.feature_flags?.campaigns_enabled || me.user?.is_admin || me.user?.campaigns_enabled)
      const sources = [
        { kind: 'scheduled', path: '/social/scheduled' }, { kind: 'published', path: '/user/posts' },
        { kind: 'external', path: orgId ? `/organizations/${orgId}/external-posts` : '/user/external-posts' },
        ...(orgId ? [{ kind: 'scheduled', path: `/organizations/${orgId}/scheduled-posts` }, { kind: 'campaigns', path: `/organizations/${orgId}/campaigns` }] : campaignsAllowed ? [{ kind: 'campaigns', path: '/user/campaigns' }] : []),
      ]
      const results = await Promise.allSettled(sources.map(source => client.get<any>(account + source.path)))
      const scheduled = new Map<number, any>()
      items.value = []
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled' || result.value.success === false) { error.value = 'Some calendar sources could not be loaded. Refresh to retry.'; return }
        const kind = sources[index].kind
        if (kind === 'scheduled') for (const post of result.value.posts || []) scheduled.set(post.id, post)
        if (kind === 'published') items.value.push(...(result.value.posts || []).map((post: any) => ({ ...post, key: `published-${post.id}`, title: post.caption || `${post.platform} post`, date: post.published_at || post.inserted_at })))
        if (kind === 'external') items.value.push(...(result.value.submissions || []).map((post: any) => ({ ...post, key: `external-${post.id}`, title: `${post.creator_profile?.name || post.submitted_by?.name || ''} ${post.platform} link`, date: post.inserted_at })))
        if (kind === 'campaigns') for (const campaign of result.value.campaigns || []) for (const boundary of ['starts_at', 'ends_at']) if (campaign[boundary]) items.value.push({ key: `${campaign.id}-${boundary}`, title: `${campaign.title} ${boundary === 'starts_at' ? 'starts' : 'ends'}`, date: campaign[boundary], status: campaign.status })
      })
      items.value.push(...Array.from(scheduled.values()).map(post => ({ ...post, key: `post-${post.id}`, title: post.caption || `${post.platform} post`, date: post.scheduled_at || post.inserted_at })))
    }
  } catch (cause) { error.value = errorMessage(cause); blocked.value = true }
  finally { loading.value = false }
}
function edit(item?: any) { draft.value = item ? { ...JSON.parse(JSON.stringify(item)), content: item.content || '' } : { name: '', content: '' }; dialogError.value = ''; editor.value?.showModal() }
async function save() {
  saving.value = true; dialogError.value = ''
  try {
    const path = '/web/prompts'
    const body = { name: draft.value.name, content: draft.value.content }
    await checked(draft.value.id ? client.put(`${path}/${draft.value.id}`, body) : client.post(path, body))
    editor.value?.close(); await load()
  } catch (cause) { dialogError.value = errorMessage(cause) } finally { saving.value = false }
}
async function remove(item: any) {
  if (!confirm(`Delete "${item.name}"?`)) return
  try { await checked(client.delete(`/web/prompts/${item.id}`)); await load() } catch (cause) { error.value = errorMessage(cause) }
}
async function copy(content: string) { try { await navigator.clipboard.writeText(content) } catch { error.value = 'Unable to copy. Open the prompt and copy its text.' } }
async function showCampaign(id: number) { try { const result = await client.get<any>(`${account}/campaigns/${id}`); selected.value = { ...result.campaign, participation: result.participation }; dialogError.value = ''; applicationNote.value = ''; clipUrl.value = ''; platform.value = selected.value.allowed_platforms?.[0] || 'tiktok' } catch (cause) { error.value = errorMessage(cause) } }
async function dialogAction(operation: () => Promise<any>, message: string) {
  saving.value = true; dialogError.value = ''
  try { await checked(operation()); dialogError.value = message; return true } catch (cause) { dialogError.value = errorMessage(cause); return false } finally { saving.value = false }
}
function applyCampaign() { return dialogAction(async () => { const result = await client.post<any>(`${account}/campaigns/${selected.value.id}/apply`, { application_note: applicationNote.value }); await showCampaign(selected.value.id); return result }, 'Application submitted.'); }
function submitCampaign() { return dialogAction(() => client.post(`${account}/campaigns/${selected.value.id}/submissions`, { clip_url: clipUrl.value, platform: platform.value }), 'Clip submitted.'); }
async function cancelPost() {
  if (!confirm('Cancel this scheduled post?')) return
  if (await dialogAction(() => client.post(`${account}/social/scheduled/${selected.value.id}/cancel`), 'Post canceled.')) {
    Object.assign(selected.value, { status: 'cancelled', can_cancel: false, can_edit: false }); await load()
  }
}
async function reschedulePost() {
  if (await dialogAction(() => client.put(`${account}/social/scheduled/${selected.value.id}`, { caption: selected.value.caption, scheduled_at: new Date(rescheduleAt.value).toISOString() }), 'Schedule updated.')) {
    selected.value.date = new Date(rescheduleAt.value).toISOString(); await load()
  }
}
onMounted(load)
</script>

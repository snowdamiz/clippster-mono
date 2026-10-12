<template>
  <PageLayout
    title="Hiring"
    description="Create a hiring post to recruit clippers for your organization"
    :show-header="true"
    :icon="Briefcase"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Hiring' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <Button v-if="!loadingPost && !hiringPost" variant="primary" size="sm" @click="showForm = true">
        <Plus />
        Create post
      </Button>
      <template v-else-if="hiringPost">
        <Button
          v-if="hiringPost.status === 'active' || hiringPost.status === 'paused'"
          variant="ghost"
          size="icon-sm"
          :title="hiringPost.status === 'active' ? 'Pause post' : 'Resume post'"
          :aria-label="hiringPost.status === 'active' ? 'Pause post' : 'Resume post'"
          :disabled="saving"
          @click="togglePause"
        >
          <Pause v-if="hiringPost.status === 'active'" />
          <Play v-else />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          class="hover:text-danger"
          title="Delete post"
          aria-label="Delete post"
          @click="confirmDelete"
        >
          <Trash2 />
        </Button>
        <Button variant="secondary" size="sm" @click="startEdit">
          <Pencil />
          Edit post
        </Button>
      </template>
    </template>

    <div class="flex flex-1 flex-col gap-4 px-5 py-4">
      <!-- Loading (first load only; reloads after a hire keep the post on screen) -->
      <div v-if="loadingPost && !hiringPost" class="flex flex-col gap-4" aria-busy="true">
        <div class="flex flex-col gap-2 pb-4">
          <div class="skeleton h-4 w-56" />
          <div class="skeleton h-3 w-full max-w-[560px]" />
          <div class="skeleton h-3 w-2/5" />
          <div class="mt-1 flex gap-1.5">
            <div v-for="i in 4" :key="i" class="skeleton h-[18px] w-14" />
          </div>
        </div>
        <div class="skeleton h-3.5 w-24" />
        <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          <div v-for="i in 3" :key="i" class="skeleton h-40 rounded-xl" />
        </div>
      </div>

      <!-- No post yet -->
      <EmptyState
        v-else-if="!hiringPost"
        :icon="Briefcase"
        title="No hiring post yet"
        description="Create a hiring post to let clippers know you're looking for talent"
      />

      <!-- Existing post -->
      <div v-else class="flex animate-enter flex-col gap-4">
        <!-- Post header: on the panel, figures on the right -->
        <section class="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-line-subtle pb-4">
          <div class="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <h2 class="truncate text-base font-semibold text-fg">{{ hiringPost.title }}</h2>
              <Badge :variant="postStatusVariant">{{ postStatusLabel }}</Badge>
              <Badge :variant="hiringPost.is_public ? 'brand' : 'outline'">
                <Eye v-if="hiringPost.is_public" />
                <EyeOff v-else />
                {{ hiringPost.is_public ? 'Public' : 'Hidden' }}
              </Badge>
            </div>
            <p v-if="hiringPost.description" class="line-clamp-3 max-w-[720px] text-sm text-fg-muted">
              {{ hiringPost.description }}
            </p>

            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
              <span v-if="hiringPost.payment_type" class="inline-flex items-center gap-1.5">
                <DollarSign class="size-3.5 text-fg-subtle" />
                {{ getPaymentTypeLabel(hiringPost.payment_type)
                }}{{ hiringPost.payment_details ? ` — ${hiringPost.payment_details}` : '' }}
              </span>
              <span v-if="hiringPost.experience_level" class="inline-flex items-center gap-1.5">
                <Star class="size-3.5 text-fg-subtle" />
                {{ getExperienceLevelLabel(hiringPost.experience_level) }}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <Users class="size-3.5 text-fg-subtle" />
                {{ hiringPost.streamer_count || 0 }} streamers
              </span>
            </div>

            <div
              v-if="(hiringPost.content_types || []).length || (hiringPost.platforms || []).length"
              class="flex flex-wrap items-center gap-1"
            >
              <Badge v-for="t in (hiringPost.content_types || []).slice(0, 4)" :key="t">{{ getSpecialtyTagLabel(t) }}</Badge>
              <Badge v-for="p in (hiringPost.platforms || []).slice(0, 3)" :key="p" variant="outline">
                <PlatformLogo :platform="p" size="xs" class="-ml-0.5" />
                {{ getPlatformLabel(p) }}
              </Badge>
            </div>
          </div>

          <div class="flex w-full max-w-[320px] shrink-0 flex-col gap-2.5 self-center">
            <StatGrid size="sm" :items="postStats" />
            <div
              v-if="hiringPost.clipper_slots"
              class="h-1 overflow-hidden rounded-full bg-surface-active"
              :title="`${hiringPost.clipper_slots_filled || 0} / ${hiringPost.clipper_slots} slots filled`"
            >
              <div
                class="h-full rounded-full transition-[width] duration-300"
                :class="slotsRatio >= 0.8 ? 'bg-success' : 'bg-brand'"
                :style="{ width: Math.min(100, slotsRatio * 100) + '%' }"
              />
            </div>
          </div>
        </section>

        <!-- Applications -->
        <section class="flex flex-col gap-2.5">
          <SectionHeader title="Applications" :count="applications.length || undefined">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Refresh"
              aria-label="Refresh applications"
              :disabled="loadingApps"
              @click="loadApplications"
            >
              <RefreshCw :class="{ 'animate-spin': loadingApps }" />
            </Button>
          </SectionHeader>

          <div v-if="loadingApps && !applications.length" class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            <div v-for="i in 3" :key="i" class="skeleton h-40 rounded-xl" />
          </div>

          <EmptyState
            v-else-if="!applications.length"
            size="sm"
            :icon="FileText"
            title="No applications yet"
            description="Clippers will appear here when they apply."
          />

          <div v-else class="grid animate-fade-in grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            <HiringApplicationCard
              v-for="app in applications"
              :key="app.id"
              :app="app"
              :accepting="accepting === app.id"
              :rejecting="rejecting === app.id"
              @accept="handleAccept(app)"
              @reject="handleReject(app)"
            />
          </div>
        </section>
      </div>
    </div>

    <!-- Create / edit hiring post -->
    <Modal
      :open="showForm"
      :title="hiringPost ? 'Edit hiring post' : 'Create hiring post'"
      description="Fill in the details to attract the right clippers"
      :icon="Briefcase"
      size="lg"
      :dismissible="!saving"
      @update:open="(value: boolean) => (value ? (showForm = true) : !saving && cancelEdit())"
    >
      <form id="hiring-post-form" class="flex flex-col gap-4" @submit.prevent="savePost">
        <Field label="Title" required>
          <Input v-model="form.title" type="text" placeholder="e.g. Looking for gaming clippers" required />
        </Field>
        <Field label="Description">
          <Textarea v-model="form.description" rows="3" placeholder="Describe what you're looking for..." />
        </Field>
        <Field label="Content types">
          <ToggleChips
            :options="SPECIALTY_TAGS"
            :model-value="form.content_types"
            @toggle="toggleArrayItem(form.content_types, $event)"
          />
        </Field>
        <Field label="Platforms">
          <ToggleChips
            :options="PREFERRED_PLATFORMS"
            :model-value="form.platforms"
            @toggle="toggleArrayItem(form.platforms, $event)"
          />
        </Field>
        <Field label="Languages">
          <ToggleChips
            :options="languageOptions"
            :model-value="form.languages"
            @toggle="toggleArrayItem(form.languages, $event)"
          />
        </Field>
        <div class="grid grid-cols-2 gap-3">
          <Field label="Payment type">
            <CustomDropdown v-model="form.payment_type" :options="paymentTypeOptions" placeholder="Select..." />
          </Field>
          <Field label="Payment details">
            <Input v-model="form.payment_details" type="text" placeholder="e.g. $5 CPM or $50/video" />
          </Field>
          <Field label="Minimum experience">
            <CustomDropdown v-model="form.experience_level" :options="experienceLevelOptions" placeholder="Any" />
          </Field>
          <Field label="Clippers needed">
            <Input v-model.number="form.clipper_slots" type="number" min="1" placeholder="e.g. 10" />
          </Field>
          <Field label="Number of streamers">
            <Input v-model.number="form.streamer_count" type="number" min="0" placeholder="e.g. 5" />
          </Field>
        </div>
        <Field
          label="Visible to all clippers"
          :hint="form.is_public ? 'Listed in the hiring directory' : 'Hidden from directory'"
          inline
        >
          <Switch v-model="form.is_public" />
        </Field>
      </form>

      <template #footer>
        <Button variant="ghost" :disabled="saving" @click="cancelEdit">Cancel</Button>
        <Button type="submit" form="hiring-post-form" variant="primary" :disabled="!form.title.trim()" :loading="saving">
          {{ saving ? 'Saving…' : hiringPost ? 'Save changes' : 'Create post' }}
        </Button>
      </template>
    </Modal>

    <!-- Delete confirmation -->
    <Modal
      v-model:open="showDeleteDialog"
      title="Delete hiring post"
      :icon="Trash2"
      tone="danger"
      size="sm"
      :dismissible="!deleting"
    >
      <p class="text-sm text-fg-muted">
        This will permanently delete your hiring post and all applications. This action cannot be undone.
      </p>
      <template #footer>
        <Button variant="ghost" :disabled="deleting" @click="showDeleteDialog = false">Cancel</Button>
        <Button variant="destructive" :loading="deleting" @click="deletePost">Delete</Button>
      </template>
    </Modal>

    <!-- Accept confirmation -->
    <Modal
      v-model:open="showAcceptDialog"
      title="Hire clipper"
      :icon="UserCheck"
      size="sm"
      :dismissible="accepting === null"
    >
      <p class="text-sm text-fg-muted">
        This will accept
        <span class="font-medium text-fg">{{
          acceptTarget?.clipper_profile?.display_name || acceptTarget?.user?.name || 'this clipper'
        }}</span
        >'s application and automatically add them as a member of your organization.
      </p>
      <template #footer>
        <Button variant="ghost" @click="showAcceptDialog = false">Cancel</Button>
        <Button variant="primary" :loading="accepting !== null" @click="confirmAccept">Confirm hire</Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import {
    Briefcase, Plus, Pencil, Pause, Play, Trash2, Users, Star, DollarSign, RefreshCw, FileText, UserCheck, Eye, EyeOff,
  } from 'lucide-vue-next';
  import type { BadgeVariants } from '@/components/ui/badge';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { StatGrid } from '@/components/ui/stat-card';
  import { Switch } from '@/components/ui/switch';
  import { Textarea } from '@/components/ui/textarea';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import { ToggleChips } from '@/components/ui/toggle-chips';
  import HiringApplicationCard from '@/components/organization/hiring/HiringApplicationCard.vue';
  import { useOrganization } from '@/composables/useOrganization';
  import { useToast } from '@/composables/useToast';
  import {
    getOrgHiringPost, saveOrgHiringPost, deleteOrgHiringPost,
    listHiringApplications, acceptHiringApplication, rejectHiringApplication,
    PAYMENT_TYPES, getPaymentTypeLabel,
    type HiringPost, type HiringApplication,
  } from '@/services/hiringApi';

  interface HiringFormData {
    title: string;
    description: string;
    content_types: string[];
    languages: string[];
    platforms: string[];
    payment_type: string;
    payment_details: string;
    streamer_count: number | undefined;
    clipper_slots: number | undefined;
    experience_level: string;
    status: string;
    is_public: boolean;
  }
  import {
    SPECIALTY_TAGS, PREFERRED_PLATFORMS, LANGUAGES, EXPERIENCE_LEVELS,
    getExperienceLevelLabel, getSpecialtyTagLabel, getLanguageName,
  } from '@/services/clipperProfilesApi';

  const { organizationId } = useOrganization();
  const { toast } = useToast();

  // Computed stats for header
  const postStatusLabel = computed(() => {
    if (!hiringPost.value) return 'None';
    return hiringPost.value.status.charAt(0).toUpperCase() + hiringPost.value.status.slice(1);
  });

  const postStatusVariant = computed<BadgeVariants['variant']>(() => {
    const status = hiringPost.value?.status;
    if (status === 'active') return 'success';
    if (status === 'paused') return 'warning';
    return 'neutral';
  });

  const postStats = computed(() => {
    const post = hiringPost.value;
    const filled = post?.clipper_slots_filled || 0;
    return [
      { label: 'Applicants', value: applications.value.length, hint: `${pendingApplications.value} pending` },
      {
        label: 'Slots filled',
        value: post?.clipper_slots ? `${filled}/${post.clipper_slots}` : filled,
        hint: post?.clipper_slots ? `${post.clipper_slots - filled} left` : 'No limit',
      },
    ];
  });

  /** Share of clipper slots already filled (0–1). */
  const slotsRatio = computed(() => {
    if (!hiringPost.value?.clipper_slots) return 0;
    return (hiringPost.value.clipper_slots_filled || 0) / hiringPost.value.clipper_slots;
  });

  const languageOptions = LANGUAGES.map((lang) => ({ value: lang.code, label: lang.name }));

  const pendingApplications = computed(() => {
    return applications.value.filter(a => a.status === 'pending').length;
  });

  const paymentTypeOptions = computed(() =>
    PAYMENT_TYPES.map(pt => ({ label: pt.label, value: pt.value }))
  );

  const experienceLevelOptions = computed(() =>
    EXPERIENCE_LEVELS.map(lvl => ({ label: lvl.label, value: lvl.value }))
  );

  // State
  const loadingPost = ref(true);
  const hiringPost = ref<HiringPost | null>(null);
  const showForm = ref(false);
  const saving = ref(false);

  const applications = ref<HiringApplication[]>([]);
  const loadingApps = ref(false);

  const showDeleteDialog = ref(false);
  const deleting = ref(false);

  const showAcceptDialog = ref(false);
  const acceptTarget = ref<HiringApplication | null>(null);
  const accepting = ref<number | null>(null);
  const rejecting = ref<number | null>(null);

  // Form
  const form = ref<HiringFormData>({
    title: '',
    description: '',
    content_types: [] as string[],
    languages: [] as string[],
    platforms: [] as string[],
    payment_type: '',
    payment_details: '',
    streamer_count: undefined,
    clipper_slots: undefined,
    experience_level: '',
    status: 'active',
    is_public: true,
  });

  function getPlatformLabel(value: string): string {
    return PREFERRED_PLATFORMS.find((p) => p.value === value)?.label || value;
  }

  function toggleArrayItem(arr: string[], value: string) {
    const idx = arr.indexOf(value);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(value);
  }

  function formatDate(dateStr: string): string {
    return fmtDate(dateStr);
  }

  // Load
  async function loadPost() {
    loadingPost.value = true;
    try {
      const res = await getOrgHiringPost(organizationId.value!);
      if (res.success) {
        hiringPost.value = res.hiring_post;
      }
    } catch (err) {
      console.error('Failed to load hiring post:', err);
    } finally {
      loadingPost.value = false;
    }
  }

  async function loadApplications() {
    loadingApps.value = true;
    try {
      const res = await listHiringApplications(organizationId.value!);
      if (res.success) {
        applications.value = res.applications;
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      loadingApps.value = false;
    }
  }

  // Actions
  function startEdit() {
    if (!hiringPost.value) return;
    form.value = {
      title: hiringPost.value.title,
      description: hiringPost.value.description || '',
      content_types: [...(hiringPost.value.content_types || [])],
      languages: [...(hiringPost.value.languages || [])],
      platforms: [...(hiringPost.value.platforms || [])],
      payment_type: hiringPost.value.payment_type || '',
      payment_details: hiringPost.value.payment_details || '',
      streamer_count: hiringPost.value.streamer_count || undefined,
      clipper_slots: hiringPost.value.clipper_slots || undefined,
      experience_level: hiringPost.value.experience_level || '',
      status: hiringPost.value.status,
      is_public: hiringPost.value.is_public,
    };
    showForm.value = true;
  }

  function cancelEdit() {
    showForm.value = false;
  }

  async function savePost() {
    saving.value = true;
    try {
      const res = await saveOrgHiringPost(organizationId.value!, form.value);
      if (res.success) {
        hiringPost.value = res.hiring_post;
        showForm.value = false;
        toast({ title: hiringPost.value ? 'Post updated' : 'Post created', description: 'Your hiring post has been saved.', type: 'success' });
      } else {
        toast({ title: 'Error', description: res.error || 'Failed to save', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save', type: 'error' });
    } finally {
      saving.value = false;
    }
  }

  async function togglePause() {
    if (!hiringPost.value) return;
    const newStatus = hiringPost.value.status === 'active' ? 'paused' : 'active';
    saving.value = true;
    try {
      const res = await saveOrgHiringPost(organizationId.value!, { ...form.value, title: hiringPost.value.title, status: newStatus });
      if (res.success) {
        hiringPost.value = res.hiring_post;
        toast({ title: `Post ${newStatus}` });
      }
    } finally {
      saving.value = false;
    }
  }

  function confirmDelete() {
    showDeleteDialog.value = true;
  }

  async function deletePost() {
    deleting.value = true;
    try {
      const res = await deleteOrgHiringPost(organizationId.value!);
      if (res.success) {
        hiringPost.value = null;
        applications.value = [];
        showDeleteDialog.value = false;
        toast({ title: 'Post deleted' });
      }
    } finally {
      deleting.value = false;
    }
  }

  function handleAccept(app: HiringApplication) {
    acceptTarget.value = app;
    showAcceptDialog.value = true;
  }

  async function confirmAccept() {
    if (!acceptTarget.value) return;
    accepting.value = acceptTarget.value.id;
    try {
      const res = await acceptHiringApplication(organizationId.value!, acceptTarget.value.id);
      if (res.success) {
        toast({ title: 'Clipper hired!', description: 'They have been added to your organization.' });
        showAcceptDialog.value = false;
        await loadApplications();
        await loadPost();
      } else {
        toast({ title: 'Error', description: res.error || 'Failed to accept', type: 'error' });
      }
    } finally {
      accepting.value = null;
    }
  }

  async function handleReject(app: HiringApplication) {
    rejecting.value = app.id;
    try {
      const res = await rejectHiringApplication(organizationId.value!, app.id);
      if (res.success) {
        toast({ title: 'Application rejected' });
        await loadApplications();
      }
    } finally {
      rejecting.value = null;
    }
  }

  onMounted(async () => {
    await loadPost();
    if (hiringPost.value) {
      loadApplications();
    }
  });
</script>

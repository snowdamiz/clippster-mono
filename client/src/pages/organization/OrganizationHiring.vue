<template>
  <PageLayout
    title="Hiring"
    description="Create a hiring post to recruit clippers for your organization"
    :show-header="true"
    :icon="Briefcase"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Hiring' }]"
  >
    <template #actions>
      <button
        v-if="!loadingPost && !hiringPost"
        class="org-hiring__action-btn"
        @click="showForm = true"
      >
        <Plus class="org-hiring__action-icon" />
        Create Post
      </button>
    </template>

    <div class="org-hiring">
      <!-- Page Heading -->
      <div class="org-hiring__heading">
        <h1 class="org-hiring__title">Hiring Management</h1>
        <p class="org-hiring__subtitle">
          Create a hiring post, review applications, and recruit clippers to your organization
        </p>
      </div>

      <!-- Stats Overview -->
      <div class="org-hiring__stats">
        <div class="org-hiring__stat-card">
          <div class="org-hiring__stat-indicator org-hiring__stat-indicator--status"></div>
          <div class="org-hiring__stat-inner">
            <div class="org-hiring__stat-icon org-hiring__stat-icon--status">
              <Briefcase />
            </div>
            <div class="org-hiring__stat-text">
              <h3 class="org-hiring__stat-title">Post Status</h3>
              <p class="org-hiring__stat-desc">{{ hiringPost ? hiringPost.title : 'No active post' }}</p>
            </div>
            <div class="org-hiring__stat-value" :class="postStatusClass">
              {{ hiringPost ? postStatusLabel : '—' }}
            </div>
          </div>
        </div>

        <div class="org-hiring__stat-card">
          <div class="org-hiring__stat-indicator org-hiring__stat-indicator--applicants"></div>
          <div class="org-hiring__stat-inner">
            <div class="org-hiring__stat-icon org-hiring__stat-icon--applicants">
              <FileText />
            </div>
            <div class="org-hiring__stat-text">
              <h3 class="org-hiring__stat-title">Applicants</h3>
              <p class="org-hiring__stat-desc">{{ hiringPost ? `${pendingApplications} pending review` : 'No active post' }}</p>
            </div>
            <div class="org-hiring__stat-value org-hiring__stat-value--applicants">{{ hiringPost ? applications.length : '—' }}</div>
          </div>
        </div>

        <div class="org-hiring__stat-card">
          <div class="org-hiring__stat-indicator org-hiring__stat-indicator--slots"></div>
          <div class="org-hiring__stat-inner">
            <div class="org-hiring__stat-icon org-hiring__stat-icon--slots">
              <UserCheck />
            </div>
            <div class="org-hiring__stat-text">
              <h3 class="org-hiring__stat-title">Slots Filled</h3>
              <p class="org-hiring__stat-desc">{{ hiringPost?.clipper_slots ? `${hiringPost.clipper_slots - (hiringPost.clipper_slots_filled || 0)} remaining` : 'No limit set' }}</p>
            </div>
            <div class="org-hiring__stat-value org-hiring__stat-value--slots">
              {{ hiringPost ? `${hiringPost.clipper_slots_filled || 0}${hiringPost.clipper_slots ? '/' + hiringPost.clipper_slots : ''}` : '—' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loadingPost" class="org-hiring__loading">
        <Loader2 class="org-hiring__spinner" />
        <span>Loading hiring post...</span>
      </div>

      <!-- No Post Yet -->
      <template v-else-if="!hiringPost">
        <div class="org-hiring__empty">
          <div class="org-hiring__empty-icon-wrapper">
            <Briefcase class="org-hiring__empty-icon" />
          </div>
          <h3 class="org-hiring__empty-title">No hiring post yet</h3>
          <p class="org-hiring__empty-text">Create a hiring post to let clippers know you're looking for talent</p>
          <button class="org-hiring__create-btn" @click="showForm = true">
            <Plus class="org-hiring__create-btn-icon" />
            Create Hiring Post
          </button>
        </div>
      </template>

      <!-- Existing Post View -->
      <template v-else-if="hiringPost">
        <!-- Post Card (Campaign-style) -->
        <div class="org-hiring__post-card">
          <!-- Card Content -->
          <div class="org-hiring__post-content">
            <!-- Info -->
            <div class="org-hiring__post-info">
              <div class="org-hiring__post-title-row">
                <h3 class="org-hiring__post-name">{{ hiringPost.title }}</h3>
                <span
                  class="org-hiring__status-badge"
                  :class="{
                    'org-hiring__status-badge--active': hiringPost.status === 'active',
                    'org-hiring__status-badge--paused': hiringPost.status === 'paused',
                    'org-hiring__status-badge--closed': hiringPost.status === 'closed',
                  }"
                >
                  {{ hiringPost.status }}
                </span>
                <span v-if="hiringPost.is_public" class="org-hiring__visibility-badge org-hiring__visibility-badge--public">Public</span>
                <span v-else class="org-hiring__visibility-badge">Hidden</span>
              </div>
              <p v-if="hiringPost.description" class="org-hiring__post-desc">{{ hiringPost.description }}</p>

              <!-- Meta Row -->
              <div class="org-hiring__post-meta">
                <span v-if="hiringPost.payment_type" class="org-hiring__post-meta-item">
                  <DollarSign class="org-hiring__post-meta-icon" />
                  {{ getPaymentTypeLabel(hiringPost.payment_type) }}{{ hiringPost.payment_details ? ` — ${hiringPost.payment_details}` : '' }}
                </span>
                <span v-if="hiringPost.experience_level" class="org-hiring__post-meta-item">
                  <Star class="org-hiring__post-meta-icon" />
                  {{ getExperienceLevelLabel(hiringPost.experience_level) }}
                </span>
              </div>

              <!-- Tags -->
              <div class="org-hiring__post-tags-row">
                <span v-for="t in (hiringPost.content_types || []).slice(0, 4)" :key="t" class="org-hiring__post-tag">{{ getSpecialtyTagLabel(t) }}</span>
                <span v-for="p in (hiringPost.platforms || []).slice(0, 3)" :key="p" class="org-hiring__post-tag org-hiring__post-tag--platform">{{ getPlatformLabel(p) }}</span>
              </div>
            </div>

            <!-- Stats Row -->
            <div class="org-hiring__post-stats">
              <div class="org-hiring__post-stat">
                <span class="org-hiring__post-stat-value">{{ hiringPost.clipper_slots_filled || 0 }}{{ hiringPost.clipper_slots ? '/' + hiringPost.clipper_slots : '' }}</span>
                <span class="org-hiring__post-stat-label">slots filled</span>
              </div>
              <div class="org-hiring__post-stat">
                <span class="org-hiring__post-stat-value">{{ applications.length }}</span>
                <span class="org-hiring__post-stat-label">applicants</span>
              </div>
              <div class="org-hiring__post-stat">
                <span class="org-hiring__post-stat-value">{{ hiringPost.streamer_count || 0 }}</span>
                <span class="org-hiring__post-stat-label">streamers</span>
              </div>
            </div>

            <!-- Slots Progress -->
            <div v-if="hiringPost.clipper_slots" class="org-hiring__slots-progress">
              <div class="org-hiring__slots-bar">
                <div
                  class="org-hiring__slots-fill"
                  :style="{ width: Math.min(100, ((hiringPost.clipper_slots_filled || 0) / hiringPost.clipper_slots) * 100) + '%' }"
                  :class="{
                    'org-hiring__slots-fill--low': ((hiringPost.clipper_slots_filled || 0) / hiringPost.clipper_slots) < 0.5,
                    'org-hiring__slots-fill--medium': ((hiringPost.clipper_slots_filled || 0) / hiringPost.clipper_slots) >= 0.5 && ((hiringPost.clipper_slots_filled || 0) / hiringPost.clipper_slots) < 0.8,
                    'org-hiring__slots-fill--high': ((hiringPost.clipper_slots_filled || 0) / hiringPost.clipper_slots) >= 0.8,
                  }"
                ></div>
              </div>
              <span class="org-hiring__slots-text">{{ hiringPost.clipper_slots_filled || 0 }} / {{ hiringPost.clipper_slots }} slots filled</span>
            </div>

            <!-- Actions -->
            <div class="org-hiring__post-actions">
              <button class="org-hiring__post-action-btn" @click="startEdit">
                <Pencil class="org-hiring__post-action-icon" />
              </button>
              <button
                v-if="hiringPost.status === 'active'"
                class="org-hiring__post-action-btn"
                @click="togglePause"
              >
                <Pause class="org-hiring__post-action-icon" />
              </button>
              <button
                v-else-if="hiringPost.status === 'paused'"
                class="org-hiring__post-action-btn"
                @click="togglePause"
              >
                <Play class="org-hiring__post-action-icon" />
              </button>
              <button class="org-hiring__post-action-btn org-hiring__post-action-btn--danger" @click="confirmDelete">
                <Trash2 class="org-hiring__post-action-icon" />
              </button>
            </div>
          </div>
        </div>

        <!-- Applications Section -->
        <div class="org-hiring__applications">
          <div class="org-hiring__applications-header">
            <h3 class="org-hiring__applications-title">
              Applications
              <span v-if="applications.length" class="org-hiring__applications-count">{{ applications.length }}</span>
            </h3>
            <button class="org-hiring__refresh-btn" @click="loadApplications" :disabled="loadingApps">
              <Loader2 v-if="loadingApps" class="org-hiring__refresh-icon org-hiring__refresh-icon--spinning" />
              <RefreshCw v-else class="org-hiring__refresh-icon" />
            </button>
          </div>

          <div v-if="loadingApps && !applications.length" class="org-hiring__loading">
            <Loader2 class="org-hiring__spinner" />
          </div>

          <div v-else-if="!applications.length" class="org-hiring__applications-empty">
            <p>No applications yet. Clippers will appear here when they apply.</p>
          </div>

          <!-- Applicant Cards Grid (Clippers-style) -->
          <div v-else class="org-hiring__app-grid">
            <div v-for="app in applications" :key="app.id" class="org-hiring__app-card">
              <!-- Status Bar -->
              <div class="org-hiring__app-status-bar">
                <span
                  class="org-hiring__app-status-badge"
                  :class="{
                    'org-hiring__app-status-badge--pending': app.status === 'pending',
                    'org-hiring__app-status-badge--accepted': app.status === 'accepted',
                    'org-hiring__app-status-badge--rejected': app.status === 'rejected',
                  }"
                >
                  {{ app.status }}
                </span>
                <span class="org-hiring__app-date">Applied {{ formatDate(app.inserted_at) }}</span>
              </div>

              <!-- Main Content -->
              <router-link
                v-if="app.clipper_profile?.slug"
                :to="{ path: `/clippers/${app.clipper_profile.slug}`, query: { from: $route.fullPath } }"
                class="org-hiring__app-main"
              >
                <div class="org-hiring__app-header">
                  <div class="org-hiring__app-avatar">
                    <img v-if="app.clipper_profile?.avatar_url" :src="app.clipper_profile.avatar_url" class="org-hiring__app-avatar-img" />
                    <UserCircle v-else class="org-hiring__app-avatar-icon" />
                  </div>
                  <div class="org-hiring__app-info">
                    <div class="org-hiring__app-name">
                      {{ app.clipper_profile?.display_name || app.user?.name || app.user?.email || 'Unknown' }}
                      <CheckCircle v-if="app.clipper_profile?.is_verified" class="org-hiring__verified-badge" />
                    </div>
                    <div v-if="app.clipper_profile?.experience_level" class="org-hiring__app-level">
                      {{ getExperienceLevelLabel(app.clipper_profile.experience_level) }}
                    </div>
                    <p v-if="app.message" class="org-hiring__app-bio">{{ app.message }}</p>
                  </div>
                </div>

                <!-- Stats Row -->
                <div v-if="app.clipper_profile" class="org-hiring__app-stats-row">
                  <div class="org-hiring__app-stat">
                    <Video class="org-hiring__app-stat-icon" />
                    <span class="org-hiring__app-stat-value">{{ app.clipper_profile.total_clips_delivered || 0 }}</span>
                    <span class="org-hiring__app-stat-label">clips</span>
                  </div>
                  <div class="org-hiring__app-stat">
                    <Star class="org-hiring__app-stat-icon org-hiring__app-stat-icon--star" />
                    <span class="org-hiring__app-stat-value">{{ app.clipper_profile.total_endorsements || 0 }}</span>
                    <span class="org-hiring__app-stat-label">reviews</span>
                  </div>
                  <div class="org-hiring__app-stat">
                    <Briefcase class="org-hiring__app-stat-icon org-hiring__app-stat-icon--campaigns" />
                    <span class="org-hiring__app-stat-value">{{ app.clipper_profile.total_campaigns_completed || 0 }}</span>
                    <span class="org-hiring__app-stat-label">campaigns</span>
                  </div>
                </div>

                <!-- Tags -->
                <div v-if="app.clipper_profile?.specialty_tags?.length" class="org-hiring__app-tags-row">
                  <span v-for="tag in app.clipper_profile.specialty_tags.slice(0, 3)" :key="tag" class="org-hiring__app-tag">{{ getSpecialtyTagLabel(tag) }}</span>
                  <span v-if="app.clipper_profile.specialty_tags.length > 3" class="org-hiring__app-tag-more">+{{ app.clipper_profile.specialty_tags.length - 3 }}</span>
                </div>
              </router-link>
              <div v-else class="org-hiring__app-main">
                <div class="org-hiring__app-header">
                  <div class="org-hiring__app-avatar">
                    <UserCircle class="org-hiring__app-avatar-icon" />
                  </div>
                  <div class="org-hiring__app-info">
                    <div class="org-hiring__app-name">{{ app.user?.name || app.user?.email || 'Unknown' }}</div>
                    <p v-if="app.message" class="org-hiring__app-bio">{{ app.message }}</p>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="org-hiring__app-actions">
                <router-link
                  v-if="app.clipper_profile?.user_id"
                  :to="`/messages?to=${app.clipper_profile.user_id}`"
                  class="org-hiring__app-action-btn org-hiring__app-action-btn--message"
                >
                  <MessageCircle class="org-hiring__app-action-icon" />
                  Message
                </router-link>
                <template v-if="app.status === 'pending'">
                  <button class="org-hiring__app-action-btn org-hiring__app-action-btn--accept" @click="handleAccept(app)" :disabled="accepting === app.id">
                    <Loader2 v-if="accepting === app.id" class="org-hiring__btn-spinner" />
                    <CheckCircle v-else class="org-hiring__app-action-icon" />
                    Hire
                  </button>
                  <button class="org-hiring__app-action-btn org-hiring__app-action-btn--reject" @click="handleReject(app)" :disabled="rejecting === app.id">
                    <Loader2 v-if="rejecting === app.id" class="org-hiring__btn-spinner" />
                    <X v-else class="org-hiring__app-action-icon" />
                    Reject
                  </button>
                </template>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Create/Edit Hiring Post Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showForm" class="hw__overlay" @click.self="showForm = false">
          <Transition name="dialog" appear>
            <div class="hw">
              <div class="hw__accent"></div>

              <button class="hw__close" @click="cancelEdit" :disabled="saving" title="Close">
                <X :size="18" />
              </button>

              <div class="hw__content">
                <div class="hw__header">
                  <div class="hw__icon">
                    <Briefcase :size="28" />
                  </div>
                  <h2 class="hw__title">{{ hiringPost ? 'Edit Hiring Post' : 'Create Hiring Post' }}</h2>
                  <p class="hw__subtitle">Fill in the details to attract the right clippers</p>
                </div>

                <form class="hw__fields" @submit.prevent="savePost">
                  <div class="hw__field">
                    <label class="hw__label">Title *</label>
                    <input v-model="form.title" type="text" class="hw__input" placeholder="e.g. Looking for Gaming Clippers" required />
                  </div>

                  <div class="hw__field">
                    <label class="hw__label">Description</label>
                    <textarea v-model="form.description" class="hw__textarea" rows="3" placeholder="Describe what you're looking for..." />
                  </div>

                  <div class="hw__field">
                    <label class="hw__label">Content Types</label>
                    <div class="hw__tags">
                      <button
                        v-for="tag in SPECIALTY_TAGS" :key="tag.value" type="button"
                        class="hw__tag" :class="{ 'hw__tag--selected': form.content_types.includes(tag.value) }"
                        @click="toggleArrayItem(form.content_types, tag.value)"
                      >{{ tag.label }}</button>
                    </div>
                  </div>

                  <div class="hw__field">
                    <label class="hw__label">Platforms</label>
                    <div class="hw__tags">
                      <button
                        v-for="p in PREFERRED_PLATFORMS" :key="p.value" type="button"
                        class="hw__tag" :class="{ 'hw__tag--selected': form.platforms.includes(p.value) }"
                        @click="toggleArrayItem(form.platforms, p.value)"
                      >{{ p.label }}</button>
                    </div>
                  </div>

                  <div class="hw__field">
                    <label class="hw__label">Languages</label>
                    <div class="hw__tags">
                      <button
                        v-for="lang in LANGUAGES" :key="lang.code" type="button"
                        class="hw__tag" :class="{ 'hw__tag--selected': form.languages.includes(lang.code) }"
                        @click="toggleArrayItem(form.languages, lang.code)"
                      >{{ lang.name }}</button>
                    </div>
                  </div>

                  <div class="hw__row">
                    <div class="hw__field">
                      <label class="hw__label">Payment Type</label>
                      <CustomDropdown
                        v-model="form.payment_type"
                        :options="paymentTypeOptions"
                        placeholder="Select..."
                        trigger-class="hw__dropdown-trigger"
                      />
                    </div>
                    <div class="hw__field">
                      <label class="hw__label">Payment Details</label>
                      <input v-model="form.payment_details" type="text" class="hw__input" placeholder="e.g. $5 CPM or $50/video" />
                    </div>
                  </div>

                  <div class="hw__row">
                    <div class="hw__field">
                      <label class="hw__label">Minimum Experience</label>
                      <CustomDropdown
                        v-model="form.experience_level"
                        :options="experienceLevelOptions"
                        placeholder="Any"
                        trigger-class="hw__dropdown-trigger"
                      />
                    </div>
                    <div class="hw__field">
                      <label class="hw__label">Clippers Needed</label>
                      <input v-model.number="form.clipper_slots" type="number" class="hw__input" min="1" placeholder="e.g. 10" />
                    </div>
                  </div>

                  <div class="hw__row">
                    <div class="hw__field">
                      <label class="hw__label">Number of Streamers</label>
                      <input v-model.number="form.streamer_count" type="number" class="hw__input" min="0" placeholder="e.g. 5" />
                    </div>
                    <div class="hw__field">
                      <label class="hw__label">Visibility</label>
                      <div class="hw__toggle-row">
                        <button type="button" class="hw__toggle" :class="{ 'hw__toggle--active': form.is_public }" @click="form.is_public = !form.is_public">
                          <span class="hw__toggle-handle"></span>
                        </button>
                        <span class="hw__toggle-label">{{ form.is_public ? 'Visible to all clippers' : 'Hidden from directory' }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="hw__footer">
                    <button type="button" class="hw__btn hw__btn--secondary" @click="cancelEdit" :disabled="saving">Cancel</button>
                    <button type="submit" class="hw__btn hw__btn--primary" :disabled="saving || !form.title.trim()">
                      <Loader2 v-if="saving" class="hw__btn-spinner" />
                      {{ saving ? 'Saving...' : hiringPost ? 'Save Changes' : 'Create Post' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="org-hiring__dialog">
        <DialogHeader>
          <DialogTitle>Delete Hiring Post</DialogTitle>
          <DialogDescription>
            This will permanently delete your hiring post and all applications. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" @click="deletePost" :disabled="deleting">
            <Loader2 v-if="deleting" class="org-hiring__btn-spinner" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Accept Confirmation Dialog -->
    <Dialog v-model:open="showAcceptDialog">
      <DialogContent class="org-hiring__dialog">
        <DialogHeader>
          <DialogTitle>Hire Clipper</DialogTitle>
          <DialogDescription>
            This will accept {{ acceptTarget?.clipper_profile?.display_name || acceptTarget?.user?.name || 'this clipper' }}'s application and automatically add them as a member of your organization.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showAcceptDialog = false">Cancel</Button>
          <Button @click="confirmAccept" :disabled="accepting !== null">
            <Loader2 v-if="accepting !== null" class="org-hiring__btn-spinner" />
            Confirm Hire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import {
    Briefcase, Loader2, Plus, Pencil, Pause, Play, Trash2, Users, Video, Star,
    DollarSign, UserCircle, CheckCircle, X, RefreshCw, FileText, UserCheck, MessageCircle,
  } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  } from '@/components/ui/dialog';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
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

  const postStatusClass = computed(() => {
    if (!hiringPost.value) return '';
    const s = hiringPost.value.status;
    if (s === 'active') return 'org-hiring__stat-value--active';
    if (s === 'paused') return 'org-hiring__stat-value--paused';
    return 'org-hiring__stat-value--closed';
  });

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
    return new Date(dateStr).toLocaleDateString();
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

<style scoped>
  /* ===== Page Container ===== */
  .org-hiring {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* ===== Action Button ===== */
  .org-hiring__action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }
  .org-hiring__action-btn:hover { opacity: 0.9; }
  .org-hiring__action-icon { width: 14px; height: 14px; }

  /* ===== Page Heading ===== */
  .org-hiring__heading {
    margin-bottom: 0.5rem;
  }
  .org-hiring__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }
  .org-hiring__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Stats Overview ===== */
  .org-hiring__stats {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }
  @media (min-width: 768px) {
    .org-hiring__stats { grid-template-columns: repeat(3, 1fr); }
  }
  .org-hiring__stat-card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }
  .org-hiring__stat-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
  .org-hiring__stat-indicator {
    width: 4px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }
  .org-hiring__stat-indicator--status { background: linear-gradient(to bottom, #fb923c 0%, #ea580c 100%); }
  .org-hiring__stat-indicator--applicants { background: linear-gradient(to bottom, #a78bfa 0%, #7c3aed 100%); }
  .org-hiring__stat-indicator--slots { background: linear-gradient(to bottom, #34d399 0%, #059669 100%); }

  .org-hiring__stat-inner {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.25rem;
  }
  .org-hiring__stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }
  .org-hiring__stat-icon svg { width: 20px; height: 20px; }
  .org-hiring__stat-icon--status { background-color: rgba(251, 146, 60, 0.15); color: #fb923c; }
  .org-hiring__stat-icon--applicants { background-color: rgba(167, 139, 250, 0.15); color: #a78bfa; }
  .org-hiring__stat-icon--slots { background-color: rgba(52, 211, 153, 0.15); color: #34d399; }

  .org-hiring__stat-text { flex: 1; min-width: 0; }
  .org-hiring__stat-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }
  .org-hiring__stat-desc {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }
  .org-hiring__stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: #fb923c;
    letter-spacing: -0.02em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .org-hiring__stat-value--active { color: #22c55e; }
  .org-hiring__stat-value--paused { color: #eab308; }
  .org-hiring__stat-value--closed { color: #71717a; }
  .org-hiring__stat-value--applicants { color: #a78bfa; }
  .org-hiring__stat-value--slots { color: #34d399; }

  /* Loading */
  .org-hiring__loading {
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    padding: 4rem 0; color: var(--zinc-500, #71717a); font-size: 0.875rem;
  }
  .org-hiring__spinner { width: 1.25rem; height: 1.25rem; animation: spin 1s linear infinite; }

  /* Empty State */
  .org-hiring__empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 4rem 2rem;
  }
  .org-hiring__empty-icon-wrapper {
    display: flex; align-items: center; justify-content: center;
    width: 72px; height: 72px; border-radius: 1rem;
    background: rgba(251, 146, 60, 0.1); margin-bottom: 1.5rem;
  }
  .org-hiring__empty-icon { width: 36px; height: 36px; color: #fb923c; }
  .org-hiring__empty-title { font-size: 1.125rem; font-weight: 600; color: white; margin: 0 0 0.5rem; }
  .org-hiring__empty-text { font-size: 0.875rem; color: var(--zinc-500, #71717a); margin: 0 0 1.5rem; max-width: 320px; }
  .org-hiring__create-btn {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem 1rem; border-radius: 0.5rem; border: none;
    background: #22d3ee; color: #0a0a0b; font-size: 0.875rem; font-weight: 600;
    cursor: pointer; transition: opacity 0.15s;
  }
  .org-hiring__create-btn:hover { opacity: 0.9; }
  .org-hiring__create-btn-icon { width: 1rem; height: 1rem; }

  .org-hiring__btn-spinner { width: 1rem; height: 1rem; animation: spin 1s linear infinite; }

  /* ===== Post Card (Campaign-style) ===== */
  .org-hiring__post-card {
    display: flex;
    flex-direction: column;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    max-width: 420px;
  }

  .org-hiring__post-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .org-hiring__status-badge {
    padding: 0.25rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-radius: 5px;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    background-color: rgba(113, 113, 122, 0.9);
    color: white;
  }
  .org-hiring__status-badge--active { background-color: rgba(16, 185, 129, 0.95); }
  .org-hiring__status-badge--paused { background-color: rgba(245, 158, 11, 0.95); }
  .org-hiring__status-badge--closed { background-color: rgba(113, 113, 122, 0.95); }

  .org-hiring__visibility-badge {
    padding: 0.25rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-radius: 5px;
    background-color: rgba(113, 113, 122, 0.15);
    color: var(--sidebar-text-muted);
  }
  .org-hiring__visibility-badge--public {
    background-color: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .org-hiring__post-content {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 1rem;
    flex: 1;
  }

  .org-hiring__post-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }
  .org-hiring__post-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .org-hiring__post-desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .org-hiring__post-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.625rem;
  }
  .org-hiring__post-meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }
  .org-hiring__post-meta-icon {
    width: 12px;
    height: 12px;
  }
  .org-hiring__post-tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
  .org-hiring__post-tag {
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.6875rem;
    background: rgba(255, 255, 255, 0.06);
    color: var(--sidebar-text-muted);
  }
  .org-hiring__post-tag--platform {
    background: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
  }

  /* Stats Row */
  .org-hiring__post-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    overflow: hidden;
  }
  .org-hiring__post-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    padding: 0.75rem 0.5rem;
    text-align: center;
  }
  .org-hiring__post-stat:not(:last-child) {
    border-right: 1px solid var(--sidebar-border);
  }
  .org-hiring__post-stat-value {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }
  .org-hiring__post-stat-label {
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 500;
    white-space: nowrap;
  }

  /* Slots Progress */
  .org-hiring__slots-progress {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .org-hiring__slots-bar {
    width: 100%;
    height: 6px;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid var(--sidebar-border);
  }
  .org-hiring__slots-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .org-hiring__slots-fill--low {
    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
  }
  .org-hiring__slots-fill--medium {
    background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
  }
  .org-hiring__slots-fill--high {
    background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
  }
  .org-hiring__slots-text {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }

  /* Post Actions */
  .org-hiring__post-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding-top: 0.75rem;
    margin-top: auto;
    border-top: 1px solid var(--sidebar-border);
  }
  .org-hiring__post-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    height: 34px;
    max-width: 100px;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 200ms ease;
  }
  .org-hiring__post-action-btn:hover {
    background-color: var(--sidebar-hover);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }
  .org-hiring__post-action-btn--danger:hover {
    border-color: #ef4444;
    color: #ef4444;
  }
  .org-hiring__post-action-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Applications Section ===== */
  .org-hiring__applications {
    margin-top: 1.5rem;
  }
  .org-hiring__applications-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  .org-hiring__applications-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .org-hiring__applications-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.375rem;
    border-radius: 999px;
    background: rgba(34, 211, 238, 0.15);
    color: #22d3ee;
    font-size: 0.6875rem;
    font-weight: 700;
  }
  .org-hiring__refresh-btn {
    padding: 0.375rem;
    border-radius: 0.375rem;
    border: 1px solid var(--sidebar-border);
    background: transparent;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }
  .org-hiring__refresh-btn:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }
  .org-hiring__refresh-icon { width: 0.875rem; height: 0.875rem; }
  .org-hiring__refresh-icon--spinning { animation: spin 1s linear infinite; }

  .org-hiring__applications-empty {
    padding: 2rem;
    text-align: center;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  /* ===== Applicant Cards Grid (Clippers-style) ===== */
  .org-hiring__app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
  }

  .org-hiring__app-card {
    display: flex;
    flex-direction: column;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    transition: all 200ms ease;
  }
  .org-hiring__app-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  /* Status Bar */
  .org-hiring__app-status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.1) 100%);
    border-bottom: 1px solid var(--sidebar-border);
  }
  .org-hiring__app-status-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 100px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .org-hiring__app-status-badge--pending {
    color: #eab308;
    background: linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(234, 179, 8, 0.1) 100%);
  }
  .org-hiring__app-status-badge--accepted {
    color: #10b981;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.15) 100%);
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.15);
  }
  .org-hiring__app-status-badge--rejected {
    color: #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%);
  }
  .org-hiring__app-date {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  /* Main Content (clickable) */
  .org-hiring__app-main {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 1rem;
    text-decoration: none;
    color: inherit;
    transition: background-color 150ms ease;
  }
  .org-hiring__app-main:hover {
    background-color: rgba(255, 255, 255, 0.02);
  }

  /* Card Header */
  .org-hiring__app-header {
    display: flex;
    gap: 0.875rem;
  }
  .org-hiring__app-avatar {
    position: relative;
    width: 52px;
    height: 52px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    background-color: var(--sidebar-hover);
  }
  .org-hiring__app-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .org-hiring__app-avatar-icon {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }
  .org-hiring__app-info {
    flex: 1;
    min-width: 0;
  }
  .org-hiring__app-name {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin-bottom: 0.125rem;
  }
  .org-hiring__verified-badge {
    width: 14px;
    height: 14px;
    color: #3b82f6;
    flex-shrink: 0;
  }
  .org-hiring__app-level {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--sidebar-accent);
    margin-bottom: 0.375rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .org-hiring__app-bio {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Stats Row */
  .org-hiring__app-stats-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 0.75rem;
    background-color: rgba(0, 0, 0, 0.15);
    border-radius: 8px;
  }
  .org-hiring__app-stat {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .org-hiring__app-stat-icon {
    width: 13px;
    height: 13px;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }
  .org-hiring__app-stat-icon--star { color: #eab308; opacity: 1; }
  .org-hiring__app-stat-icon--campaigns { color: var(--sidebar-accent); opacity: 0.8; }
  .org-hiring__app-stat-value {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }
  .org-hiring__app-stat-label {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  /* Tags Row */
  .org-hiring__app-tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
  .org-hiring__app-tag {
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.6875rem;
    background: rgba(255, 255, 255, 0.06);
    color: var(--sidebar-text-muted);
    border: 1px solid var(--sidebar-border);
  }
  .org-hiring__app-tag-more {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    font-weight: 600;
    margin-left: 0.125rem;
  }

  /* Action Buttons */
  .org-hiring__app-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--sidebar-border);
  }
  .org-hiring__app-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    flex: 1;
    height: 34px;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease;
  }
  .org-hiring__app-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .org-hiring__app-action-btn--accept {
    border-color: rgba(16, 185, 129, 0.3);
    color: #10b981;
  }
  .org-hiring__app-action-btn--accept:hover:not(:disabled) {
    background-color: rgba(16, 185, 129, 0.1);
    border-color: #10b981;
  }
  .org-hiring__app-action-btn--reject {
    border-color: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
  .org-hiring__app-action-btn--reject:hover:not(:disabled) {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
  }
  .org-hiring__app-action-btn--message {
    text-decoration: none;
    color: var(--sidebar-text-muted);
  }
  .org-hiring__app-action-btn--message:hover {
    background-color: var(--sidebar-hover);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }
  .org-hiring__app-action-icon {
    width: 14px;
    height: 14px;
  }

  /* Dialog */
  .org-hiring__dialog { max-width: 420px; }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>

<!-- Hiring Wizard Dialog (global scope for Teleport) -->
<style>
  .hw__overlay {
    position: fixed; inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; padding: 1rem;
  }
  .hw {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 14px;
    width: 100%; max-width: 600px; max-height: 90vh;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  .hw__accent {
    height: 3px; flex-shrink: 0;
    background: linear-gradient(90deg, #fb923c, #f59e0b, #ea580c);
  }
  .hw__close {
    position: absolute; top: 1.25rem; right: 1.25rem;
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    background: transparent; border: none; border-radius: 6px;
    color: var(--sidebar-text-muted); cursor: pointer;
    transition: all 150ms ease; z-index: 10;
  }
  .hw__close:hover:not(:disabled) { background-color: var(--sidebar-hover); color: var(--sidebar-text); }
  .hw__close:disabled { opacity: 0.5; cursor: not-allowed; }

  .hw__content {
    flex: 1; overflow-y: auto;
    padding: 0 2rem 1.5rem; min-height: 0;
  }
  .hw__content::-webkit-scrollbar { width: 6px; }
  .hw__content::-webkit-scrollbar-track { background: transparent; }
  .hw__content::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.15); border-radius: 3px; }

  .hw__header {
    display: flex; flex-direction: column; align-items: center;
    text-align: center; margin: 1.5rem 0 2rem;
  }
  .hw__icon {
    display: flex; align-items: center; justify-content: center;
    width: 64px; height: 64px; border-radius: 14px;
    background-color: rgba(251, 146, 60, 0.15);
    color: #fb923c; margin-bottom: 1.25rem;
  }
  .hw__title {
    font-size: 1.5rem; font-weight: 700; color: var(--sidebar-text);
    margin: 0 0 0.5rem; letter-spacing: -0.02em;
  }
  .hw__subtitle {
    font-size: 0.9375rem; color: var(--sidebar-text-muted);
    margin: 0; max-width: 400px;
  }

  .hw__fields { display: flex; flex-direction: column; gap: 1.25rem; }
  .hw__field { display: flex; flex-direction: column; gap: 0.5rem; }
  .hw__row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .hw__label { font-size: 0.875rem; font-weight: 500; color: var(--sidebar-text); }

  .hw__input, .hw__textarea {
    width: 100%; padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px; font-size: 0.9375rem;
    color: var(--sidebar-text); transition: all 150ms ease;
  }
  .hw__input::placeholder, .hw__textarea::placeholder {
    color: var(--sidebar-text-muted); opacity: 0.6;
  }
  .hw__input:focus, .hw__textarea:focus {
    outline: none; border-color: transparent;
    box-shadow: 0 0 0 2px rgba(251, 146, 60, 0.3);
  }
  .hw__textarea { resize: vertical; min-height: 90px; line-height: 1.5; font-family: inherit; }
  select.hw__input { cursor: pointer; }

  .hw__tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .hw__tag {
    padding: 0.5rem 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 20px; font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    cursor: pointer; transition: all 150ms ease;
  }
  .hw__tag:hover { background-color: var(--sidebar-active); color: var(--sidebar-text); }
  .hw__tag--selected {
    background-color: rgba(251, 146, 60, 0.15);
    border-color: rgba(251, 146, 60, 0.4);
    color: #fb923c;
  }
  .hw__tag--selected:hover { background-color: rgba(251, 146, 60, 0.2); }

  .hw__toggle-row { display: flex; align-items: center; gap: 0.75rem; padding-top: 0.25rem; }
  .hw__toggle {
    position: relative; width: 40px; height: 22px; border-radius: 999px;
    border: none; background: var(--sidebar-border); cursor: pointer; transition: background 0.2s;
  }
  .hw__toggle--active { background: #fb923c; }
  .hw__toggle-handle {
    position: absolute; top: 3px; left: 3px; width: 16px; height: 16px;
    border-radius: 50%; background: white; transition: transform 0.2s;
  }
  .hw__toggle--active .hw__toggle-handle { transform: translateX(18px); }
  .hw__toggle-label { font-size: 0.875rem; color: var(--sidebar-text-muted); }

  .hw__footer {
    display: flex; justify-content: flex-end; gap: 0.75rem;
    padding-top: 1.5rem; border-top: 1px solid var(--sidebar-border);
    margin-top: 1.5rem;
  }
  .hw__btn {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.625rem 1.25rem; border-radius: 8px; border: none;
    font-size: 0.9375rem; font-weight: 600; cursor: pointer; transition: all 150ms ease;
  }
  .hw__btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .hw__btn--primary { background: var(--sidebar-accent); color: var(--sidebar-bg); }
  .hw__btn--primary:hover:not(:disabled) { opacity: 0.9; }
  .hw__btn--secondary {
    background: transparent; border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text-muted);
  }
  .hw__btn--secondary:hover:not(:disabled) { border-color: rgba(255, 255, 255, 0.2); color: var(--sidebar-text); }
  .hw__btn-spinner { width: 1rem; height: 1rem; animation: spin 1s linear infinite; }

  /* Dropdown trigger override */
  .hw__dropdown-trigger {
    width: 100%; padding: 0.75rem 1rem !important;
    background-color: var(--sidebar-hover) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important; font-size: 0.9375rem !important;
    color: var(--sidebar-text) !important; transition: all 150ms ease;
  }
  .hw__dropdown-trigger:hover {
    border-color: rgba(255, 255, 255, 0.15) !important;
  }

  /* Transitions */
  .modal-enter-active, .modal-leave-active { transition: opacity 200ms ease; }
  .modal-enter-from, .modal-leave-to { opacity: 0; }
  .dialog-enter-active { transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); }
  .dialog-leave-active { transition: all 150ms ease-in; }
  .dialog-enter-from { opacity: 0; transform: scale(0.95) translateY(10px); }
  .dialog-leave-to { opacity: 0; transform: scale(0.97); }
</style>

<template>
  <PageLayout
    title="Organization Settings"
    description="Manage your organization profile and preferences"
    :show-header="true"
    :icon="Settings"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Settings' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <router-link
        v-if="organization?.slug"
        :to="`/orgs/${organization.slug}`"
        class="org-settings__action-btn"
        style="background: transparent; color: var(--sidebar-text); border: 1px solid var(--sidebar-border); margin-right: .5rem;"
      >
        Preview Public Profile
      </router-link>
      <button type="button" class="edit-btn" @click="showEditProfileDialog = true">
        <Pencil class="edit-btn__icon" />
        Edit Profile
      </button>
      <button
        v-if="hasChanges"
        type="button"
        @click="handleUpdateOrganization"
        :disabled="saving"
        class="org-settings__action-btn"
      >
        <Loader2 v-if="saving" class="org-settings__action-icon org-settings__action-icon--spin" />
        <Save v-else class="org-settings__action-icon" />
        {{ saving ? 'Saving...' : 'Save Changes' }}
      </button>
    </template>

    <div class="clipper-profile">
      <div class="profile-page">
      <div class="profile-header-card">
        <div class="profile-header-bg"></div>
        <div class="profile-header-content">
          <div class="profile-header-main">
            <div class="profile-avatar">
              <img v-if="organization?.logo_url && !logoLoadError" :src="organization.logo_url" class="profile-avatar__img" />
              <Building2 v-else class="profile-avatar__fallback" />
            </div>
            <div class="profile-info">
              <div class="profile-name-row">
                <h1 class="profile-name">{{ organization?.name || 'Organization' }}</h1>
              </div>
              <p class="profile-bio">{{ editData.bio || editData.description || 'Add your organization info for members and applicants.' }}</p>
              <div v-if="editData.content_type_tags?.length" class="profile-tags">
                <span v-for="tag in editData.content_type_tags.slice(0, 8)" :key="tag" class="profile-tag">{{ SPECIALTY_TAGS.find((t) => t.value === tag)?.label || tag }}</span>
              </div>
            </div>
          </div>
          <div class="profile-stats-grid">
            <div class="profile-stat-card">
              <div class="profile-stat-card__icon profile-stat-card__icon--purple"><Megaphone :size="18" /></div>
              <div class="profile-stat-card__content">
                <span class="profile-stat-card__value">0</span>
                <span class="profile-stat-card__label">Campaigns</span>
              </div>
            </div>
            <div class="profile-stat-card">
              <div class="profile-stat-card__icon profile-stat-card__icon--cyan"><Users :size="18" /></div>
              <div class="profile-stat-card__content">
                <span class="profile-stat-card__value">0</span>
                <span class="profile-stat-card__label">Members</span>
              </div>
            </div>
            <div class="profile-stat-card">
              <div class="profile-stat-card__icon profile-stat-card__icon--green"><CheckCircle :size="18" /></div>
              <div class="profile-stat-card__content">
                <span class="profile-stat-card__value">{{ editData.content_type_tags.length }}</span>
                <span class="profile-stat-card__label">Content Types</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav class="tabs-nav">
        <div class="tabs-container">
          <button class="tab-button" :class="{ 'tab-button--active': activeTab === 'basic' }" @click="activeTab = 'basic'"><div class="tab-button__icon"><Type /></div><span class="tab-button__label">Basic</span></button>
          <button class="tab-button" :class="{ 'tab-button--active': activeTab === 'ai' }" @click="activeTab = 'ai'"><div class="tab-button__icon"><Sparkles /></div><span class="tab-button__label">AI</span></button>
          <button class="tab-button" :class="{ 'tab-button--active': activeTab === 'restrictions' }" @click="activeTab = 'restrictions'"><div class="tab-button__icon"><Shield /></div><span class="tab-button__label">Restrictions</span></button>
          <button v-if="isOwner" class="tab-button" :class="{ 'tab-button--active': activeTab === 'danger' }" @click="activeTab = 'danger'"><div class="tab-button__icon"><AlertTriangle /></div><span class="tab-button__label">Danger</span></button>
        </div>
      </nav>
      <main class="content">

      <!-- Organization Profile Section -->
      <section v-show="activeTab === 'basic'" class="org-settings__section">
        <h3 class="org-settings__clipper-title">Basic Information</h3>
        <div class="org-settings__form-card">
          <div class="org-settings__form-row">
            <div class="org-basic-preview">
              <div class="org-basic-preview__avatar">
                <img v-if="organization?.logo_url && !logoLoadError" :src="organization.logo_url" class="org-basic-preview__avatar-img" @error="logoLoadError = true" />
                <Building2 v-else class="org-basic-preview__avatar-fallback" />
              </div>
              <div class="org-basic-preview__info">
                <div class="org-basic-preview__name">{{ editData.name || 'Organization' }}</div>
                <div class="org-basic-preview__desc">{{ editData.description || 'No description yet' }}</div>
              </div>
              <button type="button" class="profile-action-btn profile-action-btn--primary" @click="showEditProfileDialog = true">
                <Pencil :size="14" />
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- AI Features Section -->
      <section v-show="activeTab === 'ai'" class="org-settings__section">
        <h3 class="org-settings__clipper-title">AI Features</h3>

        <div class="org-settings__feature-card" @click="editData.settings.allow_ai = !editData.settings.allow_ai">
          <div class="org-settings__feature-inner">
            <div
              class="org-settings__feature-icon"
              :class="{ 'org-settings__feature-icon--active': editData.settings.allow_ai }"
            >
              <Zap />
            </div>
            <div class="org-settings__feature-info">
              <div class="org-settings__feature-title">Enable AI Features</div>
              <div class="org-settings__feature-desc">
                Allow members to use AI-powered features like auto-captions, clip finder, smart transcription, and more
              </div>
              <div class="org-settings__feature-tags">
                <span class="org-settings__feature-tag">Auto-Captions</span>
                <span class="org-settings__feature-tag">Clip Finder</span>
                <span class="org-settings__feature-tag">Smart Transcription</span>
              </div>
            </div>
            <button
              type="button"
              class="org-settings__toggle"
              :class="{ 'org-settings__toggle--active': editData.settings.allow_ai }"
              @click.stop="editData.settings.allow_ai = !editData.settings.allow_ai"
            >
              <span class="org-settings__toggle-handle"></span>
            </button>
          </div>
        </div>
      </section>

      <!-- Restricted Member Settings Section -->
      <section v-show="activeTab === 'restrictions'" class="org-settings__section">
        <h3 class="org-settings__clipper-title">Restricted Member Settings</h3>

        <div class="org-settings__restrictions-grid">
          <div class="org-settings__restrictions-card">
            <div class="org-settings__restrictions-header">
              <Sparkles class="org-settings__restrictions-icon" />
              <span class="org-settings__restrictions-title">AI & Detection</span>
            </div>
            <div class="org-settings__restrictions-item">
              <div class="org-settings__restrictions-item-info">
                <div class="org-settings__restrictions-item-title">Enable AI Features</div>
                <div class="org-settings__restrictions-item-desc">Auto-detect, captions, transcription</div>
              </div>
              <button
                type="button"
                class="org-settings__toggle"
                :class="{ 'org-settings__toggle--active': editData.restriction_defaults?.allow_ai }"
                @click="toggleRestriction('allow_ai')"
              >
                <span class="org-settings__toggle-handle"></span>
              </button>
            </div>
          </div>

          <div class="org-settings__restrictions-card">
            <div class="org-settings__restrictions-header">
              <Archive class="org-settings__restrictions-icon" />
              <span class="org-settings__restrictions-title">Content & Assets</span>
            </div>
            <div class="org-settings__restrictions-item">
              <div class="org-settings__restrictions-item-info">
                <div class="org-settings__restrictions-item-title">Allow personal assets</div>
                <div class="org-settings__restrictions-item-desc">Upload intros, outros, watermarks</div>
              </div>
              <button
                type="button"
                class="org-settings__toggle"
                :class="{ 'org-settings__toggle--active': editData.restriction_defaults?.allow_asset_uploads }"
                @click="toggleRestriction('allow_asset_uploads')"
              >
                <span class="org-settings__toggle-handle"></span>
              </button>
            </div>
            <div class="org-settings__restrictions-item">
              <div class="org-settings__restrictions-item-info">
                <div class="org-settings__restrictions-item-title">Allow custom prompts</div>
                <div class="org-settings__restrictions-item-desc">Create custom AI prompts</div>
              </div>
              <button
                type="button"
                class="org-settings__toggle"
                :class="{ 'org-settings__toggle--active': editData.restriction_defaults?.allow_custom_prompts }"
                @click="toggleRestriction('allow_custom_prompts')"
              >
                <span class="org-settings__toggle-handle"></span>
              </button>
            </div>
            <div class="org-settings__restrictions-item">
              <div class="org-settings__restrictions-item-info">
                <div class="org-settings__restrictions-item-title">Force organization watermark</div>
                <div class="org-settings__restrictions-item-desc">Required on all exports</div>
              </div>
              <button
                type="button"
                class="org-settings__toggle"
                :class="{ 'org-settings__toggle--active': editData.restriction_defaults?.force_org_watermark }"
                @click="toggleRestriction('force_org_watermark')"
              >
                <span class="org-settings__toggle-handle"></span>
              </button>
            </div>
          </div>

          <div class="org-settings__restrictions-card">
            <div class="org-settings__restrictions-header">
              <CheckCircle class="org-settings__restrictions-icon" />
              <span class="org-settings__restrictions-title">Publishing & Approval</span>
            </div>
            <div class="org-settings__restrictions-item">
              <div class="org-settings__restrictions-item-info">
                <div class="org-settings__restrictions-item-title">Require clip approval</div>
                <div class="org-settings__restrictions-item-desc">Admin review before publishing</div>
              </div>
              <button
                type="button"
                class="org-settings__toggle"
                :class="{ 'org-settings__toggle--active': editData.restriction_defaults?.require_clip_approval }"
                @click="toggleRestriction('require_clip_approval')"
              >
                <span class="org-settings__toggle-handle"></span>
              </button>
            </div>
            <div class="org-settings__restrictions-item">
              <div class="org-settings__restrictions-item-info">
                <div class="org-settings__restrictions-item-title">Allow clip deletion</div>
                <div class="org-settings__restrictions-item-desc">Members can delete their clips</div>
              </div>
              <button
                type="button"
                class="org-settings__toggle"
                :class="{ 'org-settings__toggle--active': editData.restriction_defaults?.allow_clip_deletion }"
                @click="toggleRestriction('allow_clip_deletion')"
              >
                <span class="org-settings__toggle-handle"></span>
              </button>
            </div>
          </div>

          <div class="org-settings__restrictions-card">
            <div class="org-settings__restrictions-header">
              <UserCircle class="org-settings__restrictions-icon" />
              <span class="org-settings__restrictions-title">Profile & Social</span>
            </div>
            <div class="org-settings__restrictions-item">
              <div class="org-settings__restrictions-item-info">
                <div class="org-settings__restrictions-item-title">Allow clipper profile</div>
                <div class="org-settings__restrictions-item-desc">Create public clipper profile</div>
              </div>
              <button
                type="button"
                class="org-settings__toggle"
                :class="{ 'org-settings__toggle--active': editData.restriction_defaults?.allow_clipper_profile }"
                @click="toggleRestriction('allow_clipper_profile')"
              >
                <span class="org-settings__toggle-handle"></span>
              </button>
            </div>
            <div class="org-settings__restrictions-item">
              <div class="org-settings__restrictions-item-info">
                <div class="org-settings__restrictions-item-title">Allow personal social accounts</div>
                <div class="org-settings__restrictions-item-desc">Connect their own social accounts</div>
              </div>
              <button
                type="button"
                class="org-settings__toggle"
                :class="{ 'org-settings__toggle--active': editData.restriction_defaults?.allow_personal_social }"
                @click="toggleRestriction('allow_personal_social')"
              >
                <span class="org-settings__toggle-handle"></span>
              </button>
            </div>
            <div class="org-settings__restrictions-item">
              <div class="org-settings__restrictions-item-info">
                <div class="org-settings__restrictions-item-title">Allow hiring browse</div>
                <div class="org-settings__restrictions-item-desc">Browse companies hiring on Clippster</div>
              </div>
              <button
                type="button"
                class="org-settings__toggle"
                :class="{ 'org-settings__toggle--active': editData.restriction_defaults?.allow_hiring_browse }"
                @click="toggleRestriction('allow_hiring_browse')"
              >
                <span class="org-settings__toggle-handle"></span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Save Success Toast -->
      <Transition name="toast">
        <div v-if="saveSuccess" class="org-settings__toast">
          <CheckCircle class="org-settings__toast-icon" />
          <span>Settings saved successfully</span>
        </div>
      </Transition>

      <!-- Danger Zone (Owner Only) -->
      <section v-if="isOwner" v-show="activeTab === 'danger'" class="org-settings__section org-settings__section--danger">
        <h3 class="org-settings__clipper-title org-settings__clipper-title--danger">Danger Zone</h3>

        <div class="org-settings__danger-card">
          <div class="org-settings__danger-inner">
            <div class="org-settings__danger-icon">
              <Trash2 />
            </div>
            <div class="org-settings__danger-info">
              <h4 class="org-settings__danger-title">Delete Organization</h4>
              <p class="org-settings__danger-desc">
                Permanently remove your organization and all of its contents. This action is not reversible — all data,
                members, and settings will be deleted.
              </p>
            </div>
            <button @click="confirmDeleteOrganization" class="org-settings__danger-btn" :disabled="deleting">
              <Loader2 v-if="deleting" class="org-settings__danger-spinner" />
              <Trash2 v-else class="org-settings__danger-btn-icon" />
              {{ deleting ? 'Deleting...' : 'Delete Organization' }}
            </button>
          </div>
        </div>
      </section>
      </main>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showEditProfileDialog" class="org-dialog__overlay" @click.self="showEditProfileDialog = false">
          <Transition name="dialog" appear>
            <div class="org-dialog">
              <div class="org-dialog__header">
                <button class="org-dialog__close" @click="showEditProfileDialog = false" :disabled="saving" title="Close">
                  <X :size="18" />
                </button>
                <div class="org-dialog__icon"><Building2 :size="24" /></div>
                <h2 class="org-dialog__title">Edit Organization Profile</h2>
                <p class="org-dialog__subtitle">Update your public organization information</p>
              </div>
              <div class="org-dialog__content">
                <div class="org-settings__form-group">
                  <label class="org-settings__form-label">Organization Logo</label>
                  <div class="org-settings__logo-row">
                    <div class="org-settings__logo-preview">
                      <img v-if="organization?.logo_url && !logoLoadError" :src="organization.logo_url" class="org-settings__logo-img" @error="logoLoadError = true" />
                      <Building2 v-else class="org-settings__logo-placeholder" />
                      <div v-if="uploadingLogo" class="org-settings__logo-loading"><Loader2 class="org-settings__logo-spinner" /></div>
                    </div>
                    <div class="org-settings__logo-actions">
                      <input ref="logoInputRef" type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="org-settings__file-input" @change="handleLogoUpload" />
                      <button type="button" @click="($refs.logoInputRef as HTMLInputElement)?.click()" :disabled="uploadingLogo" class="org-settings__upload-btn">
                        <Upload class="org-settings__upload-icon" />
                        {{ organization?.logo_url ? 'Change Logo' : 'Upload Logo' }}
                      </button>
                    </div>
                  </div>
                </div>
                <div class="org-settings__form-group">
                  <label class="org-settings__form-label">Organization Name</label>
                  <input v-model="editData.name" type="text" class="org-settings__form-input" placeholder="Enter organization name" />
                </div>
                <div class="org-settings__form-group">
                  <label class="org-settings__form-label">Description</label>
                  <textarea v-model="editData.description" rows="3" class="org-settings__form-textarea" placeholder="A brief description of your organization..." />
                </div>
                <div class="org-settings__form-group">
                  <label class="org-settings__form-label">Bio</label>
                  <textarea v-model="editData.bio" rows="4" class="org-settings__form-textarea" placeholder="Public organization bio..." />
                </div>
                <div class="org-settings__form-group">
                  <label class="org-settings__form-label">Website URL</label>
                  <input v-model="editData.website_url" type="text" class="org-settings__form-input" placeholder="https://..." />
                </div>
                <div class="org-settings__form-group">
                  <label class="org-settings__form-label">Public Contact Email</label>
                  <input v-model="editData.public_contact_email" type="email" class="org-settings__form-input" placeholder="contact@yourorg.com" />
                </div>
                <div class="org-settings__form-group">
                  <label class="org-settings__form-label">Content Type</label>
                  <div class="hw__tags">
                    <button v-for="tag in SPECIALTY_TAGS" :key="tag.value" type="button" class="hw__tag" :class="{ 'hw__tag--selected': editData.content_type_tags.includes(tag.value) }" @click="toggleArrayTag(tag.value)">{{ tag.label }}</button>
                  </div>
                </div>
              </div>
              <div class="org-dialog__footer">
                <button class="org-dialog__btn org-dialog__btn--secondary" @click="showEditProfileDialog = false" :disabled="saving">Cancel</button>
                <button class="org-dialog__btn org-dialog__btn--danger" @click="saveAndCloseProfileDialog" :disabled="saving">
                  <Loader2 v-if="saving" class="org-dialog__btn-spinner" />
                  {{ saving ? 'Saving...' : 'Save Profile' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteConfirm" class="org-dialog__overlay" @click.self="showDeleteConfirm = false">
          <Transition name="dialog" appear>
            <div class="org-dialog org-dialog--red">
              <div class="org-dialog__accent org-dialog__accent--red"></div>
              <div class="org-dialog__header">
                <button class="org-dialog__close" @click="showDeleteConfirm = false" title="Close" :disabled="deleting">
                  <X :size="18" />
                </button>
                <div class="org-dialog__icon org-dialog__icon--red">
                  <AlertTriangle :size="24" />
                </div>
                <h2 class="org-dialog__title">Delete Organization</h2>
                <p class="org-dialog__subtitle">This action cannot be undone</p>
              </div>

              <div class="org-dialog__content">
                <div class="org-dialog__preview-card">
                  <div class="org-dialog__preview-icon">
                    <Building2 :size="20" />
                  </div>
                  <div class="org-dialog__preview-info">
                    <span class="org-dialog__preview-name">{{ organization?.name }}</span>
                    <span class="org-dialog__preview-meta">Organization</span>
                  </div>
                </div>

                <div class="org-dialog__warning">
                  <p class="org-dialog__warning-text">
                    Type
                    <strong>{{ organization?.name }}</strong>
                    to confirm deletion:
                  </p>
                </div>

                <input
                  v-model="deleteConfirmInput"
                  type="text"
                  class="org-dialog__input"
                  :placeholder="organization?.name"
                />
              </div>

              <div class="org-dialog__footer">
                <button
                  class="org-dialog__btn org-dialog__btn--secondary"
                  @click="showDeleteConfirm = false"
                  :disabled="deleting"
                >
                  Cancel
                </button>
                <button
                  class="org-dialog__btn org-dialog__btn--danger"
                  @click="executeDeleteOrganization"
                  :disabled="deleting || deleteConfirmInput !== organization?.name"
                >
                  <Loader2 v-if="deleting" class="org-dialog__btn-spinner" />
                  {{ deleting ? 'Deleting...' : 'Delete Forever' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import {
    Building2,
    Sparkles,
    AlertTriangle,
    CheckCircle,
    Loader2,
    Settings,
    Save,
    Pencil,
    Type,
    FileText,
    Zap,
    Trash2,
    X,
    Shield,
    Archive,
    UserCircle,
    Upload,
    Megaphone,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import { useOrganization } from '@/composables/useOrganization';
  import { SPECIALTY_TAGS } from '@/services/clipperProfilesApi';

  const { organization, isOwner, updateOrganization, deleteOrganization, uploadLogo } = useOrganization();

  // Local state for edit form
  const logoInputRef = ref<HTMLInputElement | null>(null);
  const uploadingLogo = ref(false);
  const logoLoadError = ref(false);
  const editData = ref({
    name: '',
    description: '',
    bio: '',
    website_url: '',
    public_contact_email: '',
    content_type_tags: [] as string[],
    settings: {
      allow_ai: true,
    },
    restriction_defaults: {
      allow_ai: true,
      allow_asset_uploads: false,
      allow_custom_prompts: false,
      allow_clipper_profile: false,
      allow_personal_social: true,
      allow_clip_deletion: false,
      allow_hiring_browse: true,
      force_org_watermark: true,
      require_clip_approval: false,
      clips_visible_to_admins: true,
    },
  });
  const saving = ref(false);
  const saveSuccess = ref(false);
  const showDeleteConfirm = ref(false);
  const showEditProfileDialog = ref(false);
  const deleteConfirmInput = ref('');
  const deleting = ref(false);
  const activeTab = ref<'basic' | 'ai' | 'restrictions' | 'danger'>('basic');

  // Populate edit form when organization data loads
  watch(
    () => organization.value,
    (org) => {
      if (org) {
        const orgSettings = org.settings || {};
        const restrictionDefaults = org.restriction_defaults || {};
        editData.value = {
          name: org.name,
          description: org.description || '',
          bio: org.bio || '',
          website_url: org.website_url || '',
          public_contact_email: org.public_contact_email || '',
          content_type_tags: org.content_type_tags || [],
          settings: {
            allow_ai: orgSettings.allow_ai !== false,
          },
          restriction_defaults: {
            allow_ai: restrictionDefaults.allow_ai !== false,
            allow_asset_uploads: restrictionDefaults.allow_asset_uploads === true,
            allow_custom_prompts: restrictionDefaults.allow_custom_prompts === true,
            allow_clipper_profile: restrictionDefaults.allow_clipper_profile === true,
            allow_personal_social: restrictionDefaults.allow_personal_social !== false,
            allow_clip_deletion: restrictionDefaults.allow_clip_deletion === true,
            allow_hiring_browse: restrictionDefaults.allow_hiring_browse !== false,
            force_org_watermark: restrictionDefaults.force_org_watermark !== false,
            require_clip_approval: restrictionDefaults.require_clip_approval === true,
            clips_visible_to_admins: restrictionDefaults.clips_visible_to_admins !== false,
          },
        };
      }
    },
    { immediate: true }
  );

  const hasChanges = computed(() => {
    if (!organization.value) return false;
    const orgSettings = organization.value.settings || {};
    const currentAllowAi = orgSettings.allow_ai !== false;
    
    // Check restriction defaults changes
    const orgRestrictionDefaults = organization.value.restriction_defaults || {};
    const restrictionsChanged = 
      editData.value.restriction_defaults.allow_ai !== (orgRestrictionDefaults.allow_ai !== false) ||
      editData.value.restriction_defaults.allow_asset_uploads !== (orgRestrictionDefaults.allow_asset_uploads === true) ||
      editData.value.restriction_defaults.allow_custom_prompts !== (orgRestrictionDefaults.allow_custom_prompts === true) ||
      editData.value.restriction_defaults.allow_clipper_profile !== (orgRestrictionDefaults.allow_clipper_profile === true) ||
      editData.value.restriction_defaults.allow_personal_social !== (orgRestrictionDefaults.allow_personal_social !== false) ||
      editData.value.restriction_defaults.allow_clip_deletion !== (orgRestrictionDefaults.allow_clip_deletion === true) ||
      editData.value.restriction_defaults.allow_hiring_browse !== (orgRestrictionDefaults.allow_hiring_browse !== false) ||
      editData.value.restriction_defaults.force_org_watermark !== (orgRestrictionDefaults.force_org_watermark !== false) ||
      editData.value.restriction_defaults.require_clip_approval !== (orgRestrictionDefaults.require_clip_approval === true) ||
      editData.value.restriction_defaults.clips_visible_to_admins !== (orgRestrictionDefaults.clips_visible_to_admins !== false);
    
    return (
      editData.value.name !== organization.value.name ||
      editData.value.description !== (organization.value.description || '') ||
      editData.value.bio !== (organization.value.bio || '') ||
      editData.value.website_url !== (organization.value.website_url || '') ||
      editData.value.public_contact_email !== (organization.value.public_contact_email || '') ||
      JSON.stringify(editData.value.content_type_tags) !== JSON.stringify(organization.value.content_type_tags || []) ||
      editData.value.settings.allow_ai !== currentAllowAi ||
      restrictionsChanged
    );
  });

  function toggleArrayTag(value: string) {
    const tags = editData.value.content_type_tags;
    const idx = tags.indexOf(value);
    if (idx >= 0) tags.splice(idx, 1);
    else tags.push(value);
  }

  async function handleUpdateOrganization() {
    if (!hasChanges.value) return;

    saving.value = true;
    saveSuccess.value = false;

    const result = await updateOrganization(editData.value);
    saving.value = false;

    if (result.success) {
      saveSuccess.value = true;
      setTimeout(() => {
        saveSuccess.value = false;
      }, 3000);
    }
  }

  async function saveAndCloseProfileDialog() {
    await handleUpdateOrganization();
    if (!saving.value) showEditProfileDialog.value = false;
  }

  function confirmDeleteOrganization() {
    deleteConfirmInput.value = '';
    showDeleteConfirm.value = true;
  }

  async function executeDeleteOrganization() {
    if (deleteConfirmInput.value !== organization.value?.name) return;

    deleting.value = true;
    await deleteOrganization();
    deleting.value = false;
    showDeleteConfirm.value = false;
  }

  function toggleRestriction(key: keyof typeof editData.value.restriction_defaults) {
    if (editData.value.restriction_defaults) {
      editData.value.restriction_defaults[key] = !editData.value.restriction_defaults[key];
    }
  }

  // Handle logo upload
  async function handleLogoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploadingLogo.value = true;
    logoLoadError.value = false;

    try {
      await uploadLogo(file);
    } catch (err) {
      console.error('Failed to upload logo:', err);
    } finally {
      uploadingLogo.value = false;
      // Reset the input so the same file can be selected again
      if (input) input.value = '';
    }
  }

  // Reset logo load error when logo_url changes
  watch(
    () => organization.value?.logo_url,
    () => {
      logoLoadError.value = false;
    }
  );
</script>

<style scoped>
  .clipper-profile {
    width: 100%;
    min-height: 100%;
    background: var(--sidebar-bg);
  }

  .profile-page {
    display: flex;
    flex-direction: column;
    gap: 0;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .profile-header-card {
    position: relative;
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 16px;
    overflow: hidden;
  }
  .profile-header-bg {
    position: absolute;
    inset: 0 0 auto 0;
    height: 120px;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
    opacity: 0.5;
  }
  .profile-header-content {
    position: relative;
    padding: 2rem 2rem 1.5rem;
  }
  .profile-header-main {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  .profile-avatar {
    width: 96px; height: 96px; border-radius: 20px; overflow: hidden; flex-shrink: 0;
    background: var(--sidebar-hover); border: 3px solid var(--sidebar-surface); box-shadow: 0 4px 12px rgba(0,0,0,.15);
  }
  .profile-avatar__img { width: 100%; height: 100%; object-fit: cover; }
  .profile-avatar__fallback { width: 100%; height: 100%; padding: 20px; color: var(--sidebar-text-muted); }
  .profile-info { flex: 1; min-width: 0; }
  .profile-name-row { display: flex; align-items: center; gap: .75rem; margin-bottom: .5rem; }
  .profile-name { font-size: 1.75rem; font-weight: 700; color: var(--sidebar-text); margin: 0; letter-spacing: -.03em; line-height: 1.2; }
  .profile-bio { font-size: .9375rem; color: var(--sidebar-text-muted); margin: 0 0 .75rem; line-height: 1.6; max-width: 600px; }
  .profile-tags { display: flex; flex-wrap: wrap; gap: .5rem; }
  .profile-tag { padding: .375rem .625rem; background: rgba(6,182,212,.12); border-radius: 6px; font-size: .6875rem; font-weight: 600; color: var(--sidebar-accent); }
  .profile-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }
  .profile-action-btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }
  .profile-action-btn--primary:hover { opacity: 0.9; transform: translateY(-1px); }
  .edit-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    border-radius: 6px;
    border: none;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 150ms ease;
  }
  .edit-btn:hover { opacity: 0.9; }
  .edit-btn__icon { width: 14px; height: 14px; }
  .org-basic-preview { display: flex; align-items: center; gap: .875rem; }
  .org-basic-preview__avatar { width: 44px; height: 44px; border-radius: 10px; overflow: hidden; background: var(--sidebar-hover); border: 1px solid var(--sidebar-border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .org-basic-preview__avatar-img { width: 100%; height: 100%; object-fit: cover; }
  .org-basic-preview__avatar-fallback { width: 20px; height: 20px; color: var(--sidebar-text-muted); }
  .org-basic-preview__info { flex: 1; min-width: 0; }
  .org-basic-preview__name { font-size: .9375rem; color: var(--sidebar-text); font-weight: 600; }
  .org-basic-preview__desc { font-size: .75rem; color: var(--sidebar-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .profile-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1.5rem; }
  .profile-stat-card { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; background: var(--sidebar-hover); border: 1px solid var(--sidebar-border); border-radius: 12px; transition: all 200ms ease; }
  .profile-stat-card:hover { border-color: rgba(255, 255, 255, 0.12); transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15); }
  .profile-stat-card__icon { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0; }
  .profile-stat-card__icon--purple { background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%); color: #a78bfa; }
  .profile-stat-card__icon--cyan { background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(8, 145, 178, 0.2) 100%); color: #06b6d4; }
  .profile-stat-card__icon--green { background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%); color: #10b981; }
  .profile-stat-card__content { display: flex; flex-direction: column; gap: 0.25rem; }
  .profile-stat-card__value { font-size: 1.75rem; font-weight: 700; color: var(--sidebar-text); letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
  .profile-stat-card__label { font-size: 0.75rem; color: var(--sidebar-text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }

  .tabs-nav {
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    padding: 0.5rem;
    margin-bottom: 1.5rem;
  }
  .tabs-container { display: flex; gap: .375rem; overflow-x: auto; scrollbar-width: none; }
  .tabs-container::-webkit-scrollbar { display: none; }
  .tab-button {
    display: flex; align-items: center; gap: .5rem; padding: .75rem 1.125rem; background: transparent;
    border: none; border-radius: 8px; font-size: .8125rem; font-weight: 600; color: var(--sidebar-text-muted);
    cursor: pointer; transition: all 180ms ease; white-space: nowrap;
  }
  .tab-button:hover:not(.tab-button--active) { background: var(--sidebar-hover); color: var(--sidebar-text); }
  .tab-button--active {
    background: linear-gradient(135deg, rgba(6,182,212,.15) 0%, rgba(139,92,246,.15) 100%);
    color: var(--sidebar-accent);
    box-shadow: 0 2px 8px rgba(6,182,212,.2);
  }
  .tab-button__icon { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; }
  .tab-button__icon svg { width: 100%; height: 100%; }

  .content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding-bottom: 4rem;
  }

  @media (max-width: 640px) {
    .profile-header-main { flex-direction: column; align-items: center; text-align: center; }
    .profile-stats-grid { grid-template-columns: 1fr; }
    .tab-button__label { display: none; }
    .tab-button { padding: .75rem; }
  }

  /* ===== Action Button ===== */
  .org-settings__action-btn {
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

  .org-settings__action-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-settings__action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .org-settings__action-icon {
    width: 14px;
    height: 14px;
  }

  .org-settings__action-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  .org-settings__clipper-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .org-settings__clipper-title--danger {
    color: #f87171;
  }

  /* ===== Section ===== */
  .org-settings__section {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .org-settings__section-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .org-settings__section-header-icon {
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

  .org-settings__section-header-icon svg {
    width: 20px;
    height: 20px;
  }

  .org-settings__section-header-icon--profile {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .org-settings__section-header-icon--ai {
    background-color: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }

  .org-settings__section-header-icon--danger {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .org-settings__section-header-text {
    flex: 1;
  }

  .org-settings__section-title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .org-settings__section-title--danger {
    color: #f87171;
  }

  .org-settings__section-subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  /* ===== Form Card ===== */
  .org-settings__form-card {
    background-color: var(--sidebar-surface);
    border: 1px solid color-mix(in srgb, var(--sidebar-border) 75%, transparent);
    border-radius: 12px;
    overflow: hidden;
  }

  .org-settings__form-row {
    padding: 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .org-settings__form-row:last-child {
    border-bottom: none;
  }

  .org-settings__form-group {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .org-settings__form-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .org-settings__label-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
  }

  .org-settings__form-input,
  .org-settings__form-textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .org-settings__form-input::placeholder,
  .org-settings__form-textarea::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .org-settings__form-input:focus,
  .org-settings__form-textarea:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .org-settings__form-textarea {
    resize: vertical;
    min-height: 100px;
    line-height: 1.5;
  }

  /* ===== Logo Upload ===== */
  .org-settings__logo-row {
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
  }

  .org-settings__logo-preview {
    position: relative;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background-color: var(--sidebar-hover);
    border: 2px solid var(--sidebar-border);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .org-settings__logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-settings__logo-placeholder {
    width: 32px;
    height: 32px;
    color: var(--sidebar-text-muted);
  }

  .org-settings__logo-loading {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .org-settings__logo-spinner {
    width: 24px;
    height: 24px;
    color: white;
    animation: spin 0.8s linear infinite;
  }

  .org-settings__logo-actions {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-settings__file-input {
    display: none;
  }

  .org-settings__upload-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
    align-self: flex-start;
  }

  .org-settings__upload-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: var(--sidebar-accent);
  }

  .org-settings__upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-settings__upload-icon {
    width: 16px;
    height: 16px;
  }

  .org-settings__logo-hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== Feature Card ===== */
  .org-settings__feature-card {
    background-color: var(--sidebar-surface);
    border: 1px solid color-mix(in srgb, var(--sidebar-border) 75%, transparent);
    border-radius: 12px;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .org-settings__feature-card:hover {
    border-color: rgba(168, 85, 247, 0.3);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .org-settings__feature-inner {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem;
  }

  .org-settings__feature-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background-color: rgba(113, 113, 122, 0.15);
    color: #71717a;
    flex-shrink: 0;
    transition: all 200ms ease;
  }

  .org-settings__feature-icon svg {
    width: 22px;
    height: 22px;
  }

  .org-settings__feature-icon--active {
    background-color: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }

  .org-settings__feature-info {
    flex: 1;
    min-width: 0;
  }

  .org-settings__feature-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
  }

  .org-settings__feature-desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0 0 0.75rem;
  }

  .org-settings__feature-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .org-settings__feature-tag {
    display: inline-flex;
    padding: 0.25rem 0.5rem;
    border-radius: 5px;
    font-size: 0.6875rem;
    font-weight: 500;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  /* ===== Toggle Switch ===== */
  .org-settings__toggle {
    position: relative;
    width: 48px;
    height: 26px;
    background-color: #3f3f46;
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    transition: background-color 200ms ease;
    flex-shrink: 0;
    margin-top: 0.25rem;
  }

  .org-settings__toggle--active {
    background-color: #a855f7;
  }

  .org-settings__toggle-handle {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    background-color: white;
    border-radius: 50%;
    transition: transform 200ms ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .org-settings__toggle--active .org-settings__toggle-handle {
    transform: translateX(22px);
  }

  /* ===== Toast ===== */
  .org-settings__toast {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.875rem 1.25rem;
    background-color: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #34d399;
    backdrop-filter: blur(8px);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 100;
  }

  .org-settings__toast-icon {
    width: 18px;
    height: 18px;
  }

  /* ===== Danger Section ===== */
  .org-settings__section--danger {
    margin-top: 1rem;
  }

  .org-settings__danger-card {
    background-color: rgba(239, 68, 68, 0.03);
    border: 1px solid rgba(239, 68, 68, 0.15);
    border-radius: 12px;
    overflow: hidden;
  }

  .org-settings__danger-inner {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem;
    flex-wrap: wrap;
  }

  .org-settings__danger-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background-color: rgba(239, 68, 68, 0.12);
    color: #f87171;
    flex-shrink: 0;
  }

  .org-settings__danger-icon svg {
    width: 20px;
    height: 20px;
  }

  .org-settings__danger-info {
    flex: 1;
    min-width: 200px;
  }

  .org-settings__danger-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f87171;
    margin: 0 0 0.375rem;
  }

  .org-settings__danger-desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .org-settings__danger-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.8125rem;
    font-weight: 600;
    background: transparent;
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
    margin-top: 0.5rem;
  }

  .org-settings__danger-btn:hover:not(:disabled) {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .org-settings__danger-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-settings__danger-btn-icon {
    width: 14px;
    height: 14px;
  }

  .org-settings__danger-spinner {
    width: 14px;
    height: 14px;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Dialog Overlay ===== */
  .org-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  /* ===== Dialog Container ===== */
  .org-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Dialog Accent ===== */
  .org-dialog__accent {
    height: 3px;
    flex-shrink: 0;
  }

  .org-dialog__accent--red {
    background: linear-gradient(90deg, #ef4444, rgba(239, 68, 68, 0.5));
  }

  /* ===== Dialog Header ===== */
  .org-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .org-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .org-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
  }

  .org-dialog__icon--red {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .org-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .org-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Dialog Content ===== */
  .org-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.5rem;
  }

  .org-dialog__preview-card {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 10px;
    margin-bottom: 1rem;
  }

  .org-dialog__preview-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .org-dialog__preview-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .org-dialog__preview-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .org-dialog__preview-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  .org-dialog__warning {
    margin-bottom: 0.75rem;
  }

  .org-dialog__warning-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  .org-dialog__warning-text strong {
    color: var(--sidebar-text);
  }

  .org-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .org-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  .org-dialog__input:focus {
    outline: none;
    border-color: #ef4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
  }

  /* ===== Dialog Footer ===== */
  .org-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    margin-top: 1rem;
  }

  .org-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .org-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .org-dialog__btn--danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
  }

  .org-dialog__btn--danger:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-dialog__btn-spinner {
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  .toast-enter-active {
    transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .toast-leave-active {
    transition: all 200ms ease-in;
  }

  .toast-enter-from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }

  .toast-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }

  /* ===== Restrictions Section ===== */
  .org-settings__section-header-icon--restrictions {
    background-color: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .org-settings__restrictions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .org-settings__restrictions-card {
    background-color: var(--sidebar-surface);
    border: 1px solid color-mix(in srgb, var(--sidebar-border) 75%, transparent);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .org-settings__restrictions-header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .org-settings__restrictions-icon {
    width: 18px;
    height: 18px;
    color: var(--sidebar-accent);
  }

  .org-settings__restrictions-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .org-settings__restrictions-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    justify-content: space-between;
  }

  .org-settings__restrictions-item-info {
    flex: 1;
    min-width: 0;
  }

  .org-settings__restrictions-item-title {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin-bottom: 0.125rem;
  }

  .org-settings__restrictions-item-desc {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.4;
  }

  .hw__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .hw__tag {
    border: 1px solid var(--sidebar-border);
    background: color-mix(in srgb, var(--sidebar-hover) 70%, transparent);
    color: var(--sidebar-text-muted);
    border-radius: 999px;
    font-size: 0.75rem;
    line-height: 1;
    padding: 0.45rem 0.7rem;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .hw__tag:hover {
    background: var(--sidebar-hover);
    border-color: color-mix(in srgb, var(--sidebar-text-muted) 45%, var(--sidebar-border));
  }

  .hw__tag--selected {
    background: rgba(6, 182, 212, 0.16);
    border-color: rgba(6, 182, 212, 0.45);
    color: var(--sidebar-accent);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

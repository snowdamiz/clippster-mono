<template>
  <div class="campaigns">
    <!-- Page Heading -->
    <div class="campaigns__heading">
      <h1 class="campaigns__title">Clipping Campaigns</h1>
      <p class="campaigns__subtitle">Create and manage campaigns for clippers to promote your content</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="campaigns__list">
      <div v-for="i in 3" :key="i" class="campaigns__card campaigns__card--skeleton">
        <div class="campaigns__card-indicator"></div>
        <div class="campaigns__card-content">
          <div class="campaigns__skeleton-cover"></div>
          <div class="campaigns__skeleton-info">
            <div class="campaigns__skeleton-title"></div>
            <div class="campaigns__skeleton-desc"></div>
            <div class="campaigns__skeleton-stats"></div>
          </div>
          <div class="campaigns__skeleton-badge"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="campaigns.length === 0" class="campaigns__empty">
      <div class="campaigns__empty-icon-wrapper">
        <Megaphone class="campaigns__empty-icon" />
      </div>
      <h3 class="campaigns__empty-title">No campaigns yet</h3>
      <p class="campaigns__empty-text">Create your first campaign to start working with clippers</p>
    </div>

    <!-- Campaigns List -->
    <div v-else class="campaigns__list">
      <div v-for="campaign in campaigns" :key="campaign.id" class="campaigns__card">
        <div
          class="campaigns__card-indicator"
          :class="{
            'campaigns__card-indicator--active': campaign.status === 'active',
            'campaigns__card-indicator--paused': campaign.status === 'paused',
            'campaigns__card-indicator--completed': campaign.status === 'completed',
          }"
        ></div>
        <div class="campaigns__card-content">
          <!-- Cover Image -->
          <div class="campaigns__cover">
            <img v-if="campaign.cover_image_url" :src="campaign.cover_image_url" class="campaigns__cover-img" />
            <div v-else class="campaigns__cover-fallback">
              <Megaphone class="campaigns__cover-icon" />
            </div>
            <!-- Status Badge -->
            <div
              class="campaigns__status"
              :class="{
                'campaigns__status--active': campaign.status === 'active',
                'campaigns__status--paused': campaign.status === 'paused',
                'campaigns__status--completed': campaign.status === 'completed',
                'campaigns__status--draft': campaign.status === 'draft',
              }"
            >
              {{ campaign.status }}
            </div>
          </div>

          <!-- Campaign Info -->
          <div class="campaigns__info">
            <h3 class="campaigns__name">{{ campaign.title }}</h3>
            <p v-if="campaign.description" class="campaigns__desc">{{ campaign.description }}</p>

            <!-- Meta Row -->
            <div class="campaigns__meta">
              <span v-if="campaign.starts_at || campaign.ends_at" class="campaigns__meta-item">
                <Calendar class="campaigns__meta-icon" />
                <template v-if="campaign.starts_at">{{ formatDate(campaign.starts_at) }}</template>
                <template v-if="campaign.starts_at && campaign.ends_at">–</template>
                <template v-if="campaign.ends_at">{{ formatDate(campaign.ends_at) }}</template>
              </span>
              <span v-if="campaign.allowed_platforms?.length" class="campaigns__meta-item">
                <Globe class="campaigns__meta-icon" />
                {{ campaign.allowed_platforms.length }} platform{{ campaign.allowed_platforms.length !== 1 ? 's' : '' }}
              </span>
            </div>
          </div>

          <!-- Stats -->
          <div class="campaigns__stats">
            <div class="campaigns__stat">
              <DollarSign class="campaigns__stat-icon" />
              <div class="campaigns__stat-data">
                <span class="campaigns__stat-value">${{ formatCpm(campaign.cpm) }}</span>
                <span class="campaigns__stat-label">per {{ formatViews(campaign.cpm_views || 1000) }}</span>
              </div>
            </div>
            <div class="campaigns__stat">
              <Wallet class="campaigns__stat-icon" />
              <div class="campaigns__stat-data">
                <span class="campaigns__stat-value">${{ formatBudget(campaign.budget) }}</span>
                <span class="campaigns__stat-label">budget</span>
              </div>
            </div>
            <div class="campaigns__stat">
              <Users class="campaigns__stat-icon" />
              <div class="campaigns__stat-data">
                <span class="campaigns__stat-value">{{ campaign.participants_count || 0 }}</span>
                <span class="campaigns__stat-label">clippers</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="campaigns__actions">
            <button class="campaigns__action-btn" @click="viewCampaign(campaign)">
              <Eye class="campaigns__action-icon" />
            </button>
            <button v-if="isAdmin" class="campaigns__action-btn" @click="editCampaign(campaign)">
              <Pencil class="campaigns__action-icon" />
            </button>
            <DropdownMenu v-if="isAdmin">
              <DropdownMenuTrigger as-child>
                <button class="campaigns__action-btn">
                  <MoreVertical class="campaigns__action-icon" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="campaigns__dropdown">
                <DropdownMenuItem
                  v-if="campaign.status === 'draft'"
                  @click="activateCampaignAction(campaign)"
                  class="campaigns__dropdown-item"
                >
                  <Play class="campaigns__dropdown-icon" />
                  Activate
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="campaign.status === 'active'"
                  @click="pauseCampaignAction(campaign)"
                  class="campaigns__dropdown-item"
                >
                  <Pause class="campaigns__dropdown-icon" />
                  Pause
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="campaign.status === 'paused'"
                  @click="activateCampaignAction(campaign)"
                  class="campaigns__dropdown-item"
                >
                  <Play class="campaigns__dropdown-icon" />
                  Resume
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="campaign.status !== 'completed'"
                  @click="completeCampaignAction(campaign)"
                  class="campaigns__dropdown-item"
                >
                  <CheckCircle class="campaigns__dropdown-icon" />
                  Complete
                </DropdownMenuItem>
                <DropdownMenuSeparator class="campaigns__dropdown-sep" />
                <DropdownMenuItem
                  @click="confirmDeleteCampaign(campaign)"
                  class="campaigns__dropdown-item campaigns__dropdown-item--danger"
                >
                  <Trash2 class="campaigns__dropdown-icon" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Campaign Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showCampaignDialog"
          class="campaigns-dialog__overlay"
          @click.self="showCampaignDialog = false"
          @keydown.esc="showCampaignDialog = false"
        >
          <Transition name="dialog" appear>
            <div
              v-if="showCampaignDialog"
              class="campaigns-dialog campaigns-dialog--form"
              role="dialog"
              aria-modal="true"
            >
              <div class="campaigns-dialog__accent campaigns-dialog__accent--purple"></div>

              <!-- Header -->
              <div class="campaigns-dialog__header">
                <button
                  class="campaigns-dialog__close"
                  @click="showCampaignDialog = false"
                  title="Close"
                  :disabled="saving"
                >
                  <X :size="18" />
                </button>
                <div class="campaigns-dialog__icon campaigns-dialog__icon--purple">
                  <Megaphone :size="24" />
                </div>
                <h2 class="campaigns-dialog__title">
                  {{ editingCampaign ? 'Edit Campaign' : 'Create Campaign' }}
                </h2>
                <p class="campaigns-dialog__subtitle">
                  {{ editingCampaign ? 'Update your campaign details' : 'Set up a new campaign for clippers' }}
                </p>
              </div>

              <div class="campaigns-dialog__content">
                <form @submit.prevent="saveCampaign" class="campaigns-dialog__form">
                  <p class="campaigns-dialog__description">
                    Create a campaign to reward clippers for promoting your content across social platforms.
                  </p>

                  <!-- Title -->
                  <div class="campaigns-dialog__field">
                    <label class="campaigns-dialog__label">Title *</label>
                    <input
                      v-model="campaignForm.title"
                      type="text"
                      required
                      class="campaigns-dialog__input"
                      placeholder="Campaign title"
                    />
                  </div>

                  <!-- Description -->
                  <div class="campaigns-dialog__field">
                    <label class="campaigns-dialog__label">Description</label>
                    <textarea
                      v-model="campaignForm.description"
                      rows="3"
                      class="campaigns-dialog__textarea"
                      placeholder="Describe your campaign..."
                    ></textarea>
                  </div>

                  <!-- CPM and Views Row -->
                  <div class="campaigns-dialog__row">
                    <div class="campaigns-dialog__field">
                      <label class="campaigns-dialog__label">CPM Price ($)</label>
                      <input
                        v-model.number="campaignForm.cpm"
                        type="number"
                        step="0.01"
                        min="0"
                        class="campaigns-dialog__input"
                        placeholder="0.00"
                      />
                    </div>
                    <div class="campaigns-dialog__field">
                      <label class="campaigns-dialog__label">Per Views</label>
                      <select v-model="campaignForm.cpm_views" class="campaigns-dialog__select">
                        <option :value="500">500 views</option>
                        <option :value="1000">1,000 views</option>
                        <option :value="5000">5,000 views</option>
                        <option :value="10000">10,000 views</option>
                        <option :value="100000">100,000 views</option>
                      </select>
                    </div>
                  </div>
                  <p class="campaigns-dialog__hint">
                    ${{ campaignForm.cpm }} per {{ formatViews(campaignForm.cpm_views) }} views
                  </p>

                  <!-- Budget and Min Views Row -->
                  <div class="campaigns-dialog__row">
                    <div class="campaigns-dialog__field">
                      <label class="campaigns-dialog__label">Budget ($)</label>
                      <input
                        v-model.number="campaignForm.budget"
                        type="number"
                        step="1"
                        min="0"
                        class="campaigns-dialog__input"
                        placeholder="0"
                      />
                    </div>
                    <div class="campaigns-dialog__field">
                      <label class="campaigns-dialog__label">Min Views for Payment</label>
                      <input
                        v-model.number="campaignForm.min_views_for_payment"
                        type="number"
                        min="0"
                        class="campaigns-dialog__input"
                        placeholder="1000"
                      />
                    </div>
                  </div>

                  <!-- Join Type and Dates Row -->
                  <div class="campaigns-dialog__row campaigns-dialog__row--3">
                    <div class="campaigns-dialog__field">
                      <label class="campaigns-dialog__label">Join Type</label>
                      <select v-model="campaignForm.join_type" class="campaigns-dialog__select">
                        <option value="open">Open</option>
                        <option value="application_required">Application Required</option>
                      </select>
                    </div>
                    <div class="campaigns-dialog__field">
                      <label class="campaigns-dialog__label">Start Date</label>
                      <input v-model="campaignForm.starts_at" type="datetime-local" class="campaigns-dialog__input" />
                    </div>
                    <div class="campaigns-dialog__field">
                      <label class="campaigns-dialog__label">End Date</label>
                      <input v-model="campaignForm.ends_at" type="datetime-local" class="campaigns-dialog__input" />
                    </div>
                  </div>

                  <!-- Allowed Platforms -->
                  <div class="campaigns-dialog__field">
                    <label class="campaigns-dialog__label">Allowed Platforms</label>
                    <div class="campaigns-dialog__chips">
                      <button
                        v-for="platform in availablePlatforms"
                        :key="platform.value"
                        type="button"
                        @click="togglePlatform(platform.value)"
                        class="campaigns-dialog__chip"
                        :class="{
                          'campaigns-dialog__chip--active': campaignForm.allowed_platforms.includes(platform.value),
                        }"
                      >
                        {{ platform.label }}
                      </button>
                    </div>
                  </div>

                  <!-- Payment Methods -->
                  <div class="campaigns-dialog__field">
                    <label class="campaigns-dialog__label">Payment Methods</label>
                    <div class="campaigns-dialog__chips">
                      <button
                        v-for="method in availablePaymentMethods"
                        :key="method.value"
                        type="button"
                        @click="togglePaymentMethod(method.value)"
                        class="campaigns-dialog__chip"
                        :class="{
                          'campaigns-dialog__chip--active': campaignForm.payment_methods.includes(method.value),
                        }"
                      >
                        {{ method.label }}
                      </button>
                    </div>
                  </div>

                  <!-- Creator Profiles -->
                  <div class="campaigns-dialog__field">
                    <label class="campaigns-dialog__label">
                      Creator Profiles
                      <span class="campaigns-dialog__label-hint">(clippers can clip these creators)</span>
                    </label>
                    <div v-if="loadingProfiles" class="campaigns-dialog__loading">
                      <Loader2 class="campaigns-dialog__spinner" />
                    </div>
                    <div v-else-if="availableCreatorProfiles.length === 0" class="campaigns-dialog__empty-profiles">
                      <p>No creator profiles available. Create profiles in the Creator Profiles tab first.</p>
                    </div>
                    <div v-else class="campaigns-dialog__profiles-list">
                      <button
                        v-for="profile in availableCreatorProfiles"
                        :key="profile.id"
                        type="button"
                        @click="toggleCreatorProfile(profile.id)"
                        class="campaigns-dialog__profile"
                        :class="{
                          'campaigns-dialog__profile--selected': selectedCreatorProfileIds.includes(profile.id),
                        }"
                      >
                        <div class="campaigns-dialog__profile-avatar">
                          <img v-if="profile.profile_image_url" :src="profile.profile_image_url" />
                          <User v-else class="campaigns-dialog__profile-avatar-icon" />
                        </div>
                        <div class="campaigns-dialog__profile-info">
                          <span class="campaigns-dialog__profile-name">{{ profile.name }}</span>
                          <span v-if="profile.description" class="campaigns-dialog__profile-desc">
                            {{ profile.description }}
                          </span>
                        </div>
                        <div
                          v-if="selectedCreatorProfileIds.includes(profile.id)"
                          class="campaigns-dialog__profile-check"
                        >
                          <Check class="campaigns-dialog__profile-check-icon" />
                        </div>
                      </button>
                    </div>
                    <p class="campaigns-dialog__hint">
                      {{ selectedCreatorProfileIds.length }} profile(s) selected. Each profile includes their
                      watermarks, intro/outro videos.
                    </p>
                  </div>

                  <!-- Global Campaign Assets -->
                  <div class="campaigns-dialog__section">
                    <div class="campaigns-dialog__section-header">
                      <label class="campaigns-dialog__section-title">Global Campaign Assets</label>
                      <span class="campaigns-dialog__section-badge">Applied to all clips</span>
                    </div>
                    <p class="campaigns-dialog__section-desc">
                      These assets apply to ALL clips for this campaign, regardless of creator profile.
                    </p>

                    <!-- Global Intro -->
                    <div class="campaigns-dialog__asset-row">
                      <div class="campaigns-dialog__asset-header">
                        <label class="campaigns-dialog__asset-label">Intro Video</label>
                        <label class="campaigns-dialog__checkbox-label">
                          <input
                            type="checkbox"
                            v-model="campaignForm.require_intro"
                            class="campaigns-dialog__checkbox"
                          />
                          Required
                        </label>
                      </div>
                      <select v-model="campaignForm.global_intro_id" class="campaigns-dialog__select">
                        <option :value="null">No intro</option>
                        <option
                          v-for="asset in availableAssets.filter((a) => a.asset_type === 'intro')"
                          :key="asset.id"
                          :value="asset.id"
                        >
                          {{ asset.name }}
                        </option>
                      </select>
                    </div>

                    <!-- Global Outro -->
                    <div class="campaigns-dialog__asset-row">
                      <div class="campaigns-dialog__asset-header">
                        <label class="campaigns-dialog__asset-label">Outro Video</label>
                        <label class="campaigns-dialog__checkbox-label">
                          <input
                            type="checkbox"
                            v-model="campaignForm.require_outro"
                            class="campaigns-dialog__checkbox"
                          />
                          Required
                        </label>
                      </div>
                      <select v-model="campaignForm.global_outro_id" class="campaigns-dialog__select">
                        <option :value="null">No outro</option>
                        <option
                          v-for="asset in availableAssets.filter((a) => a.asset_type === 'outro')"
                          :key="asset.id"
                          :value="asset.id"
                        >
                          {{ asset.name }}
                        </option>
                      </select>
                    </div>

                    <!-- Global Watermarks -->
                    <div class="campaigns-dialog__asset-row">
                      <div class="campaigns-dialog__asset-header">
                        <label class="campaigns-dialog__asset-label">Watermarks (per aspect ratio)</label>
                        <label class="campaigns-dialog__checkbox-label">
                          <input
                            type="checkbox"
                            v-model="campaignForm.require_watermark"
                            class="campaigns-dialog__checkbox"
                          />
                          Required
                        </label>
                      </div>
                      <div class="campaigns-dialog__watermark-row">
                        <div class="campaigns-dialog__watermark-status">
                          <span class="campaigns-dialog__watermark-label">Configured:</span>
                          <span v-if="hasAnyWatermarkConfigured" class="campaigns-dialog__watermark-value">
                            {{ getConfiguredWatermarkRatios() }}
                          </span>
                          <span v-else class="campaigns-dialog__watermark-none">None</span>
                        </div>
                        <button
                          type="button"
                          @click="openWatermarkPositionPicker"
                          class="campaigns-dialog__watermark-btn"
                        >
                          Configure Positions
                        </button>
                      </div>
                      <p class="campaigns-dialog__hint campaigns-dialog__hint--small">
                        Set watermark images and positions for each aspect ratio (16:9, 9:16, 1:1, 4:5)
                      </p>
                    </div>
                  </div>

                  <!-- Cover Image -->
                  <div class="campaigns-dialog__field">
                    <label class="campaigns-dialog__label">Cover Image</label>

                    <!-- Image Preview -->
                    <div
                      v-if="campaignForm.cover_image_url || coverImagePreview"
                      class="campaigns-dialog__cover-preview"
                    >
                      <img :src="coverImagePreview || campaignForm.cover_image_url" @error="handleImageError" />
                      <button type="button" @click="clearCoverImage" class="campaigns-dialog__cover-remove">
                        <X class="campaigns-dialog__cover-remove-icon" />
                      </button>
                    </div>

                    <!-- Upload/URL Options -->
                    <div class="campaigns-dialog__upload-row">
                      <button
                        type="button"
                        @click="triggerCoverImageUpload"
                        :disabled="uploadingCoverImage"
                        class="campaigns-dialog__upload-btn"
                      >
                        <Loader2 v-if="uploadingCoverImage" class="campaigns-dialog__spinner" />
                        <Upload v-else class="campaigns-dialog__upload-icon" />
                        {{ uploadingCoverImage ? 'Uploading...' : 'Upload' }}
                      </button>
                      <input
                        ref="coverImageInput"
                        type="file"
                        accept="image/*"
                        class="campaigns-dialog__file-input"
                        @change="handleCoverImageSelect"
                      />
                      <span class="campaigns-dialog__upload-or">or</span>
                      <input
                        v-model="campaignForm.cover_image_url"
                        type="text"
                        placeholder="Paste image URL..."
                        class="campaigns-dialog__input campaigns-dialog__input--url"
                        @input="coverImagePreview = ''"
                      />
                    </div>
                    <p class="campaigns-dialog__hint">Recommended size: 1200x630px</p>
                  </div>
                </form>
              </div>

              <!-- Footer -->
              <div class="campaigns-dialog__footer">
                <button
                  type="button"
                  @click="showCampaignDialog = false"
                  :disabled="saving"
                  class="campaigns-dialog__btn campaigns-dialog__btn--secondary"
                >
                  Cancel
                </button>
                <button
                  @click="saveCampaign"
                  :disabled="saving || !campaignForm.title"
                  class="campaigns-dialog__btn campaigns-dialog__btn--primary"
                >
                  <Loader2 v-if="saving" class="campaigns-dialog__btn-spinner" />
                  {{ saving ? 'Saving...' : editingCampaign ? 'Save Changes' : 'Create Campaign' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Campaign Detail Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDetailDialog"
          class="campaigns-dialog__overlay"
          @click.self="showDetailDialog = false"
          @keydown.esc="showDetailDialog = false"
        >
          <Transition name="dialog" appear>
            <div
              v-if="showDetailDialog"
              class="campaigns-dialog campaigns-dialog--detail"
              role="dialog"
              aria-modal="true"
            >
              <div class="campaigns-dialog__accent campaigns-dialog__accent--cyan"></div>

              <!-- Header -->
              <div class="campaigns-dialog__header">
                <button class="campaigns-dialog__close" @click="showDetailDialog = false" title="Close">
                  <X :size="18" />
                </button>
                <div class="campaigns-dialog__icon campaigns-dialog__icon--cyan">
                  <Eye :size="24" />
                </div>
                <h2 class="campaigns-dialog__title">{{ selectedCampaign?.title }}</h2>
                <p class="campaigns-dialog__subtitle">Campaign details and management</p>
              </div>

              <!-- Tabs -->
              <div class="campaigns-detail__tabs">
                <button
                  class="campaigns-detail__tab"
                  :class="{ 'campaigns-detail__tab--active': detailTab === 'overview' }"
                  @click="detailTab = 'overview'"
                >
                  Overview
                </button>
                <button
                  class="campaigns-detail__tab"
                  :class="{ 'campaigns-detail__tab--active': detailTab === 'participants' }"
                  @click="detailTab = 'participants'"
                >
                  Participants
                </button>
                <button
                  class="campaigns-detail__tab"
                  :class="{ 'campaigns-detail__tab--active': detailTab === 'submissions' }"
                  @click="detailTab = 'submissions'"
                >
                  Submissions
                </button>
              </div>

              <!-- Content -->
              <div class="campaigns-dialog__content">
                <!-- Overview Tab -->
                <div v-if="detailTab === 'overview'" class="campaigns-detail__content">
                  <div class="campaigns-detail__stats-grid">
                    <div class="campaigns-detail__stat-card campaigns-detail__stat-card--green">
                      <span class="campaigns-detail__stat-value">${{ formatCpm(selectedCampaign?.cpm || 0) }}</span>
                      <span class="campaigns-detail__stat-label">
                        per {{ formatViews(selectedCampaign?.cpm_views || 1000) }} views
                      </span>
                    </div>
                    <div class="campaigns-detail__stat-card">
                      <span class="campaigns-detail__stat-value">
                        ${{ formatBudget(selectedCampaign?.budget || 0) }}
                      </span>
                      <span class="campaigns-detail__stat-label">budget</span>
                    </div>
                    <div class="campaigns-detail__stat-card">
                      <span class="campaigns-detail__stat-value">
                        ${{ formatBudget(selectedCampaign?.spent || 0) }}
                      </span>
                      <span class="campaigns-detail__stat-label">spent</span>
                    </div>
                    <div class="campaigns-detail__stat-card">
                      <span class="campaigns-detail__stat-value">{{ participants.length }}</span>
                      <span class="campaigns-detail__stat-label">participants</span>
                    </div>
                  </div>

                  <div v-if="selectedCampaign?.description" class="campaigns-detail__desc-card">
                    <h4 class="campaigns-detail__desc-title">Description</h4>
                    <p class="campaigns-detail__desc-text">{{ selectedCampaign.description }}</p>
                  </div>
                </div>

                <!-- Participants Tab -->
                <div v-else-if="detailTab === 'participants'" class="campaigns-detail__content">
                  <div v-if="loadingParticipants" class="campaigns-detail__loading">
                    <Loader2 class="campaigns-dialog__spinner" />
                  </div>
                  <div v-else-if="participants.length === 0" class="campaigns-detail__empty">No participants yet</div>
                  <div v-else class="campaigns-detail__list">
                    <div
                      v-for="participant in participants"
                      :key="participant.id"
                      class="campaigns-detail__participant"
                    >
                      <div class="campaigns-detail__participant-avatar">
                        <img
                          v-if="participant.clipper_profile?.avatar_url"
                          :src="participant.clipper_profile.avatar_url"
                        />
                        <User v-else class="campaigns-detail__participant-avatar-icon" />
                      </div>
                      <div class="campaigns-detail__participant-info">
                        <div class="campaigns-detail__participant-header">
                          <span class="campaigns-detail__participant-name">
                            {{
                              participant.clipper_profile?.display_name ||
                              participant.user?.display_name ||
                              participant.user?.email
                            }}
                          </span>
                          <CheckCircle
                            v-if="participant.clipper_profile?.is_verified"
                            class="campaigns-detail__verified-icon"
                          />
                          <span
                            v-if="participant.clipper_profile?.experience_level"
                            class="campaigns-detail__participant-level"
                          >
                            {{ participant.clipper_profile.experience_level }}
                          </span>
                        </div>
                        <div v-if="participant.clipper_profile" class="campaigns-detail__participant-stats">
                          <span>{{ participant.clipper_profile.total_campaigns_completed }} campaigns</span>
                          <span>{{ participant.clipper_profile.total_clips_delivered }} clips</span>
                        </div>
                        <div
                          v-if="participant.clipper_profile?.specialty_tags?.length"
                          class="campaigns-detail__participant-tags"
                        >
                          <span
                            v-for="tag in participant.clipper_profile.specialty_tags.slice(0, 4)"
                            :key="tag"
                            class="campaigns-detail__participant-tag"
                          >
                            {{ tag }}
                          </span>
                        </div>
                        <div v-if="participant.application_note" class="campaigns-detail__participant-note">
                          "{{ participant.application_note }}"
                        </div>
                        <div class="campaigns-detail__participant-meta">
                          Applied {{ formatDate(participant.inserted_at) }}
                          <router-link
                            v-if="participant.clipper_profile?.slug"
                            :to="`/clippers/${participant.clipper_profile.slug}`"
                            class="campaigns-detail__participant-link"
                          >
                            View Profile →
                          </router-link>
                        </div>
                      </div>
                      <div class="campaigns-detail__participant-actions">
                        <span
                          class="campaigns-detail__participant-status"
                          :class="`campaigns-detail__participant-status--${participant.status}`"
                        >
                          {{ participant.status }}
                        </span>
                        <template v-if="isAdmin && participant.status === 'pending'">
                          <button
                            class="campaigns-detail__action-btn campaigns-detail__action-btn--approve"
                            @click="approveParticipantAction(participant)"
                          >
                            <Check :size="14" />
                          </button>
                          <button
                            class="campaigns-detail__action-btn campaigns-detail__action-btn--reject"
                            @click="rejectParticipantAction(participant)"
                          >
                            <X :size="14" />
                          </button>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Submissions Tab -->
                <div v-else-if="detailTab === 'submissions'" class="campaigns-detail__content">
                  <div v-if="loadingSubmissions" class="campaigns-detail__loading">
                    <Loader2 class="campaigns-dialog__spinner" />
                  </div>
                  <div v-else-if="submissions.length === 0" class="campaigns-detail__empty">No submissions yet</div>
                  <div v-else class="campaigns-detail__list">
                    <div v-for="submission in submissions" :key="submission.id" class="campaigns-detail__submission">
                      <div class="campaigns-detail__submission-info">
                        <div class="campaigns-detail__submission-header">
                          <component
                            :is="getPlatformIcon(submission.platform)"
                            class="campaigns-detail__submission-platform"
                          />
                          <a :href="submission.clip_url" target="_blank" class="campaigns-detail__submission-url">
                            {{ truncateUrl(submission.clip_url) }}
                          </a>
                        </div>
                        <div class="campaigns-detail__submission-meta">
                          by {{ submission.user?.display_name || submission.user?.email }} ·
                          {{ submission.view_count.toLocaleString() }} views
                        </div>
                      </div>
                      <div class="campaigns-detail__submission-actions">
                        <span
                          class="campaigns-detail__submission-status"
                          :class="`campaigns-detail__submission-status--${submission.status}`"
                        >
                          {{ submission.status }}
                        </span>
                        <template v-if="isAdmin && submission.status === 'pending'">
                          <button
                            class="campaigns-detail__action-btn campaigns-detail__action-btn--approve"
                            @click="verifySubmissionAction(submission)"
                          >
                            <Check :size="14" />
                          </button>
                          <button
                            class="campaigns-detail__action-btn campaigns-detail__action-btn--reject"
                            @click="rejectSubmissionAction(submission)"
                          >
                            <X :size="14" />
                          </button>
                        </template>
                        <button
                          v-if="isAdmin && submission.status === 'verified'"
                          class="campaigns-detail__pay-btn"
                          @click="openPaymentDialog(submission)"
                        >
                          <DollarSign :size="14" />
                          Pay
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDeleteDialog"
          class="campaigns-dialog__overlay"
          @click.self="showDeleteDialog = false"
          @keydown.esc="showDeleteDialog = false"
        >
          <Transition name="dialog" appear>
            <div
              v-if="showDeleteDialog"
              class="campaigns-dialog campaigns-dialog--small"
              role="dialog"
              aria-modal="true"
            >
              <div class="campaigns-dialog__accent campaigns-dialog__accent--red"></div>

              <!-- Header -->
              <div class="campaigns-dialog__header">
                <button class="campaigns-dialog__close" @click="showDeleteDialog = false" :disabled="deleting">
                  <X :size="18" />
                </button>
                <div class="campaigns-dialog__icon campaigns-dialog__icon--red">
                  <Trash2 :size="24" />
                </div>
                <h2 class="campaigns-dialog__title">Delete Campaign</h2>
                <p class="campaigns-dialog__subtitle">This action cannot be undone</p>
              </div>

              <!-- Content -->
              <div class="campaigns-dialog__content">
                <div class="campaigns-dialog__preview">
                  <div class="campaigns-dialog__preview-icon">
                    <Megaphone :size="20" />
                  </div>
                  <div class="campaigns-dialog__preview-info">
                    <span class="campaigns-dialog__preview-name">{{ campaignToDelete?.title }}</span>
                    <span class="campaigns-dialog__preview-meta">Campaign</span>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="campaigns-dialog__footer">
                <button
                  class="campaigns-dialog__btn campaigns-dialog__btn--secondary"
                  @click="showDeleteDialog = false"
                  :disabled="deleting"
                >
                  Cancel
                </button>
                <button
                  class="campaigns-dialog__btn campaigns-dialog__btn--danger"
                  @click="deleteCampaignAction"
                  :disabled="deleting"
                >
                  <Loader2 v-if="deleting" class="campaigns-dialog__btn-spinner" />
                  {{ deleting ? 'Deleting...' : 'Delete Campaign' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Payment Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showPaymentDialog"
          class="campaigns-dialog__overlay"
          @click.self="showPaymentDialog = false"
          @keydown.esc="showPaymentDialog = false"
        >
          <Transition name="dialog" appear>
            <div
              v-if="showPaymentDialog"
              class="campaigns-dialog campaigns-dialog--small"
              role="dialog"
              aria-modal="true"
            >
              <div class="campaigns-dialog__accent campaigns-dialog__accent--green"></div>

              <!-- Header -->
              <div class="campaigns-dialog__header">
                <button class="campaigns-dialog__close" @click="showPaymentDialog = false" :disabled="creatingPayment">
                  <X :size="18" />
                </button>
                <div class="campaigns-dialog__icon campaigns-dialog__icon--green">
                  <DollarSign :size="24" />
                </div>
                <h2 class="campaigns-dialog__title">Create Payment</h2>
                <p class="campaigns-dialog__subtitle">
                  Pay for submission with {{ paymentSubmission?.view_count.toLocaleString() }} views
                </p>
              </div>

              <!-- Content -->
              <div class="campaigns-dialog__content">
                <div class="campaigns-dialog__field">
                  <label class="campaigns-dialog__label">Amount ($)</label>
                  <input
                    v-model.number="paymentAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    class="campaigns-dialog__input"
                  />
                  <p class="campaigns-dialog__hint">
                    Suggested:
                    <span class="campaigns-dialog__hint-value">${{ calculateSuggestedPayment().toFixed(2) }}</span>
                    based on CPM
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div class="campaigns-dialog__footer">
                <button
                  class="campaigns-dialog__btn campaigns-dialog__btn--secondary"
                  @click="showPaymentDialog = false"
                  :disabled="creatingPayment"
                >
                  Cancel
                </button>
                <button
                  class="campaigns-dialog__btn campaigns-dialog__btn--success"
                  @click="createPaymentAction"
                  :disabled="creatingPayment || paymentAmount <= 0"
                >
                  <Loader2 v-if="creatingPayment" class="campaigns-dialog__btn-spinner" />
                  {{ creatingPayment ? 'Processing...' : 'Create Payment' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Watermark Position Picker -->
    <WatermarkPositionPicker
      :show="showWatermarkPositionPicker"
      :settings="campaignForm.global_watermark_settings || undefined"
      @close="showWatermarkPositionPicker = false"
      @save="handleWatermarkSettingsSave"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, watch } from 'vue';
  import {
    Megaphone,
    Plus,
    DollarSign,
    Wallet,
    Users,
    Eye,
    Pencil,
    MoreVertical,
    Play,
    Pause,
    CheckCircle,
    Trash2,
    Loader2,
    User,
    Check,
    X,
    Music2,
    Instagram,
    Twitter,
    Youtube,
    Globe,
    Upload,
    Calendar,
  } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Textarea } from '@/components/ui/textarea';
  import { Checkbox } from '@/components/ui/checkbox';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from '@/components/ui/dialog';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import {
    listOrganizationCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    pauseCampaign,
    activateCampaign,
    completeCampaign,
    listCampaignParticipants,
    approveParticipant,
    rejectParticipant,
    listCampaignSubmissions,
    verifySubmission,
    rejectSubmission,
    createPayment,
    uploadCampaignCoverImage,
    setCampaignCreatorProfiles,
    type Campaign,
    type CampaignParticipant,
    type CampaignSubmission,
    type CampaignCreatorProfile,
    getPlatformDisplayName,
  } from '@/services/campaignApi';
  import {
    listOrganizationCreatorProfiles,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import { listOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { CLIPPER_PLATFORMS, PAYMENT_METHOD_TYPES } from '@/services/clipperProfileApi';
  import { useToast } from '@/composables/useToast';
  import WatermarkPositionPicker, { type CreatorWatermarkSettings } from '@/components/WatermarkPositionPicker.vue';

  const props = defineProps<{
    organizationId: string;
    isAdmin: boolean;
  }>();

  const { toast } = useToast();

  const loading = ref(true);
  const saving = ref(false);
  const deleting = ref(false);
  const campaigns = ref<Campaign[]>([]);

  const showCampaignDialog = ref(false);
  const showDetailDialog = ref(false);
  const showDeleteDialog = ref(false);
  const showPaymentDialog = ref(false);
  const showWatermarkPositionPicker = ref(false);

  const editingCampaign = ref<Campaign | null>(null);
  const selectedCampaign = ref<Campaign | null>(null);
  const campaignToDelete = ref<Campaign | null>(null);

  const detailTab = ref('overview');
  const participants = ref<CampaignParticipant[]>([]);
  const submissions = ref<CampaignSubmission[]>([]);
  const loadingParticipants = ref(false);
  const loadingSubmissions = ref(false);

  const paymentSubmission = ref<CampaignSubmission | null>(null);
  const paymentAmount = ref(0);
  const creatingPayment = ref(false);

  // Cover image upload
  const coverImageInput = ref<HTMLInputElement | null>(null);
  const coverImagePreview = ref('');
  const uploadingCoverImage = ref(false);

  const availablePlatforms = CLIPPER_PLATFORMS;
  const availablePaymentMethods = PAYMENT_METHOD_TYPES;

  // Creator profiles and assets for campaign assignment
  const availableCreatorProfiles = ref<ServerOrganizationCreatorProfile[]>([]);
  const availableAssets = ref<ServerOrganizationAsset[]>([]);
  const loadingProfiles = ref(false);
  const selectedCreatorProfileIds = ref<number[]>([]);

  const campaignForm = reactive({
    title: '',
    description: '',
    cpm: 0,
    cpm_views: 1000,
    budget: 0,
    min_views_for_payment: 1000,
    join_type: 'open' as 'open' | 'application_required',
    allowed_platforms: [] as string[],
    payment_methods: [] as string[],
    cover_image_url: '',
    starts_at: '',
    ends_at: '',
    // Global assets
    global_intro_id: null as number | null,
    global_outro_id: null as number | null,
    global_watermarks: {} as Record<string, any>,
    global_watermark_settings: null as CreatorWatermarkSettings | null,
    require_watermark: false,
    require_intro: false,
    require_outro: false,
  });

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, typeof Music2> = {
      tiktok: Music2,
      instagram: Instagram,
      x: Twitter,
      youtube: Youtube,
    };
    return icons[platform] || Globe;
  };

  const formatCpm = (cpm: string | number) => {
    const value = typeof cpm === 'string' ? parseFloat(cpm) : cpm;
    return value.toFixed(2);
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(0)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(0)}K`;
    return views.toString();
  };

  const formatBudget = (budget: string | number) => {
    const value = typeof budget === 'string' ? parseFloat(budget) : budget;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const truncateUrl = (url: string) => {
    return url.length > 50 ? url.substring(0, 50) + '...' : url;
  };

  const getStatusVariant = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      paused: 'secondary',
      completed: 'outline',
      draft: 'secondary',
    };
    return variants[status] || 'secondary';
  };

  const getParticipantStatusVariant = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      approved: 'default',
      pending: 'secondary',
      rejected: 'destructive',
      removed: 'destructive',
    };
    return variants[status] || 'secondary';
  };

  const getSubmissionStatusVariant = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      verified: 'default',
      pending: 'secondary',
      rejected: 'destructive',
      paid: 'default',
    };
    return variants[status] || 'secondary';
  };

  // Cover image upload functions
  const triggerCoverImageUpload = () => {
    coverImageInput.value?.click();
  };

  const handleCoverImageSelect = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file' });
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      coverImagePreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Upload to server
    uploadingCoverImage.value = true;
    try {
      const response = await uploadCampaignCoverImage(Number(props.organizationId), file);
      if (response.success && response.url) {
        campaignForm.cover_image_url = response.url;
        toast({ title: 'Success', description: 'Cover image uploaded' });
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to upload image' });
        coverImagePreview.value = '';
      }
    } catch (error) {
      console.error('Failed to upload cover image:', error);
      toast({ title: 'Error', description: 'Failed to upload image' });
      coverImagePreview.value = '';
    } finally {
      uploadingCoverImage.value = false;
      // Reset input so same file can be selected again
      input.value = '';
    }
  };

  const clearCoverImage = () => {
    campaignForm.cover_image_url = '';
    coverImagePreview.value = '';
  };

  const handleImageError = (event: Event) => {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  };

  const togglePlatform = (platform: string) => {
    const idx = campaignForm.allowed_platforms.indexOf(platform);
    if (idx >= 0) {
      campaignForm.allowed_platforms.splice(idx, 1);
    } else {
      campaignForm.allowed_platforms.push(platform);
    }
  };

  const togglePaymentMethod = (method: string) => {
    const idx = campaignForm.payment_methods.indexOf(method);
    if (idx >= 0) {
      campaignForm.payment_methods.splice(idx, 1);
    } else {
      campaignForm.payment_methods.push(method);
    }
  };

  const loadCampaigns = async () => {
    if (!props.organizationId) return;

    loading.value = true;
    try {
      const response = await listOrganizationCampaigns(Number(props.organizationId));
      if (response.success) {
        campaigns.value = response.campaigns;
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      toast({ title: 'Error', description: 'Failed to load campaigns' });
    } finally {
      loading.value = false;
    }
  };

  const loadCreatorProfilesAndAssets = async () => {
    if (!props.organizationId) return;

    loadingProfiles.value = true;
    try {
      const [profilesRes, assetsRes] = await Promise.all([
        listOrganizationCreatorProfiles(props.organizationId),
        listOrganizationAssets(props.organizationId),
      ]);

      if (profilesRes.success) {
        availableCreatorProfiles.value = profilesRes.profiles;
      }
      if (assetsRes.success) {
        availableAssets.value = assetsRes.assets;
      }
    } catch (error) {
      console.error('Failed to load creator profiles/assets:', error);
    } finally {
      loadingProfiles.value = false;
    }
  };

  const toggleCreatorProfile = (profileId: number) => {
    const idx = selectedCreatorProfileIds.value.indexOf(profileId);
    if (idx >= 0) {
      selectedCreatorProfileIds.value.splice(idx, 1);
    } else {
      selectedCreatorProfileIds.value.push(profileId);
    }
  };

  const setWatermark = (aspectRatio: string, value: string) => {
    if (value && value !== 'null') {
      campaignForm.global_watermarks[aspectRatio] = parseInt(value);
    } else {
      delete campaignForm.global_watermarks[aspectRatio];
    }
  };

  // Watermark position picker helpers
  const hasAnyWatermarkConfigured = computed(() => {
    if (!campaignForm.global_watermark_settings) return false;
    const settings = campaignForm.global_watermark_settings;
    return ['16:9', '9:16', '1:1', '4:5'].some((ratio) => settings[ratio as keyof CreatorWatermarkSettings] !== null);
  });

  const getConfiguredWatermarkRatios = () => {
    if (!campaignForm.global_watermark_settings) return '';
    const settings = campaignForm.global_watermark_settings;
    const configured = ['16:9', '9:16', '1:1', '4:5'].filter(
      (ratio) => settings[ratio as keyof CreatorWatermarkSettings] !== null
    );
    return configured.join(', ');
  };

  const openWatermarkPositionPicker = () => {
    showWatermarkPositionPicker.value = true;
  };

  const handleWatermarkSettingsSave = (settings: CreatorWatermarkSettings) => {
    campaignForm.global_watermark_settings = settings;
    showWatermarkPositionPicker.value = false;
  };

  const openCreateDialog = async () => {
    editingCampaign.value = null;
    coverImagePreview.value = '';
    selectedCreatorProfileIds.value = [];
    Object.assign(campaignForm, {
      title: '',
      description: '',
      cpm: 0,
      cpm_views: 1000,
      budget: 0,
      min_views_for_payment: 1000,
      join_type: 'open' as 'open' | 'application_required',
      allowed_platforms: [] as string[],
      payment_methods: [] as string[],
      cover_image_url: '',
      starts_at: '',
      ends_at: '',
      global_intro_id: null,
      global_outro_id: null,
      global_watermarks: {},
      global_watermark_settings: null,
      require_watermark: false,
      require_intro: false,
      require_outro: false,
    });
    showCampaignDialog.value = true;
    await loadCreatorProfilesAndAssets();
  };

  const editCampaign = async (campaign: Campaign) => {
    editingCampaign.value = campaign;
    coverImagePreview.value = '';
    selectedCreatorProfileIds.value = campaign.creator_profiles?.map((p) => p.id) || [];
    Object.assign(campaignForm, {
      title: campaign.title,
      description: campaign.description || '',
      cpm: parseFloat(campaign.cpm),
      cpm_views: campaign.cpm_views || 1000,
      budget: parseFloat(campaign.budget),
      min_views_for_payment: campaign.min_views_for_payment,
      join_type: campaign.join_type,
      allowed_platforms: [...campaign.allowed_platforms],
      payment_methods: [...campaign.payment_methods],
      cover_image_url: campaign.cover_image_url || '',
      starts_at: campaign.starts_at ? campaign.starts_at.slice(0, 16) : '',
      ends_at: campaign.ends_at ? campaign.ends_at.slice(0, 16) : '',
      global_intro_id: campaign.global_intro_id || null,
      global_outro_id: campaign.global_outro_id || null,
      global_watermarks: campaign.global_watermarks || {},
      global_watermark_settings: (campaign.global_watermarks as unknown as CreatorWatermarkSettings) || null,
      require_watermark: campaign.require_watermark || false,
      require_intro: campaign.require_intro || false,
      require_outro: campaign.require_outro || false,
    });
    showCampaignDialog.value = true;
    await loadCreatorProfilesAndAssets();
  };

  const saveCampaign = async () => {
    saving.value = true;
    try {
      const data = {
        title: campaignForm.title,
        description: campaignForm.description || undefined,
        cpm: campaignForm.cpm,
        cpm_views: campaignForm.cpm_views,
        budget: campaignForm.budget,
        min_views_for_payment: campaignForm.min_views_for_payment,
        join_type: campaignForm.join_type,
        allowed_platforms: campaignForm.allowed_platforms,
        payment_methods: campaignForm.payment_methods,
        cover_image_url: campaignForm.cover_image_url || undefined,
        starts_at: campaignForm.starts_at || undefined,
        ends_at: campaignForm.ends_at || undefined,
        global_intro_id: campaignForm.global_intro_id,
        global_outro_id: campaignForm.global_outro_id,
        global_watermarks: campaignForm.global_watermark_settings || campaignForm.global_watermarks,
        require_watermark: campaignForm.require_watermark,
        require_intro: campaignForm.require_intro,
        require_outro: campaignForm.require_outro,
      };

      let response;
      if (editingCampaign.value) {
        response = await updateCampaign(Number(props.organizationId), editingCampaign.value.id, data);
      } else {
        response = await createCampaign(Number(props.organizationId), data);
      }

      if (response.success && response.campaign) {
        // Save creator profiles assignment
        if (selectedCreatorProfileIds.value.length > 0) {
          await setCampaignCreatorProfiles(
            Number(props.organizationId),
            response.campaign.id,
            selectedCreatorProfileIds.value
          );
        }

        toast({ title: 'Success', description: `Campaign ${editingCampaign.value ? 'updated' : 'created'}` });
        showCampaignDialog.value = false;
        await loadCampaigns();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to save campaign' });
      }
    } catch (error) {
      console.error('Failed to save campaign:', error);
      toast({ title: 'Error', description: 'Failed to save campaign' });
    } finally {
      saving.value = false;
    }
  };

  const viewCampaign = async (campaign: Campaign) => {
    selectedCampaign.value = campaign;
    detailTab.value = 'overview';
    showDetailDialog.value = true;
    await loadParticipants();
    await loadSubmissions();
  };

  const loadParticipants = async () => {
    if (!selectedCampaign.value) return;

    loadingParticipants.value = true;
    try {
      const response = await listCampaignParticipants(Number(props.organizationId), selectedCampaign.value.id);
      if (response.success) {
        participants.value = response.participants;
      }
    } catch (error) {
      console.error('Failed to load participants:', error);
    } finally {
      loadingParticipants.value = false;
    }
  };

  const loadSubmissions = async () => {
    if (!selectedCampaign.value) return;

    loadingSubmissions.value = true;
    try {
      const response = await listCampaignSubmissions(Number(props.organizationId), selectedCampaign.value.id);
      if (response.success) {
        submissions.value = response.submissions;
      }
    } catch (error) {
      console.error('Failed to load submissions:', error);
    } finally {
      loadingSubmissions.value = false;
    }
  };

  const confirmDeleteCampaign = (campaign: Campaign) => {
    campaignToDelete.value = campaign;
    showDeleteDialog.value = true;
  };

  const deleteCampaignAction = async () => {
    if (!campaignToDelete.value) return;

    deleting.value = true;
    try {
      const response = await deleteCampaign(Number(props.organizationId), campaignToDelete.value.id);
      if (response.success) {
        toast({ title: 'Deleted', description: 'Campaign deleted successfully' });
        showDeleteDialog.value = false;
        await loadCampaigns();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to delete campaign' });
      }
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      toast({ title: 'Error', description: 'Failed to delete campaign' });
    } finally {
      deleting.value = false;
    }
  };

  const pauseCampaignAction = async (campaign: Campaign) => {
    try {
      const response = await pauseCampaign(Number(props.organizationId), campaign.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Campaign paused' });
        await loadCampaigns();
      }
    } catch (error) {
      console.error('Failed to pause campaign:', error);
      toast({ title: 'Error', description: 'Failed to pause campaign' });
    }
  };

  const activateCampaignAction = async (campaign: Campaign) => {
    try {
      const response = await activateCampaign(Number(props.organizationId), campaign.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Campaign activated' });
        await loadCampaigns();
      }
    } catch (error) {
      console.error('Failed to activate campaign:', error);
      toast({ title: 'Error', description: 'Failed to activate campaign' });
    }
  };

  const completeCampaignAction = async (campaign: Campaign) => {
    try {
      const response = await completeCampaign(Number(props.organizationId), campaign.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Campaign completed' });
        await loadCampaigns();
      }
    } catch (error) {
      console.error('Failed to complete campaign:', error);
      toast({ title: 'Error', description: 'Failed to complete campaign' });
    }
  };

  const approveParticipantAction = async (participant: CampaignParticipant) => {
    if (!selectedCampaign.value) return;
    try {
      const response = await approveParticipant(
        Number(props.organizationId),
        selectedCampaign.value.id,
        participant.id
      );
      if (response.success) {
        toast({ title: 'Success', description: 'Participant approved' });
        await loadParticipants();
      }
    } catch (error) {
      console.error('Failed to approve participant:', error);
      toast({ title: 'Error', description: 'Failed to approve participant' });
    }
  };

  const rejectParticipantAction = async (participant: CampaignParticipant) => {
    if (!selectedCampaign.value) return;
    try {
      const response = await rejectParticipant(Number(props.organizationId), selectedCampaign.value.id, participant.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Participant rejected' });
        await loadParticipants();
      }
    } catch (error) {
      console.error('Failed to reject participant:', error);
      toast({ title: 'Error', description: 'Failed to reject participant' });
    }
  };

  const verifySubmissionAction = async (submission: CampaignSubmission) => {
    try {
      const response = await verifySubmission(Number(props.organizationId), submission.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Submission verified' });
        await loadSubmissions();
      }
    } catch (error) {
      console.error('Failed to verify submission:', error);
      toast({ title: 'Error', description: 'Failed to verify submission' });
    }
  };

  const rejectSubmissionAction = async (submission: CampaignSubmission) => {
    try {
      const response = await rejectSubmission(Number(props.organizationId), submission.id, 'Rejected by admin');
      if (response.success) {
        toast({ title: 'Success', description: 'Submission rejected' });
        await loadSubmissions();
      }
    } catch (error) {
      console.error('Failed to reject submission:', error);
      toast({ title: 'Error', description: 'Failed to reject submission' });
    }
  };

  const openPaymentDialog = (submission: CampaignSubmission) => {
    paymentSubmission.value = submission;
    paymentAmount.value = calculateSuggestedPayment();
    showPaymentDialog.value = true;
  };

  const calculateSuggestedPayment = () => {
    if (!paymentSubmission.value || !selectedCampaign.value) return 0;
    const cpm = parseFloat(selectedCampaign.value.cpm);
    const cpmViews = selectedCampaign.value.cpm_views || 1000;
    return (paymentSubmission.value.view_count / cpmViews) * cpm;
  };

  const createPaymentAction = async () => {
    if (!paymentSubmission.value) return;

    creatingPayment.value = true;
    try {
      const response = await createPayment(
        Number(props.organizationId),
        paymentSubmission.value.id,
        paymentAmount.value
      );
      if (response.success) {
        toast({ title: 'Success', description: 'Payment created' });
        showPaymentDialog.value = false;
        await loadSubmissions();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to create payment' });
      }
    } catch (error) {
      console.error('Failed to create payment:', error);
      toast({ title: 'Error', description: 'Failed to create payment' });
    } finally {
      creatingPayment.value = false;
    }
  };

  watch(
    () => props.organizationId,
    () => {
      if (props.organizationId) {
        loadCampaigns();
      }
    },
    { immediate: true }
  );

  onMounted(() => {
    if (props.organizationId) {
      loadCampaigns();
    }
  });

  defineExpose({ openCreateDialog });
</script>

<style scoped>
  /* ===== Container ===== */
  .campaigns {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ===== Page Heading ===== */
  .campaigns__heading {
    margin-bottom: 0;
  }

  .campaigns__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.025em;
  }

  .campaigns__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Campaigns List ===== */
  .campaigns__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ===== Campaign Card ===== */
  .campaigns__card {
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .campaigns__card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .campaigns__card-indicator {
    width: 3px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .campaigns__card-indicator--active {
    background: linear-gradient(to bottom, #10b981 0%, #059669 100%);
  }

  .campaigns__card-indicator--paused {
    background: linear-gradient(to bottom, #f59e0b 0%, #d97706 100%);
  }

  .campaigns__card-indicator--completed {
    background: linear-gradient(to bottom, #6366f1 0%, #4f46e5 100%);
  }

  .campaigns__card-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1rem;
  }

  /* ===== Cover Image ===== */
  .campaigns__cover {
    position: relative;
    width: 80px;
    height: 80px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background-color: var(--sidebar-hover);
  }

  .campaigns__cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .campaigns__cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--sidebar-hover);
  }

  .campaigns__cover-icon {
    width: 28px;
    height: 28px;
    color: var(--sidebar-accent);
    opacity: 0.5;
  }

  /* ===== Status Badge ===== */
  .campaigns__status {
    position: absolute;
    top: 4px;
    left: 4px;
    padding: 0.1875rem 0.4375rem;
    font-size: 0.5625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    border-radius: 4px;
    backdrop-filter: blur(4px);
    background-color: rgba(113, 113, 122, 0.9);
    color: white;
  }

  .campaigns__status--active {
    background-color: rgba(16, 185, 129, 0.9);
  }

  .campaigns__status--paused {
    background-color: rgba(245, 158, 11, 0.9);
  }

  .campaigns__status--completed {
    background-color: rgba(99, 102, 241, 0.9);
  }

  .campaigns__status--draft {
    background-color: rgba(113, 113, 122, 0.9);
  }

  /* ===== Campaign Info ===== */
  .campaigns__info {
    flex: 1;
    min-width: 0;
  }

  .campaigns__name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .campaigns__desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.5rem;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .campaigns__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .campaigns__meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .campaigns__meta-icon {
    width: 12px;
    height: 12px;
  }

  /* ===== Stats ===== */
  .campaigns__stats {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 0 1.25rem;
    border-left: 1px solid var(--sidebar-border);
    flex-shrink: 0;
  }

  @media (max-width: 900px) {
    .campaigns__stats {
      display: none;
    }
  }

  .campaigns__stat {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 70px;
  }

  .campaigns__stat-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .campaigns__stat-data {
    display: flex;
    flex-direction: column;
    gap: 0.0625rem;
  }

  .campaigns__stat-value {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .campaigns__stat-label {
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  /* ===== Actions ===== */
  .campaigns__actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .campaigns__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaigns__action-btn:hover {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.15);
    color: var(--sidebar-text);
  }

  .campaigns__action-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Empty State ===== */
  .campaigns__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    background-color: var(--sidebar-surface);
    border: 1px dashed var(--sidebar-border);
    border-radius: 12px;
  }

  .campaigns__empty-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--sidebar-hover);
    margin-bottom: 1.25rem;
  }

  .campaigns__empty-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-accent);
  }

  .campaigns__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .campaigns__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.25rem;
    max-width: 300px;
  }

  .campaigns__empty-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaigns__empty-btn:hover {
    opacity: 0.9;
  }

  .campaigns__empty-btn-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Skeleton Loading ===== */
  .campaigns__card--skeleton {
    pointer-events: none;
  }

  .campaigns__skeleton-cover {
    width: 72px;
    height: 72px;
    border-radius: 10px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .campaigns__skeleton-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .campaigns__skeleton-title {
    height: 18px;
    width: 60%;
    border-radius: 4px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.1s;
  }

  .campaigns__skeleton-desc {
    height: 14px;
    width: 90%;
    border-radius: 4px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.15s;
  }

  .campaigns__skeleton-stats {
    height: 12px;
    width: 70%;
    border-radius: 4px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.2s;
  }

  .campaigns__skeleton-badge {
    width: 60px;
    height: 24px;
    border-radius: 4px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.25s;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* ===== Dialog Overlay ===== */
  .campaigns-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  /* ===== Dialog Container ===== */
  .campaigns-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 640px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .campaigns-dialog--form {
    max-width: 640px;
  }

  .campaigns-dialog--detail {
    max-width: 720px;
  }

  .campaigns-dialog--small {
    max-width: 440px;
  }

  /* ===== Accent Bar ===== */
  .campaigns-dialog__accent {
    height: 3px;
    flex-shrink: 0;
  }

  .campaigns-dialog__accent--purple {
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  }

  .campaigns-dialog__accent--cyan {
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  }

  .campaigns-dialog__accent--red {
    background: linear-gradient(90deg, #ef4444, rgba(239, 68, 68, 0.5));
  }

  .campaigns-dialog__accent--green {
    background: linear-gradient(90deg, #10b981, rgba(16, 185, 129, 0.5));
  }

  /* ===== Header ===== */
  .campaigns-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .campaigns-dialog__close {
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

  .campaigns-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .campaigns-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .campaigns-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
  }

  .campaigns-dialog__icon--purple {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .campaigns-dialog__icon--cyan {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .campaigns-dialog__icon--red {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .campaigns-dialog__icon--green {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .campaigns-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .campaigns-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .campaigns-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
  }

  .campaigns-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .campaigns-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .campaigns-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form Styles ===== */
  .campaigns-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .campaigns-dialog__description {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  /* ===== Form Field ===== */
  .campaigns-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .campaigns-dialog__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .campaigns-dialog__label-hint {
    font-weight: 400;
    color: var(--sidebar-text-muted);
    margin-left: 0.25rem;
  }

  .campaigns-dialog__input,
  .campaigns-dialog__select,
  .campaigns-dialog__textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .campaigns-dialog__input::placeholder,
  .campaigns-dialog__textarea::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .campaigns-dialog__input:focus,
  .campaigns-dialog__select:focus,
  .campaigns-dialog__textarea:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .campaigns-dialog__input--url {
    flex: 1;
  }

  .campaigns-dialog__textarea {
    resize: vertical;
    min-height: 80px;
    line-height: 1.5;
  }

  .campaigns-dialog__select {
    cursor: pointer;
  }

  .campaigns-dialog__select option {
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text);
  }

  .campaigns-dialog__row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .campaigns-dialog__row--3 {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 640px) {
    .campaigns-dialog__row--3 {
      grid-template-columns: 1fr;
    }
  }

  .campaigns-dialog__hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: -0.25rem;
  }

  .campaigns-dialog__hint--small {
    font-size: 0.6875rem;
  }

  .campaigns-dialog__hint-value {
    color: #34d399;
    font-weight: 600;
  }

  /* ===== Note Box ===== */
  .campaigns-dialog__note {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    border-radius: 8px;
  }

  .campaigns-dialog__note-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background-color: rgba(6, 182, 212, 0.15);
    border-radius: 6px;
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .campaigns-dialog__note-text {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  /* ===== Chips ===== */
  .campaigns-dialog__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .campaigns-dialog__chip {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaigns-dialog__chip:hover {
    background-color: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .campaigns-dialog__chip--active {
    background-color: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.3);
    color: var(--sidebar-accent);
  }

  /* ===== Creator Profiles List ===== */
  .campaigns-dialog__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .campaigns-dialog__spinner {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
    animation: spin 0.8s linear infinite;
  }

  .campaigns-dialog__empty-profiles {
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    text-align: center;
  }

  .campaigns-dialog__empty-profiles p {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .campaigns-dialog__profiles-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.5rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .campaigns-dialog__profile {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
    width: 100%;
  }

  .campaigns-dialog__profile:hover {
    border-color: rgba(6, 182, 212, 0.3);
  }

  .campaigns-dialog__profile--selected {
    background-color: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .campaigns-dialog__profile-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--sidebar-hover);
    flex-shrink: 0;
  }

  .campaigns-dialog__profile-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .campaigns-dialog__profile-avatar-icon {
    width: 100%;
    height: 100%;
    padding: 6px;
    color: var(--sidebar-text-muted);
  }

  .campaigns-dialog__profile-info {
    flex: 1;
    min-width: 0;
  }

  .campaigns-dialog__profile-name {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .campaigns-dialog__profile-desc {
    display: block;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .campaigns-dialog__profile-check {
    flex-shrink: 0;
  }

  .campaigns-dialog__profile-check-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-accent);
  }

  /* ===== Section ===== */
  .campaigns-dialog__section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .campaigns-dialog__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .campaigns-dialog__section-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .campaigns-dialog__section-badge {
    font-size: 0.625rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    padding: 0.25rem 0.5rem;
    background-color: var(--sidebar-surface);
    border-radius: 4px;
  }

  .campaigns-dialog__section-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: -0.25rem 0 0.25rem;
  }

  .campaigns-dialog__asset-row {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .campaigns-dialog__asset-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .campaigns-dialog__asset-label {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .campaigns-dialog__checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    cursor: pointer;
  }

  .campaigns-dialog__checkbox {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    accent-color: var(--sidebar-accent);
  }

  .campaigns-dialog__watermark-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .campaigns-dialog__watermark-status {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.75rem;
  }

  .campaigns-dialog__watermark-label {
    color: var(--sidebar-text-muted);
  }

  .campaigns-dialog__watermark-value {
    color: var(--sidebar-accent);
  }

  .campaigns-dialog__watermark-none {
    color: var(--sidebar-text-muted);
  }

  .campaigns-dialog__watermark-btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-accent);
    background-color: rgba(6, 182, 212, 0.1);
    border: 1px solid rgba(6, 182, 212, 0.3);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaigns-dialog__watermark-btn:hover {
    background-color: rgba(6, 182, 212, 0.15);
  }

  /* ===== Cover Upload ===== */
  .campaigns-dialog__cover-preview {
    position: relative;
    width: 100%;
    height: 120px;
    border-radius: 8px;
    overflow: hidden;
    background-color: var(--sidebar-hover);
  }

  .campaigns-dialog__cover-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .campaigns-dialog__cover-remove {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.6);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaigns-dialog__cover-remove:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }

  .campaigns-dialog__cover-remove-icon {
    width: 16px;
    height: 16px;
  }

  .campaigns-dialog__upload-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .campaigns-dialog__upload-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaigns-dialog__upload-btn:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .campaigns-dialog__upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .campaigns-dialog__upload-icon {
    width: 16px;
    height: 16px;
  }

  .campaigns-dialog__file-input {
    display: none;
  }

  .campaigns-dialog__upload-or {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Preview Card ===== */
  .campaigns-dialog__preview {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 10px;
    margin-bottom: 1rem;
  }

  .campaigns-dialog__preview-icon {
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

  .campaigns-dialog__preview-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .campaigns-dialog__preview-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .campaigns-dialog__preview-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  /* ===== Footer ===== */
  .campaigns-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .campaigns-dialog__btn {
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

  .campaigns-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .campaigns-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .campaigns-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .campaigns-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .campaigns-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .campaigns-dialog__btn--danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
  }

  .campaigns-dialog__btn--danger:hover:not(:disabled) {
    opacity: 0.9;
  }

  .campaigns-dialog__btn--success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
  }

  .campaigns-dialog__btn--success:hover:not(:disabled) {
    opacity: 0.9;
  }

  .campaigns-dialog__btn-spinner {
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Detail Dialog Tabs ===== */
  .campaigns-detail__tabs {
    display: flex;
    gap: 0.375rem;
    padding: 0 1.5rem;
    overflow-x: auto;
    flex-shrink: 0;
  }

  .campaigns-detail__tabs::-webkit-scrollbar {
    height: 0;
  }

  .campaigns-detail__tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .campaigns-detail__tab:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .campaigns-detail__tab--active {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .campaigns-detail__tab--active:hover {
    background-color: rgba(6, 182, 212, 0.2);
    color: var(--sidebar-accent);
  }

  .campaigns-detail__content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .campaigns-detail__stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.625rem;
  }

  @media (min-width: 640px) {
    .campaigns-detail__stats-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .campaigns-detail__stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.875rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    text-align: center;
  }

  .campaigns-detail__stat-card--green .campaigns-detail__stat-value {
    color: #34d399;
  }

  .campaigns-detail__stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
  }

  .campaigns-detail__stat-label {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  .campaigns-detail__desc-card {
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  .campaigns-detail__desc-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .campaigns-detail__desc-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .campaigns-detail__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .campaigns-detail__empty {
    padding: 2rem;
    text-align: center;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .campaigns-detail__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .campaigns-detail__participant {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .campaigns-detail__participant-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--sidebar-surface);
    flex-shrink: 0;
  }

  .campaigns-detail__participant-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .campaigns-detail__participant-avatar-icon {
    width: 100%;
    height: 100%;
    padding: 8px;
    color: var(--sidebar-accent);
  }

  .campaigns-detail__participant-info {
    flex: 1;
    min-width: 0;
  }

  .campaigns-detail__participant-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .campaigns-detail__participant-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .campaigns-detail__verified-icon {
    width: 14px;
    height: 14px;
    color: #3b82f6;
  }

  .campaigns-detail__participant-level {
    font-size: 0.625rem;
    font-weight: 500;
    padding: 0.125rem 0.375rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 3px;
    color: var(--sidebar-text-muted);
  }

  .campaigns-detail__participant-stats {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.25rem;
  }

  .campaigns-detail__participant-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }

  .campaigns-detail__participant-tag {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    background-color: var(--sidebar-surface);
    border-radius: 3px;
    color: var(--sidebar-text-muted);
  }

  .campaigns-detail__participant-note {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: var(--sidebar-surface);
    border-radius: 6px;
    font-size: 0.75rem;
    font-style: italic;
    color: var(--sidebar-text-muted);
  }

  .campaigns-detail__participant-meta {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.5rem;
  }

  .campaigns-detail__participant-link {
    color: var(--sidebar-accent);
    margin-left: 0.5rem;
    text-decoration: none;
  }

  .campaigns-detail__participant-link:hover {
    text-decoration: underline;
  }

  .campaigns-detail__participant-actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .campaigns-detail__participant-status,
  .campaigns-detail__submission-status {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text-muted);
  }

  .campaigns-detail__participant-status--approved,
  .campaigns-detail__submission-status--verified,
  .campaigns-detail__submission-status--paid {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .campaigns-detail__participant-status--pending,
  .campaigns-detail__submission-status--pending {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .campaigns-detail__participant-status--rejected,
  .campaigns-detail__submission-status--rejected {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .campaigns-detail__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-surface);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaigns-detail__action-btn--approve {
    color: #34d399;
  }

  .campaigns-detail__action-btn--approve:hover {
    background-color: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
  }

  .campaigns-detail__action-btn--reject {
    color: #f87171;
  }

  .campaigns-detail__action-btn--reject:hover {
    background-color: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .campaigns-detail__submission {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.875rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .campaigns-detail__submission-info {
    flex: 1;
    min-width: 0;
  }

  .campaigns-detail__submission-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .campaigns-detail__submission-platform {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .campaigns-detail__submission-url {
    font-size: 0.8125rem;
    color: var(--sidebar-accent);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .campaigns-detail__submission-url:hover {
    text-decoration: underline;
  }

  .campaigns-detail__submission-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.25rem;
  }

  .campaigns-detail__submission-actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .campaigns-detail__pay-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaigns-detail__pay-btn:hover {
    opacity: 0.9;
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

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

<!-- Global styles for dropdown (rendered via portal outside component scope) -->
<style>
  /* Disable trigger button animations */
  .campaigns__actions [data-state] {
    animation: none !important;
    transform: none !important;
  }

  .campaigns__dropdown {
    min-width: 140px !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    z-index: 100 !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    /* Override default slide animation with quick fade */
    animation: campaigns-dropdown-fade 100ms ease-out !important;
    transform: none !important;
  }

  @keyframes campaigns-dropdown-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Override Radix default animations */
  .campaigns__dropdown[data-state='open'] {
    animation: campaigns-dropdown-fade 100ms ease-out !important;
  }

  .campaigns__dropdown[data-state='closed'] {
    animation: none !important;
  }

  .campaigns__dropdown-item {
    display: flex !important;
    align-items: center !important;
    gap: 0.5rem !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.8125rem !important;
    color: var(--sidebar-text) !important;
    cursor: pointer !important;
  }

  .campaigns__dropdown-item:hover,
  .campaigns__dropdown-item:focus,
  .campaigns__dropdown-item[data-highlighted] {
    background-color: var(--sidebar-hover) !important;
    outline: none !important;
  }

  .campaigns__dropdown-item--danger {
    color: #f87171 !important;
  }

  .campaigns__dropdown-item--danger:hover,
  .campaigns__dropdown-item--danger:focus,
  .campaigns__dropdown-item--danger[data-highlighted] {
    background-color: rgba(239, 68, 68, 0.1) !important;
  }

  .campaigns__dropdown-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .campaigns__dropdown-sep {
    height: 1px !important;
    margin: 0.25rem 0 !important;
    background-color: var(--sidebar-border) !important;
  }
</style>

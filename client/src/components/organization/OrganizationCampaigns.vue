<template>
  <div class="campaigns">
    <!-- Page Heading -->
    <div class="campaigns__heading">
      <h1 class="campaigns__title">Clipping Campaigns</h1>
      <p class="campaigns__subtitle">Create and manage campaigns for clippers to promote your content</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="campaigns__grid">
      <div v-for="i in 6" :key="i" class="campaigns__card campaigns__card--skeleton">
        <div class="campaigns__skeleton-cover"></div>
        <div class="campaigns__card-content">
          <div class="campaigns__skeleton-info">
            <div class="campaigns__skeleton-title"></div>
            <div class="campaigns__skeleton-desc"></div>
            <div class="campaigns__skeleton-platforms"></div>
          </div>
          <div class="campaigns__skeleton-stats"></div>
          <div class="campaigns__skeleton-progress"></div>
          <div class="campaigns__skeleton-actions"></div>
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

    <!-- Campaigns Grid -->
    <div v-else class="campaigns__grid">
      <div v-for="campaign in campaigns" :key="campaign.id" class="campaigns__card">
        <!-- Cover Image -->
        <div class="campaigns__cover">
          <img v-if="campaign.cover_image_url" :src="campaign.cover_image_url" class="campaigns__cover-img" />
          <div v-else class="campaigns__cover-fallback">
            <Megaphone class="campaigns__cover-icon" />
          </div>
          <!-- Badges on Cover -->
          <div class="campaigns__cover-badges">
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
            <!-- Join Type Badge -->
            <span
              class="campaigns__join-type"
              :class="{
                'campaigns__join-type--open': campaign.join_type === 'open',
                'campaigns__join-type--application': campaign.join_type === 'application_required',
              }"
            >
              <UserCheck v-if="campaign.join_type === 'open'" class="campaigns__join-type-icon" />
              <ShieldCheck v-else class="campaigns__join-type-icon" />
              {{ campaign.join_type === 'open' ? 'Open' : 'Apply' }}
            </span>
          </div>
        </div>

        <!-- Card Content -->
        <div class="campaigns__card-content">
          <!-- Campaign Info -->
          <div class="campaigns__info">
            <h3 class="campaigns__name">{{ campaign.title }}</h3>
            <p v-if="campaign.description" class="campaigns__desc">{{ campaign.description }}</p>

            <!-- Meta Row -->
            <div v-if="campaign.starts_at || campaign.ends_at || (campaign.status === 'active' && getDaysRemaining(campaign) !== null)" class="campaigns__meta">
              <span v-if="campaign.starts_at || campaign.ends_at" class="campaigns__meta-item">
                <Calendar class="campaigns__meta-icon" />
                <template v-if="campaign.starts_at">{{ formatDate(campaign.starts_at) }}</template>
                <template v-if="campaign.starts_at && campaign.ends_at">–</template>
                <template v-if="campaign.ends_at">{{ formatDate(campaign.ends_at) }}</template>
              </span>
              <!-- Days Remaining -->
              <span
                v-if="campaign.status === 'active' && getDaysRemaining(campaign) !== null"
                class="campaigns__meta-item campaigns__meta-item--highlight"
              >
                <Clock class="campaigns__meta-icon" />
                <template v-if="getDaysRemaining(campaign)! > 0">
                  {{ getDaysRemaining(campaign) }}d left
                </template>
                <template v-else>Ending today</template>
              </span>
            </div>

            <!-- Platform Icons & Creator Avatars Row -->
            <div class="campaigns__platforms-creators">
              <!-- Platform Icons -->
              <div v-if="campaign.allowed_platforms?.length" class="campaigns__platforms">
                <span
                  v-for="platform in campaign.allowed_platforms"
                  :key="platform"
                  class="campaigns__platform-badge"
                  :class="getPlatformClass(platform)"
                  :title="getPlatformDisplayName(platform)"
                >
                  <Instagram v-if="platform === 'instagram'" class="campaigns__platform-icon" />
                  <Youtube v-else-if="platform === 'youtube'" class="campaigns__platform-icon" />
                  <svg
                    v-else-if="platform === 'tiktok'"
                    viewBox="0 0 24 24"
                    class="campaigns__platform-icon campaigns__platform-icon--tiktok"
                  >
                    <path
                      fill="currentColor"
                      d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
                    />
                  </svg>
                  <svg
                    v-else-if="isXPlatform(platform)"
                    viewBox="0 0 24 24"
                    class="campaigns__platform-icon campaigns__platform-icon--x"
                  >
                    <path
                      fill="currentColor"
                      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                    />
                  </svg>
                  <component v-else :is="getPlatformIcon(platform)" class="campaigns__platform-icon" />
                </span>
              </div>

              <!-- Creator Profiles Avatars -->
              <div v-if="campaign.creator_profiles?.length" class="campaigns__creators">
                <div
                  v-for="profile in campaign.creator_profiles.slice(0, 3)"
                  :key="profile.id"
                  class="campaigns__creator-avatar"
                  :title="profile.name"
                >
                  <img
                    v-if="profile.profile_image_url"
                    :src="profile.profile_image_url"
                    class="campaigns__creator-img"
                    @error="handleImageError"
                  />
                  <div v-else class="campaigns__creator-fallback">
                    {{ profile.name?.charAt(0) }}
                  </div>
                </div>
                <span v-if="campaign.creator_profiles.length > 3" class="campaigns__creator-more">
                  +{{ campaign.creator_profiles.length - 3 }}
                </span>
              </div>
            </div>
          </div>

          <!-- Stats Row -->
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

          <!-- Budget Progress -->
          <div class="campaigns__budget-progress">
            <div class="campaigns__budget-bar">
              <div
                class="campaigns__budget-fill"
                :style="{ width: getBudgetPercentage(campaign) + '%' }"
                :class="{
                  'campaigns__budget-fill--low': getBudgetPercentage(campaign) < 50,
                  'campaigns__budget-fill--medium': getBudgetPercentage(campaign) >= 50 && getBudgetPercentage(campaign) < 80,
                  'campaigns__budget-fill--high': getBudgetPercentage(campaign) >= 80,
                }"
              ></div>
            </div>
            <span class="campaigns__budget-text">
              ${{ formatBudget(campaign.spent || 0) }} / ${{ formatBudget(campaign.budget) }}
            </span>
          </div>

          <!-- Actions -->
          <div class="campaigns__actions">
            <button title="View" class="campaigns__action-btn" @click.stop="viewCampaign(campaign)">
              <Eye class="campaigns__action-icon" />
            </button>
            <button title="Edit" v-if="isAdmin" class="campaigns__action-btn" @click.stop="editCampaign(campaign)">
              <Pencil class="campaigns__action-icon" />
            </button>
            <DropdownMenu v-if="isAdmin">
              <DropdownMenuTrigger as-child>
                <button title="Menu" class="campaigns__action-btn" @click.stop>
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

    <!-- Create/Edit Campaign Wizard -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showCampaignDialog"
          class="campaign-wizard__overlay"
          @click.self="showCampaignDialog = false"
        >
          <Transition name="dialog" appear>
            <div class="campaign-wizard">
              <!-- Accent Bar -->
              <div class="campaign-wizard__accent"></div>

              <!-- Progress Indicator (only for wizard) -->
              <div v-if="!editingCampaign" class="campaign-wizard__progress">
                <div
                  v-for="step in totalSteps"
                  :key="step"
                  class="campaign-wizard__progress-dot"
                  :class="{ 'campaign-wizard__progress-dot--active': step <= currentStep }"
                />
              </div>

              <!-- Close Button -->
              <button
                class="campaign-wizard__close"
                @click="showCampaignDialog = false"
                :disabled="saving"
                title="Close"
              >
                <X :size="18" />
              </button>

              <!-- Content Container: Wizard Mode -->
              <div v-if="!editingCampaign" class="campaign-wizard__content">
                <!-- Step 1: Basic Info -->
                <div v-if="currentStep === 1" class="campaign-wizard__step">
                  <div class="campaign-wizard__header">
                    <div class="campaign-wizard__icon">
                      <Megaphone :size="28" />
                    </div>
                    <h2 class="campaign-wizard__title">Let's name your campaign</h2>
                    <p class="campaign-wizard__subtitle">Give your campaign a title and description</p>
                  </div>

                  <div class="campaign-wizard__fields">
                    <div class="campaign-wizard__field">
                      <label class="campaign-wizard__label">Campaign Title</label>
                      <input
                        v-model="campaignForm.title"
                        type="text"
                        class="campaign-wizard__input"
                        placeholder="Enter campaign title"
                        @keydown.enter="nextStep"
                      />
                    </div>

                    <div class="campaign-wizard__field">
                      <label class="campaign-wizard__label">
                        Description
                        <span class="campaign-wizard__optional">(optional)</span>
                      </label>
                      <textarea
                        v-model="campaignForm.description"
                        rows="3"
                        class="campaign-wizard__textarea"
                        placeholder="Describe your campaign..."
                      ></textarea>
                      <p class="campaign-wizard__hint">{{ (campaignForm.description || '').length }}/500 characters</p>
                    </div>
                  </div>
                </div>

                <!-- Step 2: Pricing & Budget -->
                <div v-if="currentStep === 2" class="campaign-wizard__step">
                  <div class="campaign-wizard__header">
                    <div class="campaign-wizard__icon">
                      <DollarSign :size="28" />
                    </div>
                    <h2 class="campaign-wizard__title">Set your pricing</h2>
                    <p class="campaign-wizard__subtitle">Configure payment model and budget</p>
                  </div>

                  <div class="campaign-wizard__fields">
                    <!-- Payment Model Toggle -->
                    <div class="campaign-wizard__field">
                      <label class="campaign-wizard__label">Payment Model</label>
                      <div class="campaign-wizard__toggle-container">
                        <span :class="{ 'campaign-wizard__toggle-label--active': campaignForm.payment_model === 'cpm' }">CPM (Cost Per Mille)</span>
                        <label class="campaign-wizard__toggle-switch">
                          <input type="checkbox" :checked="campaignForm.payment_model === 'per_clip'" @change="togglePaymentModel" />
                          <span class="campaign-wizard__toggle-slider"></span>
                        </label>
                        <span :class="{ 'campaign-wizard__toggle-label--active': campaignForm.payment_model === 'per_clip' }">Pay Per Clip</span>
                      </div>
                    </div>

                    <!-- CPM Fields -->
                    <template v-if="campaignForm.payment_model === 'cpm'">
                      <div class="campaign-wizard__row">
                        <div class="campaign-wizard__field">
                          <label class="campaign-wizard__label">CPM Price ($)</label>
                          <input
                            v-model.number="campaignForm.cpm"
                            type="number"
                            step="0.01"
                            min="0"
                            class="campaign-wizard__input"
                            placeholder="0.00"
                          />
                        </div>
                        <div class="campaign-wizard__field">
                          <label class="campaign-wizard__label">Per Views</label>
                          <CustomDropdown
                            v-model="campaignForm.cpm_views"
                            :options="cpmViewsOptions"
                            placeholder="Select views"
                            class="campaign-wizard__dropdown"
                            trigger-class="campaign-wizard__dropdown-trigger"
                          />
                        </div>
                      </div>
                      <p class="campaign-wizard__hint">
                        ${{ campaignForm.cpm }} per {{ formatViews(campaignForm.cpm_views) }} views
                      </p>
                    </template>

                    <!-- Pay Per Clip Fields -->
                    <template v-else>
                      <div class="campaign-wizard__row">
                        <div class="campaign-wizard__field">
                          <label class="campaign-wizard__label">Amount Per Clip ($)</label>
                          <input
                            v-model.number="campaignForm.per_clip_amount"
                            type="number"
                            step="0.01"
                            min="0"
                            class="campaign-wizard__input"
                            placeholder="0.00"
                          />
                        </div>
                        <div class="campaign-wizard__field">
                          <label class="campaign-wizard__label">Clips Per Profile</label>
                          <input
                            v-model.number="campaignForm.clips_per_profile"
                            type="number"
                            min="1"
                            class="campaign-wizard__input"
                            placeholder="5"
                          />
                        </div>
                      </div>
                      <div class="campaign-wizard__field">
                        <label class="campaign-wizard__label">Min Views for Payment</label>
                        <input
                          v-model.number="campaignForm.min_views_for_payment"
                          type="number"
                          min="0"
                          class="campaign-wizard__input"
                          placeholder="1000"
                        />
                      </div>
                    </template>

                    <!-- Budget (always shown) -->
                    <div class="campaign-wizard__field">
                      <label class="campaign-wizard__label">Budget ($)</label>
                      <input
                        v-model.number="campaignForm.budget"
                        type="number"
                        step="1"
                        min="0"
                        class="campaign-wizard__input"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <!-- Step 3: Schedule & Access -->
                <div v-if="currentStep === 3" class="campaign-wizard__step">
                  <div class="campaign-wizard__header">
                    <div class="campaign-wizard__icon">
                      <Calendar :size="28" />
                    </div>
                    <h2 class="campaign-wizard__title">When will this run?</h2>
                    <p class="campaign-wizard__subtitle">Set campaign duration and access type</p>
                  </div>

                  <div class="campaign-wizard__fields">
                    <div class="campaign-wizard__field">
                      <label class="campaign-wizard__label">Join Type</label>
                      <CustomDropdown
                        v-model="campaignForm.join_type"
                        :options="joinTypeOptions"
                        placeholder="Select join type"
                        class="campaign-wizard__dropdown"
                        trigger-class="campaign-wizard__dropdown-trigger"
                      />
                      <p class="campaign-wizard__hint">
                        Open: Anyone can join. Application Required: You approve each clipper.
                      </p>
                    </div>

                    <div class="campaign-wizard__row">
                      <div class="campaign-wizard__field">
                        <label class="campaign-wizard__label">
                          Start Date
                          <span class="campaign-wizard__optional">(optional)</span>
                        </label>
                        <input v-model="campaignForm.starts_at" type="datetime-local" class="campaign-wizard__input" />
                      </div>
                      <div class="campaign-wizard__field">
                        <label class="campaign-wizard__label">
                          End Date
                          <span class="campaign-wizard__optional">(optional)</span>
                        </label>
                        <input v-model="campaignForm.ends_at" type="datetime-local" class="campaign-wizard__input" />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Step 4: Platforms & Payments -->
                <div v-if="currentStep === 4" class="campaign-wizard__step">
                  <div class="campaign-wizard__header">
                    <div class="campaign-wizard__icon">
                      <Globe :size="28" />
                    </div>
                    <h2 class="campaign-wizard__title">Where can clippers post?</h2>
                    <p class="campaign-wizard__subtitle">Select platforms and payment methods</p>
                  </div>

                  <div class="campaign-wizard__fields">
                    <div class="campaign-wizard__field">
                      <label class="campaign-wizard__label">Allowed Platforms</label>
                      <div class="campaign-wizard__tags">
                        <button
                          v-for="platform in availablePlatforms"
                          :key="platform.value"
                          type="button"
                          @click="togglePlatform(platform.value)"
                          class="campaign-wizard__tag"
                          :class="{
                            'campaign-wizard__tag--selected': campaignForm.allowed_platforms.includes(platform.value),
                          }"
                        >
                          {{ platform.label }}
                        </button>
                      </div>
                      <p class="campaign-wizard__hint">
                        {{ campaignForm.allowed_platforms.length }} platform(s) selected
                      </p>
                    </div>

                    <div class="campaign-wizard__field">
                      <label class="campaign-wizard__label">Payment Methods</label>
                      <div class="campaign-wizard__tags">
                        <button
                          v-for="method in availablePaymentMethods"
                          :key="method.value"
                          type="button"
                          @click="togglePaymentMethod(method.value)"
                          class="campaign-wizard__tag"
                          :class="{
                            'campaign-wizard__tag--selected': campaignForm.payment_methods.includes(method.value),
                          }"
                        >
                          {{ method.label }}
                        </button>
                      </div>
                      <p class="campaign-wizard__hint">
                        {{ campaignForm.payment_methods.length }} method(s) selected
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Step 5: Creator Profiles -->
                <div v-if="currentStep === 5" class="campaign-wizard__step">
                  <div class="campaign-wizard__header">
                    <div class="campaign-wizard__icon">
                      <Users :size="28" />
                    </div>
                    <h2 class="campaign-wizard__title">Select creator profiles</h2>
                    <p class="campaign-wizard__subtitle">Choose which creator profiles clippers can use</p>
                  </div>

                  <div class="campaign-wizard__fields">
                    <div v-if="loadingProfiles" class="campaign-wizard__loading">
                      <Loader2 class="campaign-wizard__spinner" />
                    </div>
                    <div v-else-if="availableCreatorProfiles.length === 0" class="campaign-wizard__empty">
                      <p>No creator profiles available. Create profiles in the Creator Profiles tab first.</p>
                    </div>
                    <div v-else class="campaign-wizard__profiles-list">
                      <button
                        v-for="profile in availableCreatorProfiles"
                        :key="profile.id"
                        type="button"
                        @click="toggleCreatorProfile(profile.id)"
                        class="campaign-wizard__profile"
                        :class="{
                          'campaign-wizard__profile--selected': selectedCreatorProfileIds.includes(profile.id),
                        }"
                      >
                        <div class="campaign-wizard__profile-avatar">
                          <img v-if="profile.profile_image_url" :src="profile.profile_image_url" />
                          <User v-else class="campaign-wizard__profile-avatar-icon" />
                        </div>
                        <div class="campaign-wizard__profile-info">
                          <span class="campaign-wizard__profile-name">{{ profile.name }}</span>
                          <span v-if="profile.description" class="campaign-wizard__profile-desc">
                            {{ profile.description }}
                          </span>
                        </div>
                        <div
                          v-if="selectedCreatorProfileIds.includes(profile.id)"
                          class="campaign-wizard__profile-check"
                        >
                          <Check class="campaign-wizard__profile-check-icon" />
                        </div>
                      </button>
                    </div>
                    <p class="campaign-wizard__hint">
                      {{ selectedCreatorProfileIds.length }} profile(s) selected. Each profile includes their
                      watermarks, intro/outro videos.
                    </p>
                  </div>
                </div>

                <!-- Step 6: Campaign Assets -->
                <div v-if="currentStep === 6" class="campaign-wizard__step">
                  <div class="campaign-wizard__header">
                    <div class="campaign-wizard__icon">
                      <Film :size="28" />
                    </div>
                    <h2 class="campaign-wizard__title">Creator & Branding</h2>
                    <p class="campaign-wizard__subtitle">Select creator profile and optional branding</p>
                  </div>

                  <div class="campaign-wizard__fields">
                    <!-- Creator Profile -->
                    <div class="campaign-wizard__field">
                      <label class="campaign-wizard__label">Creator Profile</label>
                      <CustomDropdown
                        v-model="campaignForm.creator_profile_id"
                        :options="creatorProfileOptions"
                        placeholder="Select creator profile"
                        class="campaign-wizard__dropdown"
                        trigger-class="campaign-wizard__dropdown-trigger"
                      />
                      <p class="campaign-wizard__hint">
                        Select which creator profile to use for this campaign
                      </p>
                    </div>

                    <!-- Branding Profile -->
                    <div class="campaign-wizard__field">
                      <label class="campaign-wizard__label">Branding Profile (Optional)</label>
                      <CustomDropdown
                        v-model="campaignForm.branding_profile_id"
                        :options="brandingProfileOptions"
                        placeholder="Select branding profile (optional)"
                        class="campaign-wizard__dropdown"
                        trigger-class="campaign-wizard__dropdown-trigger"
                      />
                      <p class="campaign-wizard__hint">
                        Select a creator profile to use for global branding (intro, outro, watermarks)
                      </p>
                    </div>

                    <!-- Cover Image -->
                    <div class="campaign-wizard__field">
                      <label class="campaign-wizard__label">Cover Image</label>

                      <!-- Image Preview -->
                      <div
                        v-if="campaignForm.cover_image_url || coverImagePreview"
                        class="campaign-wizard__cover-preview"
                      >
                        <img :src="coverImagePreview || campaignForm.cover_image_url" @error="handleImageError" />
                        <button type="button" @click="clearCoverImage" class="campaign-wizard__cover-remove">
                          <X class="campaign-wizard__cover-remove-icon" />
                        </button>
                      </div>

                      <!-- Upload/URL Options -->
                      <div class="campaign-wizard__upload-row">
                        <button
                          type="button"
                          @click="triggerCoverImageUpload"
                          :disabled="uploadingCoverImage"
                          class="campaign-wizard__upload-btn"
                        >
                          <Loader2 v-if="uploadingCoverImage" class="campaign-wizard__spinner" />
                          <Upload v-else class="campaign-wizard__upload-icon" />
                          {{ uploadingCoverImage ? 'Uploading...' : 'Upload' }}
                        </button>
                        <input
                          ref="coverImageInput"
                          type="file"
                          accept="image/*"
                          class="campaign-wizard__file-input"
                          @change="handleCoverImageSelect"
                        />
                        <span class="campaign-wizard__upload-or">or</span>
                        <input
                          v-model="campaignForm.cover_image_url"
                          type="text"
                          placeholder="Paste image URL..."
                          class="campaign-wizard__input campaign-wizard__input--url"
                          @input="coverImagePreview = ''"
                        />
                      </div>
                      <p class="campaign-wizard__hint">Recommended size: 1200x630px</p>
                    </div>
                  </div>
                </div>

                <!-- Step 7: Review & Create -->
                <div v-if="currentStep === 7" class="campaign-wizard__step">
                  <div class="campaign-wizard__header">
                    <div class="campaign-wizard__icon campaign-wizard__icon--success">
                      <Check :size="28" />
                    </div>
                    <h2 class="campaign-wizard__title">Review your campaign</h2>
                    <p class="campaign-wizard__subtitle">Make sure everything looks good</p>
                  </div>

                  <div class="campaign-wizard__fields">
                    <!-- Summary Card -->
                    <div class="campaign-wizard__summary">
                      <div class="campaign-wizard__summary-header">
                        <div class="campaign-wizard__summary-icon">
                          <Megaphone :size="20" />
                        </div>
                        <div class="campaign-wizard__summary-info">
                          <h3 class="campaign-wizard__summary-name">{{ campaignForm.title || 'Untitled Campaign' }}</h3>
                          <p v-if="campaignForm.description" class="campaign-wizard__summary-desc">
                            {{ campaignForm.description }}
                          </p>
                        </div>
                      </div>

                      <div class="campaign-wizard__summary-grid">
                        <div class="campaign-wizard__summary-section">
                          <div class="campaign-wizard__summary-label">
                            <DollarSign :size="14" />
                            Pricing
                          </div>
                          <div class="campaign-wizard__summary-value">
                            ${{ formatCpm(campaignForm.cpm) }} per {{ formatViews(campaignForm.cpm_views) }} views
                          </div>
                          <div class="campaign-wizard__summary-value">
                            Budget: ${{ formatBudget(campaignForm.budget) }}
                          </div>
                        </div>

                        <div v-if="campaignForm.starts_at || campaignForm.ends_at" class="campaign-wizard__summary-section">
                          <div class="campaign-wizard__summary-label">
                            <Calendar :size="14" />
                            Duration
                          </div>
                          <div v-if="campaignForm.starts_at" class="campaign-wizard__summary-value">
                            Start: {{ formatDate(campaignForm.starts_at) }}
                          </div>
                          <div v-if="campaignForm.ends_at" class="campaign-wizard__summary-value">
                            End: {{ formatDate(campaignForm.ends_at) }}
                          </div>
                        </div>

                        <div v-if="campaignForm.allowed_platforms.length" class="campaign-wizard__summary-section">
                          <div class="campaign-wizard__summary-label">
                            <Globe :size="14" />
                            Platforms
                          </div>
                          <div class="campaign-wizard__summary-tags">
                            <span
                              v-for="platform in campaignForm.allowed_platforms"
                              :key="platform"
                              class="campaign-wizard__summary-tag"
                            >
                              {{ getPlatformDisplayName(platform) }}
                            </span>
                          </div>
                        </div>

                        <div v-if="selectedCreatorProfileIds.length" class="campaign-wizard__summary-section">
                          <div class="campaign-wizard__summary-label">
                            <Users :size="14" />
                            Creator Profiles
                          </div>
                          <div class="campaign-wizard__summary-value">
                            {{ selectedCreatorProfileIds.length }} profile(s) selected
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Error Display -->
                <div v-if="error" class="campaign-wizard__alert campaign-wizard__alert--error">
                  <AlertTriangle :size="16" />
                  <p class="campaign-wizard__alert-text">{{ error }}</p>
                </div>
              </div>

              <!-- Footer with Navigation (Wizard Mode Only) -->
              <div v-if="!editingCampaign" class="campaign-wizard__footer">
                <div class="campaign-wizard__footer-buttons">
                  <button
                    v-if="currentStep > 1"
                    @click="prevStep"
                    :disabled="saving"
                    class="campaign-wizard__btn campaign-wizard__btn--secondary"
                  >
                    Back
                  </button>

                  <button
                    v-if="currentStep < totalSteps"
                    @click="nextStep"
                    :disabled="!canProceed || saving"
                    class="campaign-wizard__btn campaign-wizard__btn--primary"
                    :class="{ 'campaign-wizard__btn--full': currentStep === 1 }"
                  >
                    Continue
                  </button>

                  <button
                    v-if="currentStep === totalSteps"
                    @click="saveCampaign"
                    :disabled="!canProceed || saving"
                    class="campaign-wizard__btn campaign-wizard__btn--primary"
                  >
                    <Loader2 v-if="saving" class="campaign-wizard__btn-spinner" />
                    {{ saving ? 'Creating...' : editingCampaign ? 'Save Changes' : 'Create Campaign' }}
                  </button>
                </div>

                <!-- Skip Link for Optional Steps -->
                <button
                  v-if="currentStep >= 2 && currentStep <= 6"
                  @click="nextStep"
                  class="campaign-wizard__skip"
                >
                  Skip for now
                </button>
              </div>

              <!-- Content Container: Edit Mode -->
              <div v-if="editingCampaign" class="campaign-edit__content">
                <div class="campaign-edit__header">
                  <h2 class="campaign-edit__title">Edit Campaign</h2>
                  <p class="campaign-edit__subtitle">Update your campaign details</p>
                </div>

                <div class="campaign-edit__form">
                  <!-- Basic Information Section -->
                  <div class="campaign-edit__section">
                    <h3 class="campaign-edit__section-title">Basic Information</h3>
                    <div class="campaign-edit__fields">
                      <div class="campaign-edit__field">
                        <label class="campaign-edit__label">Campaign Title</label>
                        <input
                          v-model="campaignForm.title"
                          type="text"
                          class="campaign-edit__input"
                          placeholder="Enter campaign title"
                        />
                      </div>

                      <div class="campaign-edit__field">
                        <label class="campaign-edit__label">Description</label>
                        <textarea
                          v-model="campaignForm.description"
                          rows="3"
                          class="campaign-edit__textarea"
                          placeholder="Describe your campaign..."
                        ></textarea>
                        <p class="campaign-edit__hint">{{ (campaignForm.description || '').length }}/500 characters</p>
                      </div>

                      <!-- Cover Image -->
                      <div class="campaign-edit__field">
                        <label class="campaign-edit__label">Cover Image</label>

                        <!-- Image Preview -->
                        <div
                          v-if="campaignForm.cover_image_url || coverImagePreview"
                          class="campaign-edit__cover-preview"
                        >
                          <img :src="coverImagePreview || campaignForm.cover_image_url" @error="handleImageError" />
                          <button type="button" @click="clearCoverImage" class="campaign-edit__cover-remove">
                            <X class="campaign-edit__cover-remove-icon" />
                          </button>
                        </div>

                        <!-- Upload/URL Options -->
                        <div class="campaign-edit__upload-row">
                          <button
                            type="button"
                            @click="triggerCoverImageUpload"
                            :disabled="uploadingCoverImage"
                            class="campaign-edit__upload-btn"
                          >
                            <Loader2 v-if="uploadingCoverImage" class="campaign-edit__spinner" />
                            <Upload v-else class="campaign-edit__upload-icon" />
                            {{ uploadingCoverImage ? 'Uploading...' : 'Upload' }}
                          </button>
                          <input
                            ref="coverImageInput"
                            type="file"
                            accept="image/*"
                            class="campaign-edit__file-input"
                            @change="handleCoverImageSelect"
                          />
                          <span class="campaign-edit__upload-or">or</span>
                          <input
                            v-model="campaignForm.cover_image_url"
                            type="text"
                            placeholder="Paste image URL..."
                            class="campaign-edit__input campaign-edit__input--url"
                            @input="coverImagePreview = ''"
                          />
                        </div>
                        <p class="campaign-edit__hint">Recommended size: 1200x630px</p>
                      </div>
                    </div>
                  </div>

                  <!-- Pricing & Budget Section -->
                  <div class="campaign-edit__section">
                    <h3 class="campaign-edit__section-title">Pricing & Budget</h3>
                    <div class="campaign-edit__fields">
                      <!-- Payment Model Toggle -->
                      <div class="campaign-edit__field">
                        <div class="campaign-edit__toggle-container">
                          <span class="campaign-edit__toggle-label" :class="{ 'campaign-edit__toggle-label--active': campaignForm.payment_model === 'cpm' }">
                            CPM (Cost Per Mille)
                          </span>
                          <label class="campaign-edit__toggle-switch">
                            <input
                              type="checkbox"
                              :checked="campaignForm.payment_model === 'per_clip'"
                              @change="campaignForm.payment_model = campaignForm.payment_model === 'cpm' ? 'per_clip' : 'cpm'"
                            />
                            <span class="campaign-edit__toggle-slider"></span>
                          </label>
                          <span class="campaign-edit__toggle-label" :class="{ 'campaign-edit__toggle-label--active': campaignForm.payment_model === 'per_clip' }">
                            Pay Per Clip
                          </span>
                        </div>
                      </div>

                      <!-- CPM Fields -->
                      <template v-if="campaignForm.payment_model === 'cpm'">
                        <div class="campaign-edit__row">
                          <div class="campaign-edit__field">
                            <label class="campaign-edit__label">CPM Price ($)</label>
                            <input
                              v-model.number="campaignForm.cpm"
                              type="number"
                              step="0.01"
                              min="0"
                              class="campaign-edit__input"
                              placeholder="0.00"
                            />
                          </div>
                          <div class="campaign-edit__field">
                            <label class="campaign-edit__label">Per Views</label>
                            <CustomDropdown
                              v-model="campaignForm.cpm_views"
                              :options="cpmViewsOptions"
                              placeholder="Select views"
                              class="campaign-edit__dropdown"
                              trigger-class="campaign-edit__dropdown-trigger"
                            />
                          </div>
                        </div>
                        <p class="campaign-edit__hint">
                          ${{ campaignForm.cpm }} per {{ formatViews(campaignForm.cpm_views) }} views
                        </p>

                        <div class="campaign-edit__row">
                          <div class="campaign-edit__field">
                            <label class="campaign-edit__label">Budget ($)</label>
                            <input
                              v-model.number="campaignForm.budget"
                              type="number"
                              step="1"
                              min="0"
                              class="campaign-edit__input"
                              placeholder="0"
                            />
                          </div>
                          <div class="campaign-edit__field">
                            <label class="campaign-edit__label">Min Views for Payment</label>
                            <input
                              v-model.number="campaignForm.min_views_for_payment"
                              type="number"
                              step="100"
                              min="0"
                              class="campaign-edit__input"
                              placeholder="1000"
                            />
                          </div>
                        </div>
                      </template>

                      <!-- Pay Per Clip Fields -->
                      <template v-if="campaignForm.payment_model === 'per_clip'">
                        <div class="campaign-edit__row">
                          <div class="campaign-edit__field">
                            <label class="campaign-edit__label">Amount Per Clip ($)</label>
                            <input
                              v-model.number="campaignForm.per_clip_amount"
                              type="number"
                              step="0.01"
                              min="0"
                              class="campaign-edit__input"
                              placeholder="0.00"
                            />
                          </div>
                          <div class="campaign-edit__field">
                            <label class="campaign-edit__label">Total Clips Per Profile</label>
                            <input
                              v-model.number="campaignForm.clips_per_profile"
                              type="number"
                              step="1"
                              min="1"
                              class="campaign-edit__input"
                              placeholder="5"
                            />
                          </div>
                        </div>
                        <p class="campaign-edit__hint">
                          ${{ campaignForm.per_clip_amount }} per clip, max {{ campaignForm.clips_per_profile }} clips per profile
                        </p>

                        <div class="campaign-edit__row">
                          <div class="campaign-edit__field">
                            <label class="campaign-edit__label">Budget ($)</label>
                            <input
                              v-model.number="campaignForm.budget"
                              type="number"
                              step="1"
                              min="0"
                              class="campaign-edit__input"
                              placeholder="0"
                            />
                          </div>
                          <div class="campaign-edit__field">
                            <label class="campaign-edit__label">Min Views for Payment</label>
                            <input
                              v-model.number="campaignForm.min_views_for_payment"
                              type="number"
                              step="100"
                              min="0"
                              class="campaign-edit__input"
                              placeholder="1000"
                            />
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>

                  <!-- Platforms & Payment Section -->
                  <div class="campaign-edit__section">
                    <h3 class="campaign-edit__section-title">Platforms & Payment Methods</h3>
                    <div class="campaign-edit__fields">
                      <div class="campaign-edit__field">
                        <label class="campaign-edit__label">Allowed Platforms</label>
                        <div class="campaign-edit__platforms">
                          <button
                            v-for="platform in availablePlatforms"
                            :key="platform.value"
                            type="button"
                            @click="togglePlatform(platform.value)"
                            class="campaign-edit__platform-btn"
                            :class="{ 'campaign-edit__platform-btn--active': campaignForm.allowed_platforms.includes(platform.value) }"
                          >
                            {{ platform.label }}
                          </button>
                        </div>
                      </div>

                      <div class="campaign-edit__field">
                        <label class="campaign-edit__label">Payment Methods</label>
                        <div class="campaign-edit__payment-methods">
                          <button
                            v-for="method in availablePaymentMethods"
                            :key="method.value"
                            type="button"
                            @click="togglePaymentMethod(method.value)"
                            class="campaign-edit__payment-btn"
                            :class="{ 'campaign-edit__payment-btn--active': campaignForm.payment_methods.includes(method.value) }"
                          >
                            {{ method.label }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Campaign Duration Section -->
                  <div class="campaign-edit__section">
                    <h3 class="campaign-edit__section-title">Campaign Duration</h3>
                    <div class="campaign-edit__fields">
                      <div class="campaign-edit__field">
                        <label class="campaign-edit__label">Join Type</label>
                        <CustomDropdown
                          v-model="campaignForm.join_type"
                          :options="joinTypeOptions"
                          placeholder="Select join type"
                          class="campaign-edit__dropdown"
                          trigger-class="campaign-edit__dropdown-trigger"
                        />
                      </div>

                      <div class="campaign-edit__row">
                        <div class="campaign-edit__field">
                          <label class="campaign-edit__label">Start Date (optional)</label>
                          <input
                            v-model="campaignForm.starts_at"
                            type="datetime-local"
                            class="campaign-edit__input"
                          />
                        </div>
                        <div class="campaign-edit__field">
                          <label class="campaign-edit__label">End Date (optional)</label>
                          <input
                            v-model="campaignForm.ends_at"
                            type="datetime-local"
                            class="campaign-edit__input"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Creator Profiles Section -->
                  <div class="campaign-edit__section">
                    <h3 class="campaign-edit__section-title">Creators</h3>
                    <div class="campaign-edit__fields">
                      <div class="campaign-edit__field">
                        <label class="campaign-edit__label">Creator Profile</label>
                        <CustomDropdown
                          v-model="campaignForm.creator_profile_id"
                          :options="creatorProfileOptions"
                          placeholder="Select creator profile"
                          class="campaign-edit__dropdown"
                          trigger-class="campaign-edit__dropdown-trigger"
                        />
                        <p class="campaign-edit__hint">
                          Select which creator profile to use for this campaign
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Global Branding Section -->
                  <div class="campaign-edit__section">
                    <h3 class="campaign-edit__section-title">Global Branding</h3>
                    <div class="campaign-edit__fields">
                      <div class="campaign-edit__field">
                        <label class="campaign-edit__label">Branding Profile</label>
                        <CustomDropdown
                          v-model="campaignForm.branding_profile_id"
                          :options="brandingProfileOptions"
                          placeholder="Select branding profile (optional)"
                          class="campaign-edit__dropdown"
                          trigger-class="campaign-edit__dropdown-trigger"
                        />
                        <p class="campaign-edit__hint">
                          Select a creator profile to use for global branding (intro, outro, watermarks)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Edit Form Actions -->
                <div class="campaign-edit__actions">
                  <button
                    type="button"
                    @click="showCampaignDialog = false"
                    :disabled="saving"
                    class="campaign-edit__btn campaign-edit__btn--secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="saveCampaign"
                    :disabled="!canProceedEdit || saving"
                    class="campaign-edit__btn campaign-edit__btn--primary"
                  >
                    <Loader2 v-if="saving" class="campaign-edit__btn-spinner" />
                    {{ saving ? 'Saving...' : 'Save Changes' }}
                  </button>
                </div>
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
                <button
                  class="campaigns-detail__tab"
                  :class="{ 'campaigns-detail__tab--active': detailTab === 'payments' }"
                  @click="detailTab = 'payments'; loadPayments();"
                >
                  Payments
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
                          <div
                            class="campaigns-detail__submission-platform-badge"
                            :class="{
                              'campaigns-detail__submission-platform-badge--x': isXPlatform(submission.platform),
                              'campaigns-detail__submission-platform-badge--instagram': submission.platform === 'instagram',
                              'campaigns-detail__submission-platform-badge--tiktok': submission.platform === 'tiktok',
                              'campaigns-detail__submission-platform-badge--youtube': submission.platform === 'youtube',
                            }"
                          >
                            <span v-if="isXPlatform(submission.platform)" class="campaigns-detail__x-icon">𝕏</span>
                            <component
                              v-else
                              :is="getPlatformIcon(submission.platform)"
                              class="campaigns-detail__submission-platform-icon"
                            />
                          </div>
                          <a :href="submission.clip_url" target="_blank" class="campaigns-detail__submission-url">
                            <span class="campaigns-detail__submission-username">
                              @{{ extractUsername(submission.clip_url) }}
                            </span>
                            <ExternalLink :size="12" class="campaigns-detail__submission-external" />
                          </a>
                        </div>
                        <div class="campaigns-detail__submission-meta">
                          by {{ submission.user?.display_name || submission.user?.email }} ·
                          {{ submission.view_count.toLocaleString() }} views
                          <span v-if="submission.views_last_updated_at" class="campaigns-detail__submission-synced">
                            (synced {{ formatRelativeTime(submission.views_last_updated_at) }})
                          </span>
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
                          v-if="isAdmin && (submission.status === 'verified' || submission.status === 'paid')"
                          class="campaigns-detail__action-btn campaigns-detail__action-btn--secondary"
                          @click="openUpdateViewsDialog(submission)"
                          title="Update view count"
                        >
                          <Eye :size="14" />
                        </button>
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

                <!-- Payments Tab -->
                <div v-else-if="detailTab === 'payments'" class="campaigns-detail__content">
                  <div class="campaigns-detail__payments-header">
                    <button
                      v-if="isAdmin"
                      class="campaigns-detail__calculate-btn"
                      @click="calculatePaymentsAction"
                      :disabled="calculatingPayments"
                    >
                      <Loader2 v-if="calculatingPayments" :size="16" class="spin" />
                      <Calculator v-else :size="16" />
                      Calculate Payments
                    </button>
                  </div>

                  <div v-if="loadingPayments" class="campaigns-detail__loading">
                    <Loader2 class="campaigns-dialog__spinner" />
                  </div>
                  <div v-else-if="payments.length === 0" class="campaigns-detail__empty">
                    No payments yet. Calculate payments for verified submissions.
                  </div>
                  <div v-else class="campaigns-detail__list">
                    <div v-for="payment in payments" :key="payment.id" class="campaigns-detail__payment">
                      <div class="campaigns-detail__payment-info">
                        <div class="campaigns-detail__payment-header">
                          <span class="campaigns-detail__payment-user">
                            {{ payment.user?.display_name || payment.user?.email }}
                          </span>
                          <span class="campaigns-detail__payment-amount">${{ payment.amount }}</span>
                        </div>
                        <div class="campaigns-detail__payment-meta">
                          {{ payment.views_at_payment?.toLocaleString() || 0 }} views ·
                          {{ formatRelativeTime(payment.inserted_at) }}
                        </div>
                        <div v-if="payment.verification_notes" class="campaigns-detail__payment-notes">
                          {{ payment.verification_notes }}
                        </div>
                      </div>
                      <div class="campaigns-detail__payment-actions">
                        <span
                          class="campaigns-detail__payment-status"
                          :class="`campaigns-detail__payment-status--${payment.status}`"
                        >
                          {{ payment.status }}
                        </span>
                        <button
                          v-if="isAdmin && payment.status === 'pending'"
                          class="campaigns-detail__verify-btn"
                          @click="openVerifyPaymentDialog(payment)"
                        >
                          <CheckCircle :size="14" />
                          Submit Proof
                        </button>
                        <button
                          v-if="payment.verification_screenshot_url"
                          class="campaigns-detail__action-btn campaigns-detail__action-btn--secondary"
                          @click="viewScreenshot(payment.verification_screenshot_url)"
                          title="View proof"
                        >
                          <Image :size="14" />
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

    <!-- Update Views Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showUpdateViewsDialog"
          class="campaigns-dialog__overlay"
          @click.self="showUpdateViewsDialog = false"
          @keydown.esc="showUpdateViewsDialog = false"
        >
          <Transition name="dialog" appear>
            <div
              v-if="showUpdateViewsDialog"
              class="campaigns-dialog campaigns-dialog--small"
              role="dialog"
              aria-modal="true"
            >
              <div class="campaigns-dialog__accent campaigns-dialog__accent--blue"></div>

              <!-- Header -->
              <div class="campaigns-dialog__header">
                <button
                  class="campaigns-dialog__close"
                  @click="showUpdateViewsDialog = false"
                  :disabled="updatingViews"
                >
                  <X :size="18" />
                </button>
                <div class="campaigns-dialog__icon campaigns-dialog__icon--blue">
                  <Eye :size="24" />
                </div>
                <h2 class="campaigns-dialog__title">Update View Count</h2>
                <p class="campaigns-dialog__subtitle">Manually update views for this submission</p>
              </div>

              <!-- Content -->
              <div class="campaigns-dialog__content">
                <div class="campaigns-dialog__field">
                  <label class="campaigns-dialog__label">View Count</label>
                  <input
                    v-model.number="updateViewsCount"
                    type="number"
                    min="0"
                    class="campaigns-dialog__input"
                    placeholder="Enter view count"
                  />
                  <p v-if="viewsSubmission?.views_last_updated_at" class="campaigns-dialog__hint">
                    Last synced: {{ formatDate(viewsSubmission.views_last_updated_at) }}
                  </p>
                  <p v-else class="campaigns-dialog__hint">
                    Current: {{ viewsSubmission?.view_count.toLocaleString() }} views
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div class="campaigns-dialog__footer">
                <button
                  class="campaigns-dialog__btn campaigns-dialog__btn--secondary"
                  @click="showUpdateViewsDialog = false"
                  :disabled="updatingViews"
                >
                  Cancel
                </button>
                <button
                  class="campaigns-dialog__btn campaigns-dialog__btn--primary"
                  @click="updateViewsAction"
                  :disabled="updatingViews || updateViewsCount < 0"
                >
                  <Loader2 v-if="updatingViews" class="campaigns-dialog__btn-spinner" />
                  {{ updatingViews ? 'Updating...' : 'Update Views' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Verify Payment Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showVerifyPaymentDialog"
          class="campaigns-dialog__overlay"
          @click.self="showVerifyPaymentDialog = false"
          @keydown.esc="showVerifyPaymentDialog = false"
        >
          <Transition name="dialog" appear>
            <div
              v-if="showVerifyPaymentDialog"
              class="campaigns-dialog campaigns-dialog--medium"
              role="dialog"
              aria-modal="true"
            >
              <div class="campaigns-dialog__accent campaigns-dialog__accent--green"></div>

              <!-- Header -->
              <div class="campaigns-dialog__header">
                <button
                  class="campaigns-dialog__close"
                  @click="showVerifyPaymentDialog = false"
                  :disabled="verifyingPayment"
                >
                  <X :size="18" />
                </button>
                <div class="campaigns-dialog__icon campaigns-dialog__icon--green">
                  <CheckCircle :size="24" />
                </div>
                <h2 class="campaigns-dialog__title">Verify Payment</h2>
                <p class="campaigns-dialog__subtitle">
                  Submit proof of payment for ${{ selectedPayment?.amount }}
                </p>
              </div>

              <!-- Content -->
              <div class="campaigns-dialog__content">
                <div class="campaigns-dialog__field">
                  <label class="campaigns-dialog__label">Screenshot URL</label>
                  <input
                    v-model="verificationScreenshotUrl"
                    type="url"
                    placeholder="https://..."
                    class="campaigns-dialog__input"
                  />
                  <p class="campaigns-dialog__hint">Upload screenshot to your assets and paste URL here</p>
                </div>

                <div class="campaigns-dialog__field">
                  <label class="campaigns-dialog__label">Transaction ID / Notes *</label>
                  <textarea
                    v-model="verificationNotes"
                    placeholder="Enter transaction ID, payment method details, or other notes..."
                    class="campaigns-dialog__textarea"
                    rows="3"
                  ></textarea>
                </div>

                <div class="campaigns-dialog__field">
                  <label class="campaigns-dialog__label">Payment Date</label>
                  <input
                    v-model="verificationPaymentDate"
                    type="date"
                    class="campaigns-dialog__input"
                  />
                </div>
              </div>

              <!-- Footer -->
              <div class="campaigns-dialog__footer">
                <button
                  class="campaigns-dialog__btn campaigns-dialog__btn--secondary"
                  @click="showVerifyPaymentDialog = false"
                  :disabled="verifyingPayment"
                >
                  Cancel
                </button>
                <button
                  class="campaigns-dialog__btn campaigns-dialog__btn--success"
                  @click="verifyPaymentAction"
                  :disabled="verifyingPayment || !verificationNotes"
                >
                  <Loader2 v-if="verifyingPayment" class="campaigns-dialog__btn-spinner" />
                  {{ verifyingPayment ? 'Verifying...' : 'Submit Proof & Notify Clipper' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, watch } from 'vue';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
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
    ExternalLink,
    Film,
    Layers,
    AlertTriangle,
    Clock,
    UserCheck,
    ShieldCheck,
    Calculator,
    Image,
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
    updateSubmissionViews,
    uploadCampaignCoverImage,
    setCampaignCreatorProfiles,
    calculateCampaignPayments,
    listCampaignPayments,
    verifyPayment,
    type Campaign,
    type CampaignParticipant,
    type CampaignSubmission,
    type CampaignPayment,
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
  import CustomDropdown from '@/components/CustomDropdown.vue';

  const props = defineProps<{
    organizationId: string;
    isAdmin: boolean;
  }>();

  const { toast } = useToast();

  const loading = ref(true);
  const saving = ref(false);
  const deleting = ref(false);
  const error = ref<string | null>(null);
  const campaigns = ref<Campaign[]>([]);

  const showCampaignDialog = ref(false);
  const showDetailDialog = ref(false);
  const showDeleteDialog = ref(false);
  const showPaymentDialog = ref(false);
  const showUpdateViewsDialog = ref(false);

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

  // Payments
  const payments = ref<CampaignPayment[]>([]);
  const loadingPayments = ref(false);
  const calculatingPayments = ref(false);
  const showVerifyPaymentDialog = ref(false);
  const selectedPayment = ref<CampaignPayment | null>(null);
  const verificationScreenshotUrl = ref('');
  const verificationNotes = ref('');
  const verificationPaymentDate = ref('');
  const verifyingPayment = ref(false);

  // Update views
  const viewsSubmission = ref<CampaignSubmission | null>(null);
  const updateViewsCount = ref(0);
  const updatingViews = ref(false);

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

  // Dropdown options
  const cpmViewsOptions = [
    { label: '500 views', value: 500 },
    { label: '1,000 views', value: 1000 },
    { label: '5,000 views', value: 5000 },
    { label: '10,000 views', value: 10000 },
    { label: '100,000 views', value: 100000 },
  ];

  const joinTypeOptions = [
    { label: 'Open', value: 'open' },
    { label: 'Application Required', value: 'application_required' },
  ];

  const introOptions = computed(() => [
    { label: 'No intro', value: null },
    ...availableAssets.value
      .filter((a) => a.asset_type === 'intro')
      .map((a) => ({ label: a.name, value: a.id })),
  ]);

  const outroOptions = computed(() => [
    { label: 'No outro', value: null },
    ...availableAssets.value
      .filter((a) => a.asset_type === 'outro')
      .map((a) => ({ label: a.name, value: a.id })),
  ]);

  const creatorProfileOptions = computed(() => [
    { label: 'Select creator profile', value: null },
    ...availableCreatorProfiles.value.map((p) => ({ label: p.name, value: p.id })),
  ]);

  const brandingProfileOptions = computed(() => [
    { label: 'No branding', value: null },
    ...availableCreatorProfiles.value.map((p) => ({ label: p.name, value: p.id })),
  ]);

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
    // Payment model
    payment_model: 'cpm' as 'cpm' | 'per_clip',
    per_clip_amount: 0,
    clips_per_profile: 5,
    // Creator and branding
    creator_profile_id: null as number | null,
    branding_profile_id: null as number | null,
  });

  // Wizard state
  const currentStep = ref(1);
  const totalSteps = 7;

  // Validation for each wizard step
  const canProceed = computed(() => {
    switch (currentStep.value) {
      case 1:
        // Basic Info - require title
        return campaignForm.title && campaignForm.title.trim().length >= 2;
      case 2:
        // Pricing & Budget - all optional, always allow proceed
        return true;
      case 3:
        // Schedule & Access - all optional
        return true;
      case 4:
        // Platforms & Payments - all optional
        return true;
      case 5:
        // Creator Profiles - optional
        return true;
      case 6:
        // Campaign Assets - all optional
        return true;
      case 7:
        // Review - always allow proceed to create
        return true;
      default:
        return true;
    }
  });

  // Validation for edit form
  const canProceedEdit = computed(() => {
    // Require title with at least 2 characters
    return campaignForm.title && campaignForm.title.trim().length >= 2;
  });

  const nextStep = () => {
    if (canProceed.value && currentStep.value < totalSteps) {
      currentStep.value++;
    }
  };

  const prevStep = () => {
    if (currentStep.value > 1) {
      currentStep.value--;
    }
  };

  const getPlatformIcon = (platform: string) => {
    // Return null for X platform - we'll use a special character instead
    if (platform === 'x' || platform === 'twitter') return null;
    const icons: Record<string, typeof Music2> = {
      tiktok: Music2,
      instagram: Instagram,
      youtube: Youtube,
    };
    return icons[platform] || Globe;
  };

  const isXPlatform = (platform: string) => platform === 'x' || platform === 'twitter';

  const extractUsername = (url: string) => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      // Extract username from various URL patterns
      // x.com/username/status/123 -> username
      // instagram.com/p/ABC123 -> extract from path
      // tiktok.com/@username/video/123 -> username
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        // For X/Twitter: /username/status/id
        if (urlObj.hostname.includes('x.com') || urlObj.hostname.includes('twitter.com')) {
          return parts[0];
        }
        // For TikTok: /@username/video/id
        if (urlObj.hostname.includes('tiktok.com') && parts[0].startsWith('@')) {
          return parts[0].substring(1);
        }
        // For Instagram: /p/id or /reel/id - use hostname
        if (urlObj.hostname.includes('instagram.com')) {
          return 'instagram';
        }
        // For YouTube: various patterns
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
          return 'youtube';
        }
        return parts[0];
      }
      return urlObj.hostname;
    } catch {
      // Fallback: truncate the URL
      return url.length > 20 ? url.substring(0, 20) + '...' : url;
    }
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
    return fmtDate(dateStr);
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  const getBudgetPercentage = (campaign: Campaign) => {
    const spent = parseFloat(campaign.spent || '0');
    const budget = parseFloat(campaign.budget || '0');
    if (budget === 0) return 0;
    return Math.min((spent / budget) * 100, 100);
  };

  const getDaysRemaining = (campaign: Campaign) => {
    if (!campaign.ends_at) return null;
    const now = new Date();
    const endDate = new Date(campaign.ends_at);
    const diffMs = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    return diffDays;
  };

  const getPlatformClass = (platform: string) => {
    const classes: Record<string, string> = {
      tiktok: 'campaigns__platform--tiktok',
      instagram: 'campaigns__platform--instagram',
      x: 'campaigns__platform--x',
      youtube: 'campaigns__platform--youtube',
    };
    return classes[platform] || '';
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

  const togglePaymentModel = () => {
    campaignForm.payment_model = campaignForm.payment_model === 'cpm' ? 'per_clip' : 'cpm';
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


  const openCreateDialog = async () => {
    editingCampaign.value = null;
    coverImagePreview.value = '';
    selectedCreatorProfileIds.value = [];
    currentStep.value = 1;
    error.value = null;
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
      payment_model: 'cpm' as 'cpm' | 'per_clip',
      per_clip_amount: 0,
      clips_per_profile: 5,
      creator_profile_id: null,
      branding_profile_id: null,
    });
    showCampaignDialog.value = true;
    await loadCreatorProfilesAndAssets();
  };

  const editCampaign = async (campaign: Campaign) => {
    editingCampaign.value = campaign;
    coverImagePreview.value = '';
    selectedCreatorProfileIds.value = campaign.creator_profiles?.map((p) => p.id) || [];
    error.value = null;
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
      payment_model: campaign.payment_model || 'cpm',
      per_clip_amount: campaign.per_clip_amount ? parseFloat(campaign.per_clip_amount) : 0,
      clips_per_profile: campaign.clips_per_profile || 5,
      creator_profile_id: campaign.creator_profile_id || null,
      branding_profile_id: campaign.branding_profile_id || null,
    });
    showCampaignDialog.value = true;
    await loadCreatorProfilesAndAssets();
  };

  const saveCampaign = async () => {
    saving.value = true;
    error.value = null;
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
        payment_model: campaignForm.payment_model,
        per_clip_amount: campaignForm.payment_model === 'per_clip' ? campaignForm.per_clip_amount : undefined,
        clips_per_profile: campaignForm.payment_model === 'per_clip' ? campaignForm.clips_per_profile : undefined,
        creator_profile_id: campaignForm.creator_profile_id || undefined,
        branding_profile_id: campaignForm.branding_profile_id || undefined,
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
        const errorMsg = response.error || 'Failed to save campaign';
        error.value = errorMsg;
        toast({ title: 'Error', description: errorMsg });
      }
    } catch (err) {
      console.error('Failed to save campaign:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to save campaign';
      error.value = errorMsg;
      toast({ title: 'Error', description: errorMsg });
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
      const response = await listCampaignParticipants(Number(props.organizationId), Number(selectedCampaign.value.id));
      if (response.success) {
        participants.value = response.participants || [];
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

  const loadPayments = async () => {
    if (!selectedCampaign.value) return;

    loadingPayments.value = true;
    try {
      const response = await listCampaignPayments(Number(props.organizationId), selectedCampaign.value.id);
      if (response.success) {
        payments.value = response.payments;
      }
    } catch (error) {
      console.error('Failed to load payments:', error);
    } finally {
      loadingPayments.value = false;
    }
  };

  const calculatePaymentsAction = async () => {
    if (!selectedCampaign.value) return;

    calculatingPayments.value = true;
    try {
      const response = await calculateCampaignPayments(Number(props.organizationId), selectedCampaign.value.id);
      if (response.success) {
        toast({
          title: 'Success',
          description: `Created ${response.payments_created} payments totaling $${response.total_amount}`,
        });
        await loadPayments();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to calculate payments', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to calculate payments:', error);
      toast({ title: 'Error', description: 'Failed to calculate payments', type: 'error' });
    } finally {
      calculatingPayments.value = false;
    }
  };

  const openVerifyPaymentDialog = (payment: CampaignPayment) => {
    selectedPayment.value = payment;
    verificationScreenshotUrl.value = '';
    verificationNotes.value = '';
    verificationPaymentDate.value = new Date().toISOString().split('T')[0];
    showVerifyPaymentDialog.value = true;
  };

  const verifyPaymentAction = async () => {
    if (!selectedPayment.value) return;

    verifyingPayment.value = true;
    try {
      const response = await verifyPayment(Number(props.organizationId), selectedPayment.value.id, {
        screenshot_url: verificationScreenshotUrl.value,
        notes: verificationNotes.value,
        payment_date: verificationPaymentDate.value,
      });

      if (response.success) {
        toast({ title: 'Success', description: 'Payment verified and clipper notified' });
        showVerifyPaymentDialog.value = false;
        await loadPayments();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to verify payment', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to verify payment:', error);
      toast({ title: 'Error', description: 'Failed to verify payment', type: 'error' });
    } finally {
      verifyingPayment.value = false;
    }
  };

  const viewScreenshot = (url: string) => {
    window.open(url, '_blank');
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
        Number(selectedCampaign.value.id),
        Number(participant.id)
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
      const response = await rejectParticipant(Number(props.organizationId), Number(selectedCampaign.value.id), Number(participant.id));
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

  const openUpdateViewsDialog = (submission: CampaignSubmission) => {
    viewsSubmission.value = submission;
    updateViewsCount.value = submission.view_count;
    showUpdateViewsDialog.value = true;
  };

  const updateViewsAction = async () => {
    if (!viewsSubmission.value) return;

    updatingViews.value = true;
    try {
      const response = await updateSubmissionViews(
        Number(props.organizationId),
        viewsSubmission.value.id,
        updateViewsCount.value
      );
      if (response.success) {
        toast({ title: 'Success', description: 'View count updated' });
        showUpdateViewsDialog.value = false;
        await loadSubmissions();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to update views' });
      }
    } catch (error) {
      console.error('Failed to update views:', error);
      toast({ title: 'Error', description: 'Failed to update views' });
    } finally {
      updatingViews.value = false;
    }
  };

  // Reload participants when switching to the participants tab
  watch(detailTab, async (newTab) => {
    if (newTab === 'participants' && selectedCampaign.value) {
      await loadParticipants();
    } else if (newTab === 'submissions' && selectedCampaign.value) {
      await loadSubmissions();
    }
  });

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

  /* ===== Campaigns Grid ===== */
  .campaigns__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  /* Responsive grid breakpoints */
  @media (min-width: 1400px) {
    .campaigns__grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 1100px) and (max-width: 1399px) {
    .campaigns__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 768px) and (max-width: 1099px) {
    .campaigns__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 767px) {
    .campaigns__grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .campaigns__cover {
      height: 140px;
    }

    .campaigns__stat {
      padding: 0.625rem 0.375rem;
    }

    .campaigns__stat-value {
      font-size: 0.8125rem;
    }

    .campaigns__stat-label {
      font-size: 0.5rem;
    }
  }

  /* ===== Campaign Card ===== */
  .campaigns__card {
    display: flex;
    flex-direction: column;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
  }

  .campaigns__card:hover {
    border-color: rgba(6, 182, 212, 0.3);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    transform: translateY(-2px);
  }

  .campaigns__card-content {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 1rem;
    flex: 1;
  }

  /* ===== Cover Image ===== */
  .campaigns__cover {
    position: relative;
    width: 100%;
    height: 160px;
    overflow: hidden;
    flex-shrink: 0;
    background-color: var(--sidebar-hover);
  }

  .campaigns__cover::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.4) 100%);
    pointer-events: none;
  }

  .campaigns__cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 400ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .campaigns__card:hover .campaigns__cover-img {
    transform: scale(1.05);
  }

  .campaigns__cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--sidebar-hover) 0%, var(--sidebar-active) 100%);
  }

  .campaigns__cover-icon {
    width: 40px;
    height: 40px;
    color: var(--sidebar-accent);
    opacity: 0.4;
  }

  .campaigns__cover-badges {
    position: absolute;
    top: 0.625rem;
    left: 0.625rem;
    right: 0.625rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 2;
  }

  /* ===== Status Badge ===== */
  .campaigns__status {
    padding: 0.25rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-radius: 5px;
    backdrop-filter: blur(8px);
    background-color: rgba(113, 113, 122, 0.9);
    color: white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  }

  .campaigns__status--active {
    background-color: rgba(16, 185, 129, 0.95);
  }

  .campaigns__status--paused {
    background-color: rgba(245, 158, 11, 0.95);
  }

  .campaigns__status--completed {
    background-color: rgba(99, 102, 241, 0.95);
  }

  .campaigns__status--draft {
    background-color: rgba(113, 113, 122, 0.95);
  }

  /* ===== Campaign Info ===== */
  .campaigns__info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }

  .campaigns__name {
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

  .campaigns__desc {
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

  .campaigns__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.625rem;
  }

  .campaigns__meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .campaigns__meta-item--highlight {
    color: var(--sidebar-accent);
    font-weight: 600;
  }

  .campaigns__meta-icon {
    width: 12px;
    height: 12px;
  }

  .campaigns__platforms-creators {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: auto;
  }

  /* ===== Join Type Badge ===== */
  .campaigns__join-type {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-radius: 5px;
    white-space: nowrap;
    flex-shrink: 0;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  }

  .campaigns__join-type--open {
    background-color: rgba(16, 185, 129, 0.9);
    color: white;
  }

  .campaigns__join-type--application {
    background-color: rgba(245, 158, 11, 0.9);
    color: white;
  }

  .campaigns__join-type-icon {
    width: 11px;
    height: 11px;
  }

  /* ===== Platform Icons ===== */
  .campaigns__platforms {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .campaigns__platform-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    transition: all 150ms ease;
    flex-shrink: 0;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
  }

  .campaigns__platform-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .campaigns__platform-icon--tiktok,
  .campaigns__platform-icon--x {
    width: 13px;
    height: 13px;
  }

  .campaigns__platform--tiktok {
    background-color: rgba(0, 0, 0, 0.9);
    border-color: rgba(255, 0, 80, 0.3);
  }

  .campaigns__platform--tiktok .campaigns__platform-icon {
    color: #ff0050;
  }

  .campaigns__platform--instagram {
    background-color: rgba(0, 0, 0, 0.9);
    border-color: rgba(225, 48, 108, 0.3);
  }

  .campaigns__platform--instagram .campaigns__platform-icon {
    color: #e1306c;
  }

  .campaigns__platform--x {
    background-color: rgba(0, 0, 0, 0.9);
    border-color: rgba(29, 161, 242, 0.3);
  }

  .campaigns__platform--x .campaigns__platform-icon {
    color: #1da1f2;
  }

  .campaigns__platform--youtube {
    background-color: rgba(255, 0, 0, 0.1);
    border-color: rgba(255, 0, 0, 0.3);
  }

  .campaigns__platform--youtube .campaigns__platform-icon {
    color: #ff0000;
  }

  .campaigns__card:hover .campaigns__platform-badge {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  /* ===== Creator Avatars ===== */
  .campaigns__creators {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .campaigns__creator-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--sidebar-surface);
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  .campaigns__creator-avatar:not(:first-child) {
    margin-left: -8px;
  }

  .campaigns__creator-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .campaigns__creator-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--sidebar-hover), var(--sidebar-active));
    color: var(--sidebar-text);
    font-size: 0.5625rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .campaigns__creator-more {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    font-weight: 600;
    margin-left: 0.25rem;
  }

  /* ===== Budget Progress ===== */
  .campaigns__budget-progress {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .campaigns__budget-bar {
    width: 100%;
    height: 6px;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
    overflow: hidden;
    position: relative;
    border: 1px solid var(--sidebar-border);
  }

  .campaigns__budget-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms ease;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.2);
  }

  .campaigns__budget-fill--low {
    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
  }

  .campaigns__budget-fill--medium {
    background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
  }

  .campaigns__budget-fill--high {
    background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
  }

  .campaigns__budget-text {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }

  /* ===== Stats ===== */
  .campaigns__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    overflow: hidden;
  }

  .campaigns__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.75rem 0.5rem;
    text-align: center;
  }

  .campaigns__stat:not(:last-child) {
    border-right: 1px solid var(--sidebar-border);
  }

  .campaigns__stat-icon {
    display: none;
  }

  .campaigns__stat-data {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
  }

  .campaigns__stat-value {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .campaigns__stat-label {
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 500;
    white-space: nowrap;
  }

  /* ===== Actions ===== */
  .campaigns__actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding-top: 0.75rem;
    margin-top: auto;
    border-top: 1px solid var(--sidebar-border);
  }

  .campaigns__action-btn {
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

  .campaigns__action-btn:hover {
    background-color: var(--sidebar-hover);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
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

  .campaigns__card--skeleton .campaigns__skeleton-cover {
    width: 100%;
    height: 160px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .campaigns__card--skeleton .campaigns__skeleton-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .campaigns__card--skeleton .campaigns__skeleton-title {
    height: 18px;
    width: 75%;
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

  .campaigns__card--skeleton .campaigns__skeleton-desc {
    height: 14px;
    width: 100%;
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

  .campaigns__card--skeleton .campaigns__skeleton-platforms {
    height: 24px;
    width: 40%;
    border-radius: 6px;
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

  .campaigns__card--skeleton .campaigns__skeleton-stats {
    height: 60px;
    width: 100%;
    border-radius: 8px;
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

  .campaigns__card--skeleton .campaigns__skeleton-progress {
    height: 6px;
    width: 100%;
    border-radius: 3px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.3s;
  }

  .campaigns__card--skeleton .campaigns__skeleton-actions {
    height: 34px;
    width: 100%;
    border-radius: 8px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.35s;
    margin-top: auto;
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

  .campaigns-dialog__accent--blue {
    background: linear-gradient(90deg, #3b82f6, rgba(59, 130, 246, 0.5));
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

  .campaigns-dialog__icon--blue {
    background-color: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
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

  .campaigns-dialog__dropdown {
    width: 100%;
  }

  /* Dropdown trigger button styling */
  :deep(.campaigns-dialog__dropdown-trigger) {
    width: 100% !important;
    padding: 0.75rem 1rem !important;
    background-color: var(--sidebar-hover) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    font-size: 0.875rem !important;
    color: var(--sidebar-text) !important;
    transition: all 150ms ease !important;
    justify-content: space-between !important;
  }

  :deep(.campaigns-dialog__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  :deep(.campaigns-dialog__dropdown-trigger:focus-within) {
    border-color: var(--sidebar-accent) !important;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15) !important;
  }

  :deep(.campaigns-dialog__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.campaigns-dialog__dropdown-trigger svg) {
    width: 14px !important;
    height: 14px !important;
    color: var(--sidebar-text-muted) !important;
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
    color: #000;
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
  }

  .campaigns-detail__action-btn--secondary {
    color: #60a5fa;
  }

  .campaigns-detail__action-btn--secondary:hover {
    background-color: rgba(59, 130, 246, 0.15);
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

  .campaigns-detail__submission-platform-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    flex-shrink: 0;
    background-color: var(--sidebar-hover);
  }

  .campaigns-detail__submission-platform-badge--x {
    background-color: #000;
  }

  .campaigns-detail__submission-platform-badge--instagram {
    background-color: #000;
  }

  .campaigns-detail__submission-platform-badge--tiktok {
    background-color: #000;
  }

  .campaigns-detail__submission-platform-badge--youtube {
    background-color: #ff0000;
  }

  .campaigns-detail__submission-platform-icon {
    width: 16px;
    height: 16px;
    color: white;
  }

  .campaigns-detail__x-icon {
    font-size: 16px;
    font-weight: 700;
    color: white;
    line-height: 1;
  }

  .campaigns-detail__submission-url {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: var(--sidebar-accent);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .campaigns-detail__submission-url:hover {
    color: var(--sidebar-accent-hover);
  }

  .campaigns-detail__submission-url:hover .campaigns-detail__submission-external {
    opacity: 1;
  }

  .campaigns-detail__submission-username {
    font-weight: 500;
  }

  .campaigns-detail__submission-external {
    opacity: 0.5;
    transition: opacity 0.15s ease;
  }

  .campaigns-detail__submission-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.25rem;
  }

  .campaigns-detail__submission-synced {
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    font-size: 0.7rem;
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

  /* ===== Campaign Wizard Styles ===== */

  /* Overlay */
  .campaign-wizard__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  /* Dialog Container */
  .campaign-wizard {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 14px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  /* Accent Bar */
  .campaign-wizard__accent {
    height: 3px;
    background: linear-gradient(90deg, #06b6d4, #0ea5e9, #3b82f6);
    flex-shrink: 0;
  }

  /* Progress Indicator */
  .campaign-wizard__progress {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.25rem 0 1rem;
  }

  .campaign-wizard__progress-dot {
    height: 8px;
    width: 8px;
    border-radius: 9999px;
    background-color: var(--sidebar-border);
    transition: all 250ms ease;
  }

  .campaign-wizard__progress-dot--active {
    width: 32px;
    background-color: var(--sidebar-accent);
  }

  /* Close Button */
  .campaign-wizard__close {
    position: absolute;
    top: 1.25rem;
    right: 1.25rem;
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
    z-index: 10;
  }

  .campaign-wizard__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .campaign-wizard__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Content */
  .campaign-wizard__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 2rem 1.5rem;
    min-height: 0;
  }

  .campaign-wizard__content::-webkit-scrollbar {
    width: 6px;
  }

  .campaign-wizard__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .campaign-wizard__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .campaign-wizard__step {
    display: flex;
    flex-direction: column;
    margin-top: 1.2rem;
  }

  /* Header */
  .campaign-wizard__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 2rem;
  }

  .campaign-wizard__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 14px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 1.25rem;
  }

  .campaign-wizard__icon--success {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .campaign-wizard__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }

  .campaign-wizard__subtitle {
    font-size: 0.9375rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 400px;
  }

  /* Fields */
  .campaign-wizard__fields {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .campaign-wizard__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .campaign-wizard__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .campaign-wizard__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .campaign-wizard__optional {
    font-weight: 400;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    font-size: 0.8125rem;
  }

  .campaign-wizard__input,
  .campaign-wizard__select,
  .campaign-wizard__textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.9375rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .campaign-wizard__input::placeholder,
  .campaign-wizard__textarea::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .campaign-wizard__input:focus,
  .campaign-wizard__select:focus,
  .campaign-wizard__textarea:focus {
    outline: none;
    border-color: transparent;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
  }

  .campaign-wizard__textarea {
    resize: vertical;
    min-height: 90px;
    line-height: 1.5;
  }

  .campaign-wizard__hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    opacity: 0.7;
  }

  /* Tags */
  .campaign-wizard__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .campaign-wizard__tag {
    padding: 0.5rem 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 20px;
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaign-wizard__tag:hover {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .campaign-wizard__tag--selected {
    background-color: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.4);
    color: var(--sidebar-accent);
  }

  .campaign-wizard__tag--selected:hover {
    background-color: rgba(6, 182, 212, 0.2);
  }

  /* Loading & Empty States */
  .campaign-wizard__loading,
  .campaign-wizard__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .campaign-wizard__spinner {
    width: 24px;
    height: 24px;
    color: var(--sidebar-accent);
    animation: spin 0.8s linear infinite;
  }

  /* Creator Profiles List */
  .campaign-wizard__profiles-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 300px;
    overflow-y: auto;
  }

  .campaign-wizard__profile {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaign-wizard__profile:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .campaign-wizard__profile--selected {
    background-color: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.4);
  }

  .campaign-wizard__profile-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .campaign-wizard__profile-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .campaign-wizard__profile-avatar-icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
  }

  .campaign-wizard__profile-info {
    flex: 1;
    min-width: 0;
  }

  .campaign-wizard__profile-name {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .campaign-wizard__profile-desc {
    display: block;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .campaign-wizard__profile-check {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: var(--sidebar-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .campaign-wizard__profile-check-icon {
    width: 12px;
    height: 12px;
    color: white;
  }

  /* Asset Row */
  .campaign-wizard__asset-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .campaign-wizard__asset-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .campaign-wizard__checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    cursor: pointer;
  }

  .campaign-wizard__checkbox {
    cursor: pointer;
  }

  .campaign-wizard__watermark-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .campaign-wizard__watermark-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .campaign-wizard__watermark-label {
    color: var(--sidebar-text-muted);
  }

  .campaign-wizard__watermark-value {
    color: var(--sidebar-text);
    font-weight: 500;
  }

  .campaign-wizard__watermark-none {
    color: var(--sidebar-text-muted);
    font-style: italic;
  }

  .campaign-wizard__watermark-btn {
    padding: 0.5rem 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaign-wizard__watermark-btn:hover {
    background-color: var(--sidebar-hover);
    border-color: rgba(6, 182, 212, 0.3);
  }

  /* Cover Image */
  .campaign-wizard__cover-preview {
    position: relative;
    width: 100%;
    height: 200px;
    border-radius: 8px;
    overflow: hidden;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
  }

  .campaign-wizard__cover-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .campaign-wizard__cover-remove {
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

  .campaign-wizard__cover-remove:hover {
    background-color: rgba(239, 68, 68, 0.8);
  }

  .campaign-wizard__cover-remove-icon {
    width: 14px;
    height: 14px;
  }

  .campaign-wizard__upload-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .campaign-wizard__upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .campaign-wizard__upload-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .campaign-wizard__upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .campaign-wizard__upload-icon {
    width: 16px;
    height: 16px;
  }

  .campaign-wizard__upload-or {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .campaign-wizard__input--url {
    flex: 1;
  }

  .campaign-wizard__file-input {
    display: none;
  }

  /* Summary */
  .campaign-wizard__summary {
    padding: 0;
    background-color: transparent;
    border: none;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .campaign-wizard__summary-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .campaign-wizard__summary-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .campaign-wizard__summary-info {
    flex: 1;
    min-width: 0;
  }

  .campaign-wizard__summary-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.01em;
  }

  .campaign-wizard__summary-desc {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .campaign-wizard__summary-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .campaign-wizard__summary-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .campaign-wizard__summary-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sidebar-text);
  }

  .campaign-wizard__summary-label svg {
    color: var(--sidebar-accent);
  }

  .campaign-wizard__summary-value {
    font-size: 0.875rem;
    color: var(--sidebar-text);
  }

  .campaign-wizard__summary-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .campaign-wizard__summary-tag {
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  /* Alert */
  .campaign-wizard__alert {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.875rem 1rem;
    border-radius: 8px;
    margin-top: 1rem;
  }

  .campaign-wizard__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .campaign-wizard__alert svg {
    flex-shrink: 0;
    color: #ef4444;
  }

  .campaign-wizard__alert-text {
    font-size: 0.8125rem;
    color: #ef4444;
    margin: 0;
  }

  /* Footer */
  .campaign-wizard__footer {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1.25rem 2rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.2);
  }

  .campaign-wizard__footer-buttons {
    display: flex;
    gap: 0.75rem;
  }

  /* Buttons */
  .campaign-wizard__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.25rem;
    font-size: 0.9375rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaign-wizard__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .campaign-wizard__btn--full {
    width: 100%;
  }

  .campaign-wizard__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .campaign-wizard__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .campaign-wizard__btn--primary {
    background: linear-gradient(135deg, #06b6d4, #0ea5e9);
    color: #000;
  }

  .campaign-wizard__btn--primary:hover:not(:disabled) {
    opacity: 0.95;
  }

  .campaign-wizard__btn-spinner {
    width: 18px;
    height: 18px;
    animation: spin 0.8s linear infinite;
  }

  .campaign-wizard__skip {
    width: 100%;
    padding: 0.5rem;
    background: transparent;
    border: none;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: color 150ms ease;
  }

  .campaign-wizard__skip:hover {
    color: var(--sidebar-text);
  }

  /* Dropdown compatibility */
  .campaign-wizard__dropdown {
    width: 100%;
  }

  /* Dropdown trigger button styling (using :deep for CustomDropdown component) */
  :deep(.campaign-wizard__dropdown-trigger) {
    width: 100% !important;
    padding: 0.75rem 1rem !important;
    background-color: var(--sidebar-hover) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    font-size: 0.9375rem !important;
    color: var(--sidebar-text) !important;
    transition: all 150ms ease !important;
    justify-content: space-between !important;
  }

  :deep(.campaign-wizard__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  :deep(.campaign-wizard__dropdown-trigger:focus-within) {
    border-color: var(--sidebar-accent) !important;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15) !important;
  }

  :deep(.campaign-wizard__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.campaign-wizard__dropdown-trigger svg) {
    width: 14px !important;
    height: 14px !important;
    color: var(--sidebar-text-muted) !important;
  }

  /* ============================================================================
   * Campaign Edit Form Styles
   * ========================================================================= */

  .campaign-edit__content {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 85vh;
  }

  .campaign-edit__header {
    padding: 2rem 2rem 1rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .campaign-edit__title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem 0;
  }

  .campaign-edit__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .campaign-edit__form {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 2rem;
  }

  .campaign-edit__section {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .campaign-edit__section:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .campaign-edit__section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 1.25rem 0;
  }

  .campaign-edit__fields {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .campaign-edit__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .campaign-edit__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .campaign-edit__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .campaign-edit__input,
  .campaign-edit__textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.9375rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .campaign-edit__input:focus,
  .campaign-edit__textarea:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .campaign-edit__textarea {
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
  }

  .campaign-edit__hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* Cover Image Styles */
  .campaign-edit__cover-preview {
    position: relative;
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
    background-color: var(--sidebar-hover);
  }

  .campaign-edit__cover-preview img {
    width: 100%;
    height: auto;
    display: block;
  }

  .campaign-edit__cover-remove {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.5rem;
    background-color: rgba(0, 0, 0, 0.6);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .campaign-edit__cover-remove:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }

  .campaign-edit__cover-remove-icon {
    width: 16px;
    height: 16px;
    color: white;
  }

  .campaign-edit__upload-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .campaign-edit__upload-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .campaign-edit__upload-btn:hover:not(:disabled) {
    border-color: var(--sidebar-accent);
  }

  .campaign-edit__upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .campaign-edit__upload-icon,
  .campaign-edit__spinner {
    width: 16px;
    height: 16px;
  }

  .campaign-edit__spinner {
    animation: spin 1s linear infinite;
  }

  .campaign-edit__file-input {
    display: none;
  }

  .campaign-edit__upload-or {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .campaign-edit__input--url {
    flex: 1;
  }

  /* Platforms and Payment Methods */
  .campaign-edit__platforms,
  .campaign-edit__payment-methods {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .campaign-edit__platform-btn,
  .campaign-edit__payment-btn {
    padding: 0.5rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaign-edit__platform-btn:hover,
  .campaign-edit__payment-btn:hover {
    border-color: var(--sidebar-accent);
  }

  .campaign-edit__platform-btn--active,
  .campaign-edit__payment-btn--active {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
    color: #000;
  }

  /* Loading and Empty States */
  .campaign-edit__loading,
  .campaign-edit__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .campaign-edit__loading {
    gap: 0.75rem;
  }

  .campaign-edit__loading-icon {
    width: 20px;
    height: 20px;
    animation: spin 1s linear infinite;
  }

  /* Payment Model Toggle Switch */
  .campaign-edit__toggle-container {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .campaign-edit__toggle-label {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    transition: all 200ms ease;
    font-weight: 500;
  }

  .campaign-edit__toggle-label--active {
    color: var(--sidebar-text);
    font-weight: 600;
  }

  .campaign-edit__toggle-switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 24px;
    flex-shrink: 0;
  }

  .campaign-edit__toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .campaign-edit__toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--sidebar-border);
    transition: 0.3s;
    border-radius: 24px;
  }

  .campaign-edit__toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  .campaign-edit__toggle-switch input:checked + .campaign-edit__toggle-slider {
    background-color: var(--sidebar-accent);
  }

  .campaign-edit__toggle-switch input:checked + .campaign-edit__toggle-slider:before {
    transform: translateX(24px);
  }

  .campaign-edit__toggle-switch:hover .campaign-edit__toggle-slider {
    opacity: 0.9;
  }

  /* Wizard Toggle Styles */
  .campaign-wizard__toggle-container {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
  }

  .campaign-wizard__toggle-label--active {
    color: var(--sidebar-text);
    font-weight: 600;
  }

  .campaign-wizard__toggle-switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 24px;
    flex-shrink: 0;
  }

  .campaign-wizard__toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .campaign-wizard__toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--sidebar-border);
    transition: 0.3s;
    border-radius: 24px;
  }

  .campaign-wizard__toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  .campaign-wizard__toggle-switch input:checked + .campaign-wizard__toggle-slider {
    background-color: var(--sidebar-accent);
  }

  .campaign-wizard__toggle-switch input:checked + .campaign-wizard__toggle-slider:before {
    transform: translateX(24px);
  }

  .campaign-wizard__toggle-switch:hover .campaign-wizard__toggle-slider {
    opacity: 0.9;
  }

  /* Streamer Assignment */
  .campaign-edit__streamers {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-height: 40px;
  }

  .campaign-edit__streamer-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background-color: rgba(6, 182, 212, 0.1);
    border: 1px solid var(--sidebar-accent);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    cursor: default;
    transition: all 150ms ease;
  }

  .campaign-edit__streamer-tag:hover {
    background-color: rgba(6, 182, 212, 0.15);
  }

  .campaign-edit__streamer-tag svg {
    cursor: pointer;
    color: var(--sidebar-text-muted);
    transition: color 150ms ease;
  }

  .campaign-edit__streamer-tag svg:hover {
    color: #ef4444;
  }

  /* Creator Profiles */
  .campaign-edit__profiles {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .campaign-edit__profile-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .campaign-edit__profile-btn:hover {
    border-color: var(--sidebar-accent);
  }

  .campaign-edit__profile-btn--selected {
    background-color: rgba(6, 182, 212, 0.1);
    border-color: var(--sidebar-accent);
  }

  .campaign-edit__profile-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--sidebar-border);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .campaign-edit__profile-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .campaign-edit__profile-avatar svg {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
  }

  .campaign-edit__profile-name {
    flex: 1;
    font-size: 0.875rem;
    color: var(--sidebar-text);
  }

  .campaign-edit__profile-check {
    color: var(--sidebar-accent);
  }

  /* Asset Row */
  .campaign-edit__asset-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .campaign-edit__asset-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .campaign-edit__checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    cursor: pointer;
  }

  .campaign-edit__checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .campaign-edit__watermark-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .campaign-edit__watermark-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .campaign-edit__watermark-label {
    color: var(--sidebar-text-muted);
  }

  .campaign-edit__watermark-value {
    color: var(--sidebar-text);
    font-weight: 500;
  }

  .campaign-edit__watermark-none {
    color: var(--sidebar-text-muted);
  }

  .campaign-edit__watermark-btn {
    padding: 0.5rem 1rem;
    background-color: var(--sidebar-accent);
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: white;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .campaign-edit__watermark-btn:hover {
    opacity: 0.9;
  }

  /* Dropdown compatibility */
  .campaign-edit__dropdown {
    width: 100%;
  }

  :deep(.campaign-edit__dropdown-trigger) {
    width: 100% !important;
    padding: 0.75rem 1rem !important;
    background-color: var(--sidebar-hover) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    font-size: 0.9375rem !important;
    color: var(--sidebar-text) !important;
    transition: all 150ms ease !important;
    justify-content: space-between !important;
  }

  :deep(.campaign-edit__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  :deep(.campaign-edit__dropdown-trigger:focus-within) {
    border-color: var(--sidebar-accent) !important;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15) !important;
  }

  :deep(.campaign-edit__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.campaign-edit__dropdown-trigger svg) {
    width: 14px !important;
    height: 14px !important;
    color: var(--sidebar-text-muted) !important;
  }

  /* Actions */
  .campaign-edit__actions {
    display: flex;
    gap: 0.75rem;
    padding: 1.25rem 2rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-surface);
  }

  .campaign-edit__btn {
    flex: 1;
    padding: 0.875rem 1.5rem;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .campaign-edit__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .campaign-edit__btn--secondary {
    background-color: transparent;
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .campaign-edit__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
  }

  .campaign-edit__btn--primary {
    background-color: var(--sidebar-accent);
    border: none;
    color: #000;
  }

  .campaign-edit__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .campaign-edit__btn-spinner {
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .campaign-wizard {
      max-width: 100%;
      border-radius: 0;
    }

    .campaign-wizard__content {
      padding: 0 1.5rem 1.5rem;
    }

    .campaign-wizard__footer {
      padding: 1.25rem 1.5rem;
    }

    .campaign-wizard__row {
      grid-template-columns: 1fr;
    }

    .campaign-edit__header {
      padding: 1.5rem;
    }

    .campaign-edit__form {
      padding: 1rem 1.5rem;
    }

    .campaign-edit__row {
      grid-template-columns: 1fr;
    }

    .campaign-edit__actions {
      padding: 1rem 1.5rem;
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

  /* Campaign Wizard dropdown menu styling */
  .campaign-wizard__dropdown + div[class*='fixed'],
  div.fixed.bg-popover {
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: campaignWizardDropdownFade 100ms ease-out !important;
  }

  @keyframes campaignWizardDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Dropdown menu items */
  .campaign-wizard__dropdown + div[class*='fixed'] button,
  div.fixed.bg-popover button {
    display: flex !important;
    align-items: center !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.875rem !important;
    color: var(--sidebar-text) !important;
    transition: background-color 150ms ease !important;
  }

  .campaign-wizard__dropdown + div[class*='fixed'] button:hover,
  div.fixed.bg-popover button:hover {
    background-color: var(--sidebar-hover) !important;
  }

  .campaign-wizard__dropdown + div[class*='fixed'] button.bg-primary\/10,
  div.fixed.bg-popover button.bg-primary\/10 {
    background-color: rgba(6, 182, 212, 0.15) !important;
    color: var(--sidebar-accent) !important;
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

  /* Campaigns Dialog dropdown menu styling */
  .campaigns-dialog__dropdown + div[class*='fixed'],
  div.fixed.bg-popover {
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: campaignsDialogDropdownFade 100ms ease-out !important;
  }

  @keyframes campaignsDialogDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Dropdown menu items */
  .campaigns-dialog__dropdown + div[class*='fixed'] button,
  div.fixed.bg-popover button {
    display: flex !important;
    align-items: center !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text) !important;
    transition: background-color 150ms ease !important;
  }

  .campaigns-dialog__dropdown + div[class*='fixed'] button:hover,
  div.fixed.bg-popover button:hover {
    background-color: var(--sidebar-hover) !important;
  }

  .campaigns-dialog__dropdown + div[class*='fixed'] button.bg-primary\/10,
  div.fixed.bg-popover button.bg-primary\/10 {
    background-color: rgba(6, 182, 212, 0.15) !important;
    color: var(--sidebar-accent) !important;
  }
</style>

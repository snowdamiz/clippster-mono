<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="build-dialog__overlay">
        <Transition name="dialog" appear>
          <div class="build-dialog">
            <!-- Decorative top accent -->
            <div class="build-dialog__accent" />

            <!-- Header -->
            <div class="build-dialog__header">
              <button class="build-dialog__close" @click="handleClose" :disabled="isBuilding" title="Close">
                <X :size="18" />
              </button>
              <div class="build-dialog__icon">
                <Rocket :size="24" />
              </div>
              <h2 class="build-dialog__title">Quick Publish</h2>
              <p class="build-dialog__subtitle">
                {{ clip?.current_version_name || clip?.name || 'Untitled Clip' }} •
                {{ formatDuration(clipDuration) }}
              </p>
            </div>

            <!-- Step Indicator -->
            <div class="build-dialog__steps-wrapper">
              <div class="build-dialog__steps">
                <div
                  v-for="(step, index) in visibleSteps"
                  :key="step.id"
                  class="build-dialog__step-container"
                  :class="{ 'build-dialog__step-container--with-line': index < visibleSteps.length - 1 }"
                >
                  <button
                    @click="goToStep(step.id)"
                    :disabled="!canNavigateToStep(step.id) || isBuilding"
                    class="build-dialog__step"
                    :class="{
                      'build-dialog__step--active': currentStep === step.id,
                      'build-dialog__step--completed': isStepCompleted(step.id) && currentStep !== step.id,
                      'build-dialog__step--disabled': !canNavigateToStep(step.id) || isBuilding,
                    }"
                  >
                    <div class="build-dialog__step-circle">
                      <CheckIcon v-if="isStepCompleted(step.id) && currentStep !== step.id" class="build-dialog__step-icon" />
                      <component v-else :is="step.icon" class="build-dialog__step-icon" />
                    </div>
                    <span class="build-dialog__step-label">{{ step.label }}</span>
                  </button>
                  <div
                    v-if="index < visibleSteps.length - 1"
                    class="build-dialog__step-connector"
                    :class="{ 'build-dialog__step-connector--completed': isStepCompleted(step.id) }"
                  />
                </div>
              </div>
            </div>

            <!-- Step Content -->
            <div class="build-dialog__content">
              <div class="build-dialog__content-inner">
                <!-- Step 1: Platforms -->
                <Transition name="step-slide" mode="out-in">
                  <div v-if="currentStep === 'platforms'" key="platforms" class="build-dialog__step-content">
                    <div class="build-dialog__step-header">
                      <h3 class="build-dialog__step-title">Choose Your Platforms</h3>
                      <p class="build-dialog__step-subtitle">Select aspect ratios for your target platforms</p>
                    </div>

                    <div class="build-dialog__platform-grid">
                      <!-- 16:9 Landscape -->
                      <button
                        @click="toggleRatio('16:9')"
                        class="build-dialog__platform-card"
                        :class="{ 'build-dialog__platform-card--selected': selectedRatios.includes('16:9') }"
                      >
                        <div class="build-dialog__platform-card-header">
                          <div class="build-dialog__platform-label-group">
                            <span class="build-dialog__platform-ratio">16:9</span>
                            <span class="build-dialog__platform-badge build-dialog__platform-badge--original">
                              Original
                            </span>
                          </div>
                          <div
                            class="build-dialog__platform-check"
                            :class="{ 'build-dialog__platform-check--active': selectedRatios.includes('16:9') }"
                          >
                            <CheckIcon v-if="selectedRatios.includes('16:9')" class="build-dialog__platform-check-icon" />
                          </div>
                        </div>
                        <div class="build-dialog__platform-preview">
                          <div
                            class="build-dialog__platform-box build-dialog__platform-box--16-9"
                            :class="{ 'build-dialog__platform-box--selected': selectedRatios.includes('16:9') }"
                          ></div>
                        </div>
                        <div class="build-dialog__platform-platforms">
                          <p class="build-dialog__platform-text">YouTube • Twitch</p>
                        </div>
                      </button>

                      <!-- 9:16 Portrait -->
                      <button
                        @click="toggleRatio('9:16')"
                        class="build-dialog__platform-card"
                        :class="{ 'build-dialog__platform-card--selected': selectedRatios.includes('9:16') }"
                      >
                        <div class="build-dialog__platform-card-header">
                          <span class="build-dialog__platform-ratio">9:16</span>
                          <div
                            class="build-dialog__platform-check"
                            :class="{ 'build-dialog__platform-check--active': selectedRatios.includes('9:16') }"
                          >
                            <CheckIcon v-if="selectedRatios.includes('9:16')" class="build-dialog__platform-check-icon" />
                          </div>
                        </div>
                        <div class="build-dialog__platform-preview">
                          <div
                            class="build-dialog__platform-box build-dialog__platform-box--9-16"
                            :class="{ 'build-dialog__platform-box--selected': selectedRatios.includes('9:16') }"
                          ></div>
                        </div>
                        <div class="build-dialog__platform-platforms">
                          <p class="build-dialog__platform-text">TikTok • Reels</p>
                        </div>
                      </button>

                      <!-- 1:1 Square -->
                      <button
                        @click="toggleRatio('1:1')"
                        class="build-dialog__platform-card"
                        :class="{ 'build-dialog__platform-card--selected': selectedRatios.includes('1:1') }"
                      >
                        <div class="build-dialog__platform-card-header">
                          <span class="build-dialog__platform-ratio">1:1</span>
                          <div
                            class="build-dialog__platform-check"
                            :class="{ 'build-dialog__platform-check--active': selectedRatios.includes('1:1') }"
                          >
                            <CheckIcon v-if="selectedRatios.includes('1:1')" class="build-dialog__platform-check-icon" />
                          </div>
                        </div>
                        <div class="build-dialog__platform-preview">
                          <div
                            class="build-dialog__platform-box build-dialog__platform-box--1-1"
                            :class="{ 'build-dialog__platform-box--selected': selectedRatios.includes('1:1') }"
                          ></div>
                        </div>
                        <div class="build-dialog__platform-platforms">
                          <p class="build-dialog__platform-text">Instagram Feed</p>
                        </div>
                      </button>

                      <!-- 4:5 Portrait -->
                      <button
                        @click="toggleRatio('4:5')"
                        class="build-dialog__platform-card"
                        :class="{ 'build-dialog__platform-card--selected': selectedRatios.includes('4:5') }"
                      >
                        <div class="build-dialog__platform-card-header">
                          <span class="build-dialog__platform-ratio">4:5</span>
                          <div
                            class="build-dialog__platform-check"
                            :class="{ 'build-dialog__platform-check--active': selectedRatios.includes('4:5') }"
                          >
                            <CheckIcon v-if="selectedRatios.includes('4:5')" class="build-dialog__platform-check-icon" />
                          </div>
                        </div>
                        <div class="build-dialog__platform-preview">
                          <div
                            class="build-dialog__platform-box build-dialog__platform-box--4-5"
                            :class="{ 'build-dialog__platform-box--selected': selectedRatios.includes('4:5') }"
                          ></div>
                        </div>
                        <div class="build-dialog__platform-platforms">
                          <p class="build-dialog__platform-text">Instagram Post</p>
                        </div>
                      </button>
                    </div>

                    <!-- Selection summary -->
                    <div v-if="selectedRatios.length > 0" class="build-dialog__selection-summary">
                      <CheckIcon class="build-dialog__selection-icon" />
                      <span class="build-dialog__selection-text">
                        {{ selectedRatios.length }} format{{ selectedRatios.length > 1 ? 's' : '' }} selected
                      </span>
                    </div>
                  </div>
                </Transition>

                <!-- Step 2: Framing -->
                <Transition name="step-slide" mode="out-in">
                  <div v-if="currentStep === 'framing'" key="framing" class="build-dialog__step-content">
                    <div class="build-dialog__step-header">
                      <h3 class="build-dialog__step-title">Framing & Layout</h3>
                      <p class="build-dialog__step-subtitle">Configure cropping for portrait formats</p>
                    </div>

                    <!-- Portrait Framing Mode (only when portrait ratios selected) -->
                    <div v-if="hasPortraitRatio" class="build-dialog__framing-section">
                      <div class="build-dialog__section-header">
                        <CropIcon class="build-dialog__section-icon" />
                        <h4 class="build-dialog__section-title">Portrait Cropping</h4>
                      </div>

                      <!-- Manual mode configuration -->
                      <div class="build-dialog__manual-config">
                        <p class="build-dialog__manual-hint">Configure each aspect ratio:</p>

                        <div class="build-dialog__manual-list">
                          <button
                            v-for="ratio in selectedPortraitRatios"
                            :key="ratio"
                            @click="openPOIEditorForRatio(ratio)"
                            class="build-dialog__ratio-config"
                            :class="{ 'build-dialog__ratio-config--configured': isRatioConfigured(ratio) }"
                          >
                            <div class="build-dialog__ratio-config-left">
                              <div
                                class="build-dialog__ratio-preview"
                                :class="{ 'build-dialog__ratio-preview--configured': isRatioConfigured(ratio) }"
                                :style="{
                                  aspectRatio: ratio.replace(':', '/'),
                                  height: ratio === '1:1' ? '1.5rem' : '2rem',
                                  width: ratio === '1:1' ? '1.5rem' : 'auto',
                                }"
                              ></div>
                              <span class="build-dialog__ratio-label">{{ ratio }}</span>
                            </div>
                            <div class="build-dialog__ratio-config-right">
                              <span
                                v-if="isRatioConfigured(ratio)"
                                class="build-dialog__ratio-status build-dialog__ratio-status--configured"
                              >
                                ✓ {{ getConfigForRatio(ratio)?.regions.length }} region{{
                                  getConfigForRatio(ratio)?.regions.length !== 1 ? 's' : ''
                                }}
                              </span>
                              <span v-else class="build-dialog__ratio-status">Click to configure</span>
                              <ChevronRightIcon class="build-dialog__ratio-chevron" />
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Empty state when no content to show -->
                    <div v-else class="build-dialog__empty-state">
                      <p class="build-dialog__empty-text">No framing options needed for your selected formats.</p>
                    </div>
                  </div>
                </Transition>

                <!-- Step 3: Export Settings -->
                <Transition name="step-slide" mode="out-in">
                  <div v-if="currentStep === 'export'" key="export" class="build-dialog__step-content">
                    <div class="build-dialog__step-header">
                      <h3 class="build-dialog__step-title">Export Settings</h3>
                      <p class="build-dialog__step-subtitle">Configure quality and format options</p>
                    </div>

                    <div class="build-dialog__export-settings">
                      <!-- Quality -->
                      <div class="build-dialog__setting-group">
                        <div class="build-dialog__setting-header">
                          <label class="build-dialog__setting-label">Quality</label>
                          <span class="build-dialog__setting-badge">{{ quality }}</span>
                        </div>
                        <div class="build-dialog__setting-buttons">
                          <button
                            @click="quality = 'low'"
                            class="build-dialog__setting-btn"
                            :class="{ 'build-dialog__setting-btn--active': quality === 'low' }"
                          >
                            Low
                          </button>
                          <button
                            @click="quality = 'medium'"
                            class="build-dialog__setting-btn"
                            :class="{ 'build-dialog__setting-btn--active': quality === 'medium' }"
                          >
                            Medium
                          </button>
                          <button
                            @click="quality = 'high'"
                            class="build-dialog__setting-btn"
                            :class="{ 'build-dialog__setting-btn--active': quality === 'high' }"
                          >
                            High
                          </button>
                        </div>
                        <p class="build-dialog__setting-hint">
                          {{
                            quality === 'low'
                              ? 'Fast export, smaller file size'
                              : quality === 'medium'
                                ? 'Balanced quality and file size'
                                : 'Best quality, larger file size'
                          }}
                        </p>
                      </div>

                      <!-- Frame Rate -->
                      <div class="build-dialog__setting-group">
                        <div class="build-dialog__setting-header">
                          <label class="build-dialog__setting-label">Frame Rate</label>
                          <span class="build-dialog__setting-badge">{{ frameRate }} FPS</span>
                        </div>
                        <div class="build-dialog__setting-buttons">
                          <button
                            @click="frameRate = 30"
                            class="build-dialog__setting-btn"
                            :class="{ 'build-dialog__setting-btn--active': frameRate === 30 }"
                          >
                            30 FPS
                          </button>
                          <button
                            @click="frameRate = 60"
                            class="build-dialog__setting-btn"
                            :class="{ 'build-dialog__setting-btn--active': frameRate === 60 }"
                          >
                            60 FPS
                          </button>
                        </div>
                        <p class="build-dialog__setting-hint">
                          {{ frameRate === 30 ? 'Standard for most platforms' : 'Smoother motion for fast-paced content' }}
                        </p>
                      </div>

                      <!-- Format -->
                      <div class="build-dialog__setting-group">
                        <label class="build-dialog__setting-label">Output Format</label>
                        <div class="build-dialog__setting-buttons">
                          <button
                            @click="outputFormat = 'mp4'"
                            class="build-dialog__setting-btn"
                            :class="{ 'build-dialog__setting-btn--active': outputFormat === 'mp4' }"
                          >
                            MP4
                          </button>
                          <button
                            @click="outputFormat = 'mov'"
                            class="build-dialog__setting-btn"
                            :class="{ 'build-dialog__setting-btn--active': outputFormat === 'mov' }"
                          >
                            MOV
                          </button>
                        </div>
                        <p class="build-dialog__setting-hint">
                          {{
                            outputFormat === 'mp4'
                              ? 'Best compatibility across all platforms'
                              : 'Apple ProRes quality for professional workflows'
                          }}
                        </p>
                      </div>
                    </div>
                  </div>
                </Transition>

                <!-- Step 4: Add-ons -->
                <Transition name="step-slide" mode="out-in">
                  <div v-if="currentStep === 'addons'" key="addons" class="build-dialog__step-content">
                    <div class="build-dialog__step-header">
                      <h3 class="build-dialog__step-title">Add-ons</h3>
                      <p class="build-dialog__step-subtitle">Add intro/outro clips to your video</p>
                    </div>

                    <div class="build-dialog__addons-section">

                      <!-- Campaign Selection (shown only when user has qualifying campaigns) -->
                      <div v-if="availableCampaigns.length > 0" class="build-dialog__field build-dialog__campaign-section">
                        <!-- Checkbox row -->
                        <button
                          type="button"
                          @click="toggleIsForCampaign"
                          class="build-dialog__campaign-toggle"
                        >
                          <div
                            class="build-dialog__campaign-checkbox"
                            :class="{ 'build-dialog__campaign-checkbox--checked': isForCampaign }"
                          >
                            <CheckIcon v-if="isForCampaign" class="build-dialog__campaign-checkbox-icon" />
                          </div>
                          <div class="build-dialog__campaign-toggle-info">
                            <span class="build-dialog__campaign-toggle-label">
                              <Megaphone class="build-dialog__campaign-toggle-icon" />
                              This clip is for a campaign
                            </span>
                            <span class="build-dialog__campaign-toggle-hint">
                              Campaign branding will be applied instead of creator profile branding
                            </span>
                          </div>
                        </button>

                        <!-- Campaign dropdown (shown when checkbox is checked) -->
                        <Transition name="slide-fade">
                          <div v-if="isForCampaign" class="build-dialog__campaign-picker">
                            <label class="build-dialog__field-label">Select Campaign</label>
                            <div class="build-dialog__dropdown-wrapper">
                              <button
                                ref="campaignButtonRef"
                                @click="toggleCampaignDropdown"
                                class="build-dialog__dropdown-trigger"
                              >
                                <div v-if="selectedCampaign" class="build-dialog__campaign-selected">
                                  <div class="build-dialog__campaign-selected-icon">
                                    <img
                                      v-if="selectedCampaign.cover_image_url"
                                      :src="selectedCampaign.cover_image_url"
                                      class="build-dialog__campaign-cover"
                                    />
                                    <Megaphone v-else class="build-dialog__campaign-cover-icon" />
                                  </div>
                                  <div class="build-dialog__campaign-selected-info">
                                    <span class="build-dialog__campaign-selected-title">{{ selectedCampaign.title }}</span>
                                    <span class="build-dialog__campaign-selected-org">{{ selectedCampaign.organization?.name }}</span>
                                  </div>
                                  <span v-if="!selectedCampaign.creator_profile_id" class="build-dialog__badge build-dialog__badge--global">
                                    <Globe class="build-dialog__badge-icon" />
                                    Global
                                  </span>
                                </div>
                                <span v-else class="build-dialog__dropdown-text build-dialog__dropdown-text--placeholder">
                                  Select a campaign...
                                </span>
                                <ChevronDown
                                  class="build-dialog__dropdown-icon"
                                  :class="{ 'build-dialog__dropdown-icon--open': showCampaignDropdown }"
                                />
                              </button>

                              <!-- Campaign dropdown list - Teleported -->
                              <Teleport to="body">
                                <div
                                  v-if="showCampaignDropdown"
                                  ref="campaignDropdownRef"
                                  class="build-dialog__dropdown-menu"
                                  :style="{
                                    top: campaignDropdownPosition.top,
                                    left: campaignDropdownPosition.left,
                                    width: campaignDropdownPosition.width,
                                    maxHeight: campaignDropdownPosition.maxHeight,
                                  }"
                                  @click.stop
                                >
                                  <div v-if="loadingCampaigns" class="build-dialog__dropdown-loading">Loading campaigns...</div>
                                  <template v-else>
                                    <button
                                      v-for="campaign in availableCampaigns"
                                      :key="campaign.id"
                                      @click="selectCampaign(campaign)"
                                      class="build-dialog__dropdown-item build-dialog__campaign-item"
                                      :class="{ 'build-dialog__dropdown-item--selected': selectedCampaign?.id === campaign.id }"
                                    >
                                      <div class="build-dialog__campaign-item-icon">
                                        <img
                                          v-if="campaign.cover_image_url"
                                          :src="campaign.cover_image_url"
                                          class="build-dialog__campaign-cover"
                                        />
                                        <Megaphone v-else class="build-dialog__campaign-cover-icon" />
                                      </div>
                                      <div class="build-dialog__campaign-item-info">
                                        <span class="build-dialog__campaign-item-title">{{ campaign.title }}</span>
                                        <span class="build-dialog__campaign-item-org">{{ campaign.organization?.name }}</span>
                                      </div>
                                      <span v-if="!campaign.creator_profile_id" class="build-dialog__badge build-dialog__badge--global">
                                        <Globe class="build-dialog__badge-icon" />
                                        Global
                                      </span>
                                    </button>
                                  </template>
                                </div>
                              </Teleport>
                            </div>

                            <!-- Campaign branding info notice -->
                            <div v-if="selectedCampaign" class="build-dialog__campaign-notice">
                              <div class="build-dialog__campaign-notice-icon">
                                <CheckIcon class="h-3.5 w-3.5" />
                              </div>
                              <p class="build-dialog__campaign-notice-text">
                                <template v-if="selectedCampaign.creator_profile_id">
                                  Campaign creator profile branding will be applied to this clip.
                                </template>
                                <template v-else>
                                  {{ selectedCampaign.organization?.name }}'s global branding will be applied to this clip.
                                </template>
                              </p>
                            </div>
                          </div>
                        </Transition>
                      </div>

                      <!-- Intro/Outro section - hidden for free tier users -->
                      <div v-if="!isFreeTier" class="build-dialog__intro-outro-section">
                        <!-- Intro Compact Selector -->
                        <div class="build-dialog__field">
                          <div class="build-dialog__field-header">
                            <label class="build-dialog__field-label">Intro</label>
                            <div class="build-dialog__field-badges">
                              <span v-if="isForCampaign && campaignIntro" class="build-dialog__badge build-dialog__badge--campaign">
                                <Megaphone class="build-dialog__badge-icon" />
                                Campaign
                              </span>
                              <span v-else-if="!isForCampaign && creatorProfileIntro" class="build-dialog__badge build-dialog__badge--org">
                                <Building2 class="build-dialog__badge-icon" />
                                Creator Profile
                              </span>
                              <span v-else-if="selectedIntro?.isOrgAsset" class="build-dialog__badge build-dialog__badge--org">
                                <Building2 class="build-dialog__badge-icon" />
                                Org
                              </span>
                            </div>
                          </div>
                          <div class="build-dialog__dropdown-wrapper">
                            <button
                              ref="introButtonRef"
                              @click="!introLockedByCampaign && toggleIntroDropdown()"
                              class="build-dialog__dropdown-trigger"
                              :class="{ 'build-dialog__dropdown-trigger--locked': introLockedByCampaign }"
                              :disabled="introLockedByCampaign"
                            >
                              <span class="build-dialog__dropdown-text">
                                {{ selectedIntro ? `${selectedIntro.name} (${formatDuration(selectedIntro.duration || 0)})` : 'None' }}
                              </span>
                              <ChevronDown
                                class="build-dialog__dropdown-icon"
                                :class="{ 'build-dialog__dropdown-icon--open': showIntroDropdown }"
                              />
                            </button>

                            <!-- Dropdown - Teleported -->
                            <Teleport to="body">
                              <div
                                v-if="showIntroDropdown"
                                ref="introDropdownRef"
                                class="build-dialog__dropdown-menu"
                                :style="{
                                  top: introDropdownPosition.top,
                                  left: introDropdownPosition.left,
                                  width: introDropdownPosition.width,
                                  maxHeight: introDropdownPosition.maxHeight,
                                }"
                                @click.stop
                              >
                                <button
                                  @click="selectIntro(null)"
                                  class="build-dialog__dropdown-item build-dialog__dropdown-item--first"
                                  :class="{ 'build-dialog__dropdown-item--selected': !selectedIntro }"
                                >
                                  None
                                </button>
                                <button
                                  v-for="intro in intros"
                                  :key="intro.id"
                                  @click="selectIntro(intro)"
                                  class="build-dialog__dropdown-item"
                                  :class="{ 'build-dialog__dropdown-item--selected': selectedIntro?.id === intro.id }"
                                >
                                  <div class="build-dialog__dropdown-item-content">
                                    <div class="build-dialog__dropdown-item-left">
                                      <span class="build-dialog__dropdown-item-name">{{ intro.name }}</span>
                                      <span v-if="intro.isOrgAsset" class="build-dialog__badge build-dialog__badge--org-small">
                                        <Building2 class="build-dialog__badge-icon" />
                                        {{ intro.organization_name || 'Org' }}
                                      </span>
                                    </div>
                                    <span class="build-dialog__dropdown-item-duration">
                                      {{ formatDuration(intro.duration || 0) }}
                                    </span>
                                  </div>
                                </button>
                                <div v-if="loadingAssets" class="build-dialog__dropdown-loading">Loading...</div>
                                <div v-if="!loadingAssets && intros.length === 0" class="build-dialog__dropdown-empty">
                                  No intros available
                                </div>
                              </div>
                            </Teleport>
                          </div>
                        </div>

                        <!-- Outro Compact Selector -->
                        <div class="build-dialog__field">
                          <div class="build-dialog__field-header">
                            <label class="build-dialog__field-label">Outro</label>
                            <div class="build-dialog__field-badges">
                              <span v-if="isForCampaign && campaignOutro" class="build-dialog__badge build-dialog__badge--campaign">
                                <Megaphone class="build-dialog__badge-icon" />
                                Campaign
                              </span>
                              <span v-else-if="!isForCampaign && creatorProfileOutro" class="build-dialog__badge build-dialog__badge--org">
                                <Building2 class="build-dialog__badge-icon" />
                                Creator Profile
                              </span>
                              <span v-else-if="selectedOutro?.isOrgAsset" class="build-dialog__badge build-dialog__badge--org">
                                <Building2 class="build-dialog__badge-icon" />
                                Org
                              </span>
                            </div>
                          </div>
                          <div class="build-dialog__dropdown-wrapper">
                            <button
                              ref="outroButtonRef"
                              @click="!outroLockedByCampaign && toggleOutroDropdown()"
                              class="build-dialog__dropdown-trigger"
                              :class="{ 'build-dialog__dropdown-trigger--locked': outroLockedByCampaign }"
                              :disabled="outroLockedByCampaign"
                            >
                              <span class="build-dialog__dropdown-text">
                                {{ selectedOutro ? `${selectedOutro.name} (${formatDuration(selectedOutro.duration || 0)})` : 'None' }}
                              </span>
                              <ChevronDown
                                class="build-dialog__dropdown-icon"
                                :class="{ 'build-dialog__dropdown-icon--open': showOutroDropdown }"
                              />
                            </button>

                            <!-- Dropdown - Teleported -->
                            <Teleport to="body">
                              <div
                                v-if="showOutroDropdown"
                                ref="outroDropdownRef"
                                class="build-dialog__dropdown-menu"
                                :style="{
                                  top: outroDropdownPosition.top,
                                  left: outroDropdownPosition.left,
                                  width: outroDropdownPosition.width,
                                  maxHeight: outroDropdownPosition.maxHeight,
                                }"
                                @click.stop
                              >
                                <button
                                  @click="selectOutro(null)"
                                  class="build-dialog__dropdown-item build-dialog__dropdown-item--first"
                                  :class="{ 'build-dialog__dropdown-item--selected': !selectedOutro }"
                                >
                                  None
                                </button>
                                <button
                                  v-for="outro in outros"
                                  :key="outro.id"
                                  @click="selectOutro(outro)"
                                  class="build-dialog__dropdown-item"
                                  :class="{ 'build-dialog__dropdown-item--selected': selectedOutro?.id === outro.id }"
                                >
                                  <div class="build-dialog__dropdown-item-content">
                                    <div class="build-dialog__dropdown-item-left">
                                      <span class="build-dialog__dropdown-item-name">{{ outro.name }}</span>
                                      <span v-if="outro.isOrgAsset" class="build-dialog__badge build-dialog__badge--org-small">
                                        <Building2 class="build-dialog__badge-icon" />
                                        {{ outro.organization_name || 'Org' }}
                                      </span>
                                    </div>
                                    <span class="build-dialog__dropdown-item-duration">
                                      {{ formatDuration(outro.duration || 0) }}
                                    </span>
                                  </div>
                                </button>
                                <div v-if="loadingAssets" class="build-dialog__dropdown-loading">Loading...</div>
                                <div v-if="!loadingAssets && outros.length === 0" class="build-dialog__dropdown-empty">
                                  No outros available
                                </div>
                              </div>
                            </Teleport>
                          </div>
                        </div>

                        <!-- Duration Summary -->
                        <div v-if="selectedIntro || selectedOutro" class="build-dialog__duration-summary">
                          <span class="build-dialog__duration-label">Total Duration</span>
                          <span class="build-dialog__duration-value">{{ formatDuration(totalDuration) }}</span>
                        </div>
                      </div>
                      <!-- End intro/outro section -->
                    </div>
                  </div>
                </Transition>

                <!-- Step 5: Publish -->
                <Transition name="step-slide" mode="out-in">
                  <div v-if="currentStep === 'publish'" key="publish" class="schedule-dialog__step-content">
                    <div class="schedule-dialog__content">
                      <form class="schedule-dialog__form" @submit.prevent="handlePublish">
                        <!-- Clip Preview -->
                        <div class="schedule-dialog__field">
                          <label class="schedule-dialog__label">Clip Preview</label>
                          <div class="schedule-dialog__clip-preview">
                            <div class="schedule-dialog__clip-thumbnail">
                              <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="Clip thumbnail" />
                              <FileVideo v-else :size="32" class="text-zinc-600" />
                            </div>
                            <div class="schedule-dialog__clip-info">
                              <h3 class="schedule-dialog__clip-name">{{ clip?.current_version_name || clip?.name || 'Untitled Clip' }}</h3>
                              <div class="schedule-dialog__clip-meta">
                                <span v-if="clipDuration">{{ formatDuration(clipDuration) }}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <!-- Build Progress -->
                        <div v-if="buildState.status === 'building'" class="schedule-dialog__alert schedule-dialog__alert--info">
                          <Loader2 :size="16" class="schedule-dialog__spinner" />
                          <div class="schedule-dialog__build-info">
                            <span>Building clip... {{ buildState.progress }}%</span>
                            <div class="schedule-dialog__progress-bar">
                              <div class="schedule-dialog__progress-fill" :style="{ width: `${buildState.progress}%` }"></div>
                            </div>
                          </div>
                        </div>
                        <div v-else-if="buildState.status === 'error'" class="schedule-dialog__alert schedule-dialog__alert--error">
                          <AlertCircle :size="16" />
                          <p class="schedule-dialog__alert-text">Build failed: {{ buildState.error }}</p>
                        </div>

                        <!-- Platform Selection with Aspect Ratios -->
                        <div class="schedule-dialog__field">
                          <label class="schedule-dialog__label">Platforms *</label>
                          
                          <!-- Platform Grid (2 columns) -->
                          <div class="schedule-dialog__platform-grid">
                            <label
                              v-for="platform in availablePlatforms"
                              :key="platform.id"
                              class="schedule-dialog__platform-option"
                              :class="{ 'schedule-dialog__platform-option--selected': isPlatformSelected(platform.id) }"
                            >
                              <input
                                type="checkbox"
                                :checked="isPlatformSelected(platform.id)"
                                @change="togglePlatform(platform.id)"
                                class="schedule-dialog__checkbox"
                              />
                              <component :is="platform.icon" :size="16" />
                              <span>{{ platform.label }}</span>
                            </label>
                          </div>
                          
                          <!-- Aspect Ratio Selectors (shown below for selected platforms) -->
                          <div v-if="selectedPublishPlatforms.length > 0 && selectedRatios.length > 1" class="schedule-dialog__aspect-ratio-rows">
                            <div
                              v-for="platformId in selectedPublishPlatforms"
                              :key="platformId"
                              class="schedule-dialog__aspect-ratio-row"
                            >
                              <div class="schedule-dialog__aspect-ratio-label">
                                <component :is="getPlatformIcon(platformId)" :size="14" />
                                <span>{{ getPlatformLabel(platformId) }} aspect ratio:</span>
                              </div>
                              <div class="relative flex-1">
                                <button
                                  @click="toggleAspectRatioDropdown(platformId)"
                                  class="schedule-dialog__input schedule-dialog__select-button"
                                >
                                  <span class="truncate">
                                    {{ platformConfigs[platformId]?.aspectRatio || 'Select...' }}
                                  </span>
                                  <ChevronDown
                                    class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform"
                                    :class="{ 'rotate-180': activeAspectRatioDropdown === platformId }"
                                  />
                                </button>

                                <!-- Dropdown -->
                                <div v-if="activeAspectRatioDropdown === platformId" class="schedule-dialog__dropdown">
                                  <button
                                    v-for="ratio in selectedRatios"
                                    :key="ratio"
                                    @click="selectAspectRatio(platformId, ratio)"
                                    class="schedule-dialog__dropdown-item"
                                    :class="{ 'schedule-dialog__dropdown-item--selected': platformConfigs[platformId]?.aspectRatio === ratio }"
                                  >
                                    {{ ratio }}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <p v-if="selectedPublishPlatforms.length === 0" class="schedule-dialog__field-hint schedule-dialog__field-hint--error">
                            Please select at least one platform
                          </p>
                        </div>

                        <!-- Account Selection -->
                        <div v-if="selectedPublishPlatforms.length > 0" class="schedule-dialog__field">
                          <label class="schedule-dialog__label">Accounts *</label>
                          <div class="schedule-dialog__account-configs">
                            <div
                              v-for="platformId in selectedPublishPlatforms"
                              :key="platformId"
                              class="schedule-dialog__account-config"
                            >
                              <div class="schedule-dialog__account-config-label">
                                <component :is="getPlatformIcon(platformId)" :size="14" />
                                <span>{{ getPlatformLabel(platformId) }}</span>
                                <span class="schedule-dialog__account-aspect-ratio">({{ platformConfigs[platformId]?.aspectRatio }})</span>
                              </div>
                              <div class="relative">
                                <button
                                  @click="toggleAccountDropdown(platformId)"
                                  class="schedule-dialog__input schedule-dialog__select-button"
                                >
                                  <span class="truncate">
                                    {{ getSelectedAccountLabel(platformId) || 'Select account...' }}
                                  </span>
                                  <ChevronDown
                                    class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform"
                                    :class="{ 'rotate-180': activeAccountDropdown === platformId }"
                                  />
                                </button>

                                <!-- Dropdown -->
                                <div v-if="activeAccountDropdown === platformId" class="schedule-dialog__dropdown">
                                  <button
                                    @click="selectAccount(platformId, '')"
                                    class="schedule-dialog__dropdown-item"
                                    :class="{ 'schedule-dialog__dropdown-item--selected': !platformConfigs[platformId]?.accountId }"
                                  >
                                    Select account...
                                  </button>
                                  <template v-if="getOrgAccountsForPlatform(platformId).length > 0">
                                    <div class="schedule-dialog__dropdown-group-label">Organization</div>
                                    <button
                                      v-for="account in getOrgAccountsForPlatform(platformId)"
                                      :key="`org-${account.id}`"
                                      @click="selectAccount(platformId, `org:${account.id}`)"
                                      class="schedule-dialog__dropdown-item"
                                      :class="{ 'schedule-dialog__dropdown-item--selected': platformConfigs[platformId]?.accountId === `org:${account.id}` }"
                                    >
                                      @{{ account.username }}
                                    </button>
                                  </template>
                                  <template v-if="getPersonalAccountsForPlatform(platformId).length > 0">
                                    <div class="schedule-dialog__dropdown-group-label">Personal</div>
                                    <button
                                      v-for="account in getPersonalAccountsForPlatform(platformId)"
                                      :key="`user-${account.id}`"
                                      @click="selectAccount(platformId, `user:${account.id}`)"
                                      class="schedule-dialog__dropdown-item"
                                      :class="{ 'schedule-dialog__dropdown-item--selected': platformConfigs[platformId]?.accountId === `user:${account.id}` }"
                                    >
                                      @{{ account.username }}
                                    </button>
                                  </template>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <!-- Caption -->
                        <div class="schedule-dialog__field">
                          <label class="schedule-dialog__label">Caption</label>
                          <textarea
                            v-model="caption"
                            rows="3"
                            :maxlength="2200"
                            placeholder="Add a caption for your post..."
                            class="schedule-dialog__input schedule-dialog__textarea"
                          ></textarea>
                          <div class="schedule-dialog__caption-info">
                            <p class="schedule-dialog__field-hint">
                              {{ caption.length }} / 2200
                            </p>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Footer with Navigation -->
            <div class="build-dialog__footer">
              <!-- Back button or spacer -->
              <div class="build-dialog__footer-left">
                <button v-if="!isFirstStep" @click="previousStep" :disabled="isBuilding" class="build-dialog__btn build-dialog__btn--back">
                  <ArrowLeftIcon class="build-dialog__btn-icon" />
                  Back
                </button>
              </div>

              <!-- Step info -->
              <div class="build-dialog__step-info">Step {{ currentStepIndex + 1 }} of {{ visibleSteps.length }}</div>

              <!-- Next/Publish button -->
              <div class="build-dialog__footer-right">
                <button
                  v-if="!isLastStep"
                  @click="nextStep"
                  :disabled="!canProceed"
                  class="build-dialog__btn build-dialog__btn--next"
                  :class="{ 'build-dialog__btn--disabled': !canProceed }"
                >
                  Next
                  <ArrowRightIcon class="build-dialog__btn-icon" />
                </button>
                <button
                  v-else
                  @click="handlePublish"
                  :disabled="!canPublish || isBuilding"
                  class="build-dialog__btn build-dialog__btn--primary"
                  :class="{ 'build-dialog__btn--disabled': !canPublish || isBuilding }"
                >
                  <Loader2 v-if="isBuilding" class="schedule-dialog__spinner" />
                  <Share2 v-else class="build-dialog__btn-icon" />
                  <span>{{ isBuilding ? 'Building...' : `Publish (${selectedPublishPlatforms.length})` }}</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- Manual POI Editor Dialog -->
    <ManualPOIEditor
      v-model="showManualPOIEditor"
      :initial-config="getConfigForRatio(editingAspectRatio)"
      :target-aspect-ratio="editingAspectRatio"
      :source-aspect-ratio="'16:9'"
      :thumbnail-url="videoFrameUrl || thumbnailUrl"
      :video-path="videoPath"
      :clip-start-time="clipStartTime"
      :clip-end-time="clipEndTime"
      :watermark-settings="watermarkSettings"
      @confirm="onManualConfigConfirm"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  X,
  Rocket,
  CheckIcon,
  ChevronRightIcon,
  ChevronDown,
  CropIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  LayoutGridIcon,
  SettingsIcon,
  SparkleIcon,
  Share2,
  Megaphone,
  Loader2,
  AlertCircle,
  Instagram,
  Youtube,
  FileVideo,
  Building2,
  Globe,
} from 'lucide-vue-next';
import XLogo from '@/components/icons/XLogo.vue';
import TiktokLogo from '@/components/icons/TiktokLogo.vue';
import ManualPOIEditor from './poi/ManualPOIEditor.vue';
import type { ClipWithVersion, WatermarkSettings } from '@/services/database';
import type { ManualFramingConfig, ManualFramingConfigs } from '@/types';
import { getAllIntroOutros, type IntroOutro } from '@/services/database';
import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
import { ensureAssetDownloaded } from '@/services/orgAssetSync';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '@/stores/auth';
import { useFreeTierLimits } from '@/composables/useFreeTierLimits';
import { useClipBuildPipeline } from '@/composables/useClipBuildPipeline';
import { useBackgroundPublish, type PublishTarget } from '@/composables/useBackgroundPublish';
import { getMyGlobalBrandingCampaigns, getCampaignsByCreatorProfile, type Campaign } from '@/services/campaignApi';
import { listSocialAccounts, type SocialAccount } from '@/services/socialAccountsApi';
import { listUserTwitterAccounts, type UserTwitterAccount } from '@/services/userTwitterApi';
import { listUserTiktokAccounts, type UserTiktokAccount } from '@/services/userTiktokApi';
import { listUserInstagramAccounts, type UserInstagramAccount } from '@/services/userInstagramApi';
import { listUserYoutubeAccounts, type UserYoutubeAccount } from '@/services/userYoutubeApi';

interface IntroOutroItem extends Omit<IntroOutro, 'id'> {
  id: string;
  isOrgAsset?: boolean;
  serverId?: number;
  serverUrl?: string;
}

type StepId = 'platforms' | 'framing' | 'export' | 'addons' | 'publish';

interface Step {
  id: StepId;
  label: string;
  icon: typeof LayoutGridIcon;
}

const allSteps: Step[] = [
  { id: 'platforms', label: 'Platforms', icon: LayoutGridIcon },
  { id: 'framing', label: 'Framing', icon: CropIcon },
  { id: 'export', label: 'Export', icon: SettingsIcon },
  { id: 'addons', label: 'Add-ons', icon: SparkleIcon },
  { id: 'publish', label: 'Publish', icon: Share2 },
];

const aspectRatioOptions = [
  { value: '16:9', platforms: 'YouTube • Twitch' },
  { value: '9:16', platforms: 'TikTok • Reels' },
  { value: '1:1', platforms: 'Instagram Feed' },
  { value: '4:5', platforms: 'Instagram Post' },
];

const availablePlatforms = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'twitter', label: 'X (Twitter)', icon: XLogo },
  { id: 'tiktok', label: 'TikTok', icon: TiktokLogo },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
];

const props = defineProps<{
  modelValue: boolean;
  clip: ClipWithVersion | null;
  clipPath: string;
  projectId: string;
  watermarkSettings?: WatermarkSettings | null;
  thumbnailUrl?: string | null;
  creatorProfileServerId?: number | null;
  platform?: 'PumpFun' | 'Kick' | 'Twitch' | 'YouTube' | 'Rumble' | 'Twitter';
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'published': [];
  'close': [];
}>();

const authStore = useAuthStore();
const { isFreeTier } = useFreeTierLimits();
const buildPipeline = useClipBuildPipeline();
const backgroundPublish = useBackgroundPublish();

// Step state
const currentStep = ref<StepId>('platforms');

// Build settings (Step 1-4)
const selectedRatios = ref<string[]>(['16:9']);
const quality = ref<'low' | 'medium' | 'high'>('high');
const frameRate = ref<30 | 60>(30);
const outputFormat = ref<'mp4' | 'mov'>('mp4');
const manualFramingConfigs = ref<ManualFramingConfigs>({});
const showManualPOIEditor = ref(false);
const editingAspectRatio = ref<string>('9:16');
const videoFrameUrl = ref<string | null>(null);
const videoPath = ref<string | null>(null);
const loadingVideoFrame = ref(false);

// Add-ons (Step 4)
const intros = ref<IntroOutroItem[]>([]);
const outros = ref<IntroOutroItem[]>([]);
const selectedIntroId = ref<string | null>(null);
const selectedOutroId = ref<string | null>(null);
const isForCampaign = ref(false);
const availableCampaigns = ref<Campaign[]>([]);
const selectedCampaignId = ref<number | null>(null);
const loadingAssets = ref(false);

// Dropdown state for intro/outro
const introButtonRef = ref<HTMLElement | null>(null);
const outroButtonRef = ref<HTMLElement | null>(null);
const introDropdownRef = ref<HTMLElement | null>(null);
const outroDropdownRef = ref<HTMLElement | null>(null);
const showIntroDropdown = ref(false);
const showOutroDropdown = ref(false);
const introDropdownPosition = ref({ top: '0px', left: '0px', width: '0px', maxHeight: '300px' });
const outroDropdownPosition = ref({ top: '0px', left: '0px', width: '0px', maxHeight: '300px' });

// Dropdown state for campaign
const campaignButtonRef = ref<HTMLElement | null>(null);
const campaignDropdownRef = ref<HTMLElement | null>(null);
const showCampaignDropdown = ref(false);
const campaignDropdownPosition = ref({ top: '0px', left: '0px', width: '0px', maxHeight: '300px' });
const loadingCampaigns = ref(false);
const creatorProfileData = ref<any>(null);
const globalBrandingProfile = ref<any>(null);

// Publish settings (Step 5)
interface PlatformConfig {
  aspectRatio: string;
  accountId: string;
}
const platformConfigs = ref<Record<string, PlatformConfig>>({});
const caption = ref('');
const loadingAccounts = ref(true);
const orgAccounts = ref<SocialAccount[]>([]);
const personalTwitterAccounts = ref<UserTwitterAccount[]>([]);
const personalTiktokAccounts = ref<UserTiktokAccount[]>([]);
const personalInstagramAccounts = ref<UserInstagramAccount[]>([]);
const personalYoutubeAccounts = ref<UserYoutubeAccount[]>([]);
const activeAccountDropdown = ref<string | null>(null);
const activeAspectRatioDropdown = ref<string | null>(null);
const hasQueuedBackgroundPublish = ref(false);

// Computed
const buildState = computed(() => buildPipeline.state.value);
const isBuilding = computed(() => buildState.value.status === 'building');

const clipDuration = computed(() => {
  if (!props.clip?.current_version_end_time || !props.clip?.current_version_start_time) {
    return props.clip?.duration || 0;
  }
  return props.clip.current_version_end_time - props.clip.current_version_start_time;
});

// For livestream clips, the extracted clip starts at 0 and ends at the clip duration
// The clip file itself is the source, not a segment of a larger video
const clipStartTime = computed(() => 0);
const clipEndTime = computed(() => clipDuration.value);

const hasPortraitRatio = computed(() => {
  const portraitRatios = ['9:16', '4:5', '1:1'];
  return selectedRatios.value.some((r) => portraitRatios.includes(r));
});

const selectedPortraitRatios = computed(() => {
  const portraitRatios = ['9:16', '4:5', '1:1'];
  return selectedRatios.value.filter((r) => portraitRatios.includes(r));
});

const visibleSteps = computed(() => {
  return allSteps.filter((step) => {
    if (step.id === 'framing') {
      return hasPortraitRatio.value;
    }
    return true;
  });
});

const currentStepIndex = computed(() => {
  return visibleSteps.value.findIndex((s) => s.id === currentStep.value);
});

const isFirstStep = computed(() => currentStepIndex.value === 0);
const isLastStep = computed(() => currentStepIndex.value === visibleSteps.value.length - 1);

const selectedPublishPlatforms = computed(() => Object.keys(platformConfigs.value));

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 'platforms':
      return selectedRatios.value.length > 0;
    case 'framing':
    case 'export':
    case 'addons':
      return true;
    case 'publish':
      return selectedPublishPlatforms.value.length > 0;
    default:
      return true;
  }
});

const canPublish = computed(() => {
  if (selectedPublishPlatforms.value.length === 0) return false;
  for (const platformId of selectedPublishPlatforms.value) {
    const config = platformConfigs.value[platformId];
    if (!config?.accountId || !config?.aspectRatio) return false;
  }
  return true;
});

const selectedCampaign = computed(() => availableCampaigns.value.find((c) => c.id === selectedCampaignId.value) || null);

// Campaign intro/outro - when campaign is selected, use campaign assets and lock the selection
const campaignIntro = computed<IntroOutroItem | null>(() => {
  const campaign = selectedCampaign.value;
  console.log('[QuickPublishWizard] campaignIntro computed - campaign:', campaign?.title, 'has global_intro:', !!campaign?.global_intro);
  if (!campaign?.global_intro) return null;
  console.log('[QuickPublishWizard] campaignIntro returning:', campaign.global_intro.name);
  return {
    id: `campaign-intro-${campaign.global_intro.id}`,
    type: 'intro',
    name: campaign.global_intro.name,
    file_path: campaign.global_intro.url,
    serverUrl: campaign.global_intro.url,
    serverId: campaign.global_intro.id,
    duration: campaign.global_intro.duration ? parseFloat(campaign.global_intro.duration) : null,
    thumbnail_path: campaign.global_intro.thumbnail_url || null,
    thumbnail_generation_status: 'completed' as const,
    organization_id: String(campaign.organization_id),
    organization_name: campaign.organization?.name || null,
    isOrgAsset: true,
    created_at: Date.now(),
    updated_at: Date.now(),
  } as any;
});

const campaignOutro = computed<IntroOutroItem | null>(() => {
  const campaign = selectedCampaign.value;
  console.log('[QuickPublishWizard] campaignOutro computed - campaign:', campaign?.title, 'has global_outro:', !!campaign?.global_outro);
  if (!campaign?.global_outro) return null;
  console.log('[QuickPublishWizard] campaignOutro returning:', campaign.global_outro.name);
  return {
    id: `campaign-outro-${campaign.global_outro.id}`,
    type: 'outro',
    name: campaign.global_outro.name,
    file_path: campaign.global_outro.url,
    serverUrl: campaign.global_outro.url,
    serverId: campaign.global_outro.id,
    duration: campaign.global_outro.duration ? parseFloat(campaign.global_outro.duration) : null,
    thumbnail_path: campaign.global_outro.thumbnail_url || null,
    thumbnail_generation_status: 'completed' as const,
    organization_id: String(campaign.organization_id),
    organization_name: campaign.organization?.name || null,
    isOrgAsset: true,
    created_at: Date.now(),
    updated_at: Date.now(),
  } as any;
});

// Creator profile intro/outro - when creator profile has assets, use those and lock the selection
const creatorProfileIntro = computed<IntroOutroItem | null>(() => {
  // Only apply creator profile branding if NOT in campaign mode
  if (isForCampaign.value) return null;
  
  // Priority 1: Use assigned organization creator profile
  // Organization creator profiles have their intro/outro assets loaded via getUserOrganizationAssets
  // The creatorProfileServerId is the server-side creator profile ID
  if (props.creatorProfileServerId && creatorProfileData.value?.intro_id) {
    // Look for org asset with matching server ID
    const introAsset = intros.value.find(i => 
      i.isOrgAsset && i.serverId === creatorProfileData.value.intro_id
    );
    if (introAsset) return introAsset;
  }
  
  // Priority 2: Fall back to local global branding if no creator profile assigned
  if (!props.creatorProfileServerId && globalBrandingProfile.value?.intro_id) {
    // For local global branding, match by local ID
    const introAsset = intros.value.find(i => 
      !i.isOrgAsset && i.id === globalBrandingProfile.value.intro_id
    );
    if (introAsset) return introAsset;
  }
  
  return null;
});

const creatorProfileOutro = computed<IntroOutroItem | null>(() => {
  // Only apply creator profile branding if NOT in campaign mode
  if (isForCampaign.value) return null;
  
  // Priority 1: Use assigned organization creator profile
  if (props.creatorProfileServerId && creatorProfileData.value?.outro_id) {
    // Look for org asset with matching server ID
    const outroAsset = outros.value.find(o => 
      o.isOrgAsset && o.serverId === creatorProfileData.value.outro_id
    );
    if (outroAsset) return outroAsset;
  }
  
  // Priority 2: Fall back to local global branding if no creator profile assigned
  if (!props.creatorProfileServerId && globalBrandingProfile.value?.outro_id) {
    // For local global branding, match by local ID
    const outroAsset = outros.value.find(o => 
      !o.isOrgAsset && o.id === globalBrandingProfile.value.outro_id
    );
    if (outroAsset) return outroAsset;
  }
  
  return null;
});

// Priority order: Campaign > Creator Profile > Manual Selection
const selectedIntro = computed(() => {
  console.log('[QuickPublishWizard] selectedIntro computed - isForCampaign:', isForCampaign.value, 'campaignIntro:', campaignIntro.value?.name, 'creatorProfileIntro:', creatorProfileIntro.value?.name, 'selectedIntroId:', selectedIntroId.value);
  // Campaign takes highest priority
  if (isForCampaign.value && campaignIntro.value) return campaignIntro.value;
  // Creator profile branding takes second priority
  if (creatorProfileIntro.value) return creatorProfileIntro.value;
  // Manual selection is lowest priority
  return intros.value.find((i) => i.id === selectedIntroId.value) || null;
});

const selectedOutro = computed(() => {
  console.log('[QuickPublishWizard] selectedOutro computed - isForCampaign:', isForCampaign.value, 'campaignOutro:', campaignOutro.value?.name, 'creatorProfileOutro:', creatorProfileOutro.value?.name, 'selectedOutroId:', selectedOutroId.value);
  // Campaign takes highest priority
  if (isForCampaign.value && campaignOutro.value) return campaignOutro.value;
  // Creator profile branding takes second priority
  if (creatorProfileOutro.value) return creatorProfileOutro.value;
  // Manual selection is lowest priority
  return outros.value.find((o) => o.id === selectedOutroId.value) || null;
});

// Check if intro/outro selection is locked by campaign or creator profile
const introLockedByCampaign = computed(() => {
  // Locked if campaign has intro
  if (isForCampaign.value && campaignIntro.value) return true;
  // Locked if creator profile has intro (and not in campaign mode)
  if (!isForCampaign.value && creatorProfileIntro.value) return true;
  return false;
});

const outroLockedByCampaign = computed(() => {
  // Locked if campaign has outro
  if (isForCampaign.value && campaignOutro.value) return true;
  // Locked if creator profile has outro (and not in campaign mode)
  if (!isForCampaign.value && creatorProfileOutro.value) return true;
  return false;
});
const orgId = computed<number | null>(() => {
  const campaignOrgId = isForCampaign.value ? selectedCampaign.value?.organization_id : null;
  if (typeof campaignOrgId === 'number') {
    return campaignOrgId;
  }

  const id = authStore.user?.owned_organization_id;
  return typeof id === 'number' ? id : null;
});

const totalDuration = computed(() => {
  let duration = clipDuration.value;
  if (selectedIntro.value?.duration) duration += selectedIntro.value.duration;
  if (selectedOutro.value?.duration) duration += selectedOutro.value.duration;
  return duration;
});

// Step navigation
function isStepCompleted(stepId: StepId): boolean {
  const stepIndex = visibleSteps.value.findIndex((s) => s.id === stepId);
  return stepIndex < currentStepIndex.value;
}

function canNavigateToStep(stepId: StepId): boolean {
  const stepIndex = visibleSteps.value.findIndex((s) => s.id === stepId);
  if (stepIndex <= currentStepIndex.value) return true;
  if (stepIndex === currentStepIndex.value + 1 && canProceed.value) return true;
  return false;
}

function goToStep(stepId: StepId) {
  if (canNavigateToStep(stepId) && !isBuilding.value) {
    currentStep.value = stepId;
  }
}

function nextStep() {
  if (!isLastStep.value && canProceed.value) {
    const nextIndex = currentStepIndex.value + 1;
    if (nextIndex < visibleSteps.value.length) {
      const nextStepId = visibleSteps.value[nextIndex].id;
      currentStep.value = nextStepId;
      
      // Start build when moving to publish step
      if (nextStepId === 'publish') {
        startBuildProcess();
      }
    }
  }
}

function previousStep() {
  if (!isFirstStep.value && !isBuilding.value) {
    const prevIndex = currentStepIndex.value - 1;
    if (prevIndex >= 0) {
      currentStep.value = visibleSteps.value[prevIndex].id;
    }
  }
}

// Aspect ratio selection
function toggleRatio(ratio: string) {
  const index = selectedRatios.value.indexOf(ratio);
  if (index > -1) {
    selectedRatios.value.splice(index, 1);
  } else {
    selectedRatios.value.push(ratio);
  }
}

// Framing
function isRatioConfigured(ratio: string): boolean {
  const config = manualFramingConfigs.value[ratio as keyof ManualFramingConfigs];
  return config !== undefined && config.regions.length > 0;
}

function getConfigForRatio(ratio: string): ManualFramingConfig | null {
  return manualFramingConfigs.value[ratio as keyof ManualFramingConfigs] || null;
}

function openPOIEditorForRatio(ratio: string) {
  editingAspectRatio.value = ratio;
  showManualPOIEditor.value = true;
}

function onManualConfigConfirm(config: ManualFramingConfig) {
  const ratio = config.targetAspectRatio as keyof ManualFramingConfigs;
  manualFramingConfigs.value = {
    ...manualFramingConfigs.value,
    [ratio]: config,
  };
}

// Intro/Outro dropdown functions
function toggleIntroDropdown() {
  if (showIntroDropdown.value) {
    showIntroDropdown.value = false;
  } else {
    showOutroDropdown.value = false;
    updateDropdownPosition(introButtonRef.value, introDropdownPosition);
    showIntroDropdown.value = true;
  }
}

function toggleOutroDropdown() {
  if (showOutroDropdown.value) {
    showOutroDropdown.value = false;
  } else {
    showIntroDropdown.value = false;
    updateDropdownPosition(outroButtonRef.value, outroDropdownPosition);
    showOutroDropdown.value = true;
  }
}

function updateDropdownPosition(buttonEl: HTMLElement | null, positionRef: typeof introDropdownPosition) {
  if (!buttonEl) return;
  const rect = buttonEl.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - rect.bottom;
  const maxHeight = Math.min(300, spaceBelow - 20);
  
  positionRef.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    maxHeight: `${maxHeight}px`,
  };
}

function selectIntro(intro: IntroOutroItem | null) {
  selectedIntroId.value = intro?.id || null;
  showIntroDropdown.value = false;
}

function selectOutro(outro: IntroOutroItem | null) {
  selectedOutroId.value = outro?.id || null;
  showOutroDropdown.value = false;
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node;
  
  if (showIntroDropdown.value) {
    if (!introButtonRef.value?.contains(target) && !introDropdownRef.value?.contains(target)) {
      showIntroDropdown.value = false;
    }
  }
  if (showOutroDropdown.value) {
    if (!outroButtonRef.value?.contains(target) && !outroDropdownRef.value?.contains(target)) {
      showOutroDropdown.value = false;
    }
  }
  if (showCampaignDropdown.value) {
    if (!campaignButtonRef.value?.contains(target) && !campaignDropdownRef.value?.contains(target)) {
      showCampaignDropdown.value = false;
    }
  }
  // Close account dropdown when clicking outside
  if (activeAccountDropdown.value) {
    const clickedInsideDropdown = (target as Element).closest('.schedule-dialog__dropdown');
    const clickedInsideButton = (target as Element).closest('.schedule-dialog__select-button');
    if (!clickedInsideDropdown && !clickedInsideButton) {
      activeAccountDropdown.value = null;
    }
  }
  // Close aspect ratio dropdown when clicking outside
  if (activeAspectRatioDropdown.value) {
    const clickedInsideDropdown = (target as Element).closest('.schedule-dialog__dropdown');
    const clickedInsideButton = (target as Element).closest('.schedule-dialog__select-button');
    if (!clickedInsideDropdown && !clickedInsideButton) {
      activeAspectRatioDropdown.value = null;
    }
  }
}

// Campaign
function toggleIsForCampaign() {
  isForCampaign.value = !isForCampaign.value;
  if (!isForCampaign.value) {
    selectedCampaignId.value = null;
  }
}

function toggleCampaignDropdown() {
  if (showCampaignDropdown.value) {
    showCampaignDropdown.value = false;
  } else {
    showIntroDropdown.value = false;
    showOutroDropdown.value = false;
    updateDropdownPosition(campaignButtonRef.value, campaignDropdownPosition);
    showCampaignDropdown.value = true;
  }
}

function selectCampaign(campaign: Campaign) {
  console.warn('[QuickPublishWizard] Campaign selected:', campaign);
  console.warn('[QuickPublishWizard] Campaign intro:', campaign.global_intro);
  console.warn('[QuickPublishWizard] Campaign outro:', campaign.global_outro);
  
  selectedCampaignId.value = campaign.id;
  showCampaignDropdown.value = false;
  
  // Clear manual intro/outro selection when campaign has its own assets
  // The computed properties will automatically use campaign assets
  if (campaign.global_intro) {
    selectedIntroId.value = null;
  }
  if (campaign.global_outro) {
    selectedOutroId.value = null;
  }
}

// Watch for creator profile changes and reload data
watch(
  () => props.creatorProfileServerId,
  async (newProfileId) => {
    if (newProfileId) {
      await loadCreatorProfileData();
      // Clear manual selections to allow creator profile defaults to apply
      if (!isForCampaign.value) {
        if (creatorProfileIntro.value) {
          selectedIntroId.value = null;
        }
        if (creatorProfileOutro.value) {
          selectedOutroId.value = null;
        }
      }
    }
  }
);

// Watch for campaign mode toggle
watch(
  () => isForCampaign.value,
  (isForCampaignMode) => {
    if (!isForCampaignMode) {
      // When exiting campaign mode, clear campaign selection
      selectedCampaignId.value = null;
      // Allow creator profile defaults to apply if available
      if (creatorProfileIntro.value) {
        selectedIntroId.value = null;
      }
      if (creatorProfileOutro.value) {
        selectedOutroId.value = null;
      }
    }
  }
);

// Platform helpers
function getPlatformIcon(platformId: string) {
  return availablePlatforms.find((p) => p.id === platformId)?.icon || Instagram;
}

function getPlatformLabel(platformId: string) {
  return availablePlatforms.find((p) => p.id === platformId)?.label || platformId;
}

function getDefaultAspectRatioForPlatform(platformId: string): string {
  // Smart defaults based on platform
  const defaults: Record<string, string> = {
    instagram: '9:16',
    tiktok: '9:16',
    twitter: '16:9',
    youtube: '16:9',
  };
  const defaultRatio = defaults[platformId] || '16:9';
  // Return default if it's in selected ratios, otherwise return first selected ratio
  return selectedRatios.value.includes(defaultRatio) ? defaultRatio : selectedRatios.value[0];
}

function togglePlatform(platformId: string) {
  if (platformConfigs.value[platformId]) {
    // Remove platform
    const { [platformId]: _, ...rest } = platformConfigs.value;
    platformConfigs.value = rest;
  } else {
    // Add platform with default aspect ratio and empty account
    platformConfigs.value[platformId] = {
      aspectRatio: getDefaultAspectRatioForPlatform(platformId),
      accountId: '',
    };
  }
}

function updatePlatformAspectRatio(platformId: string, aspectRatio: string) {
  if (platformConfigs.value[platformId]) {
    platformConfigs.value[platformId].aspectRatio = aspectRatio;
  }
}

function toggleAspectRatioDropdown(platformId: string) {
  if (activeAspectRatioDropdown.value === platformId) {
    activeAspectRatioDropdown.value = null;
  } else {
    activeAspectRatioDropdown.value = platformId;
  }
}

function selectAspectRatio(platformId: string, aspectRatio: string) {
  updatePlatformAspectRatio(platformId, aspectRatio);
  activeAspectRatioDropdown.value = null;
}

function isPlatformSelected(platformId: string): boolean {
  return !!platformConfigs.value[platformId];
}

function getOrgAccountsForPlatform(platformId: string): SocialAccount[] {
  const platformMap: Record<string, string> = {
    instagram: 'instagram',
    twitter: 'twitter',
    tiktok: 'tiktok',
    youtube: 'youtube',
  };
  return orgAccounts.value.filter((a) => a.platform === platformMap[platformId]);
}

function getPersonalAccountsForPlatform(platformId: string): (UserTwitterAccount | UserTiktokAccount | UserInstagramAccount | UserYoutubeAccount)[] {
  switch (platformId) {
    case 'twitter':
      return personalTwitterAccounts.value;
    case 'tiktok':
      return personalTiktokAccounts.value;
    case 'instagram':
      return personalInstagramAccounts.value;
    case 'youtube':
      return personalYoutubeAccounts.value;
    default:
      return [];
  }
}

function toggleAccountDropdown(platformId: string) {
  if (activeAccountDropdown.value === platformId) {
    activeAccountDropdown.value = null;
  } else {
    activeAccountDropdown.value = platformId;
  }
}

function selectAccount(platformId: string, accountValue: string) {
  if (platformConfigs.value[platformId]) {
    platformConfigs.value[platformId].accountId = accountValue;
  }
  activeAccountDropdown.value = null;
}

function getSelectedAccountLabel(platformId: string): string | null {
  const config = platformConfigs.value[platformId];
  if (!config?.accountId) return null;

  const [type, idStr] = config.accountId.split(':');
  const id = parseInt(idStr);

  if (type === 'org') {
    const account = getOrgAccountsForPlatform(platformId).find(a => a.id === id);
    return account ? `@${account.username}` : null;
  } else if (type === 'user') {
    const accounts = getPersonalAccountsForPlatform(platformId);
    const account = accounts.find(a => a.id === id);
    return account ? `@${account.username}` : null;
  }

  return null;
}

// Build process
async function startBuildProcess() {
  if (!props.clip || !props.projectId) return;

  console.warn('[QuickPublishWizard] Starting build process...');
  console.warn('[QuickPublishWizard] Clip:', props.clip);
  console.warn('[QuickPublishWizard] Clip path:', props.clipPath);
  console.warn('[QuickPublishWizard] Project ID:', props.projectId);
  console.warn('[QuickPublishWizard] Selected intro:', selectedIntro.value);
  console.warn('[QuickPublishWizard] Selected outro:', selectedOutro.value);

  // Download org intro/outro assets if needed (same logic as ClipsTab.vue)
  let introForBuild = selectedIntro.value;
  let outroForBuild = selectedOutro.value;
  
  // Start with watermark from props (personal/session watermark)
  let watermarkForBuild = props.watermarkSettings || null;

  // Handle campaign watermark override (same logic as ClipsTab.vue lines 2622-2657)
  if (isForCampaign.value && selectedCampaign.value) {
    const campaign = selectedCampaign.value;
    console.warn('[QuickPublishWizard] Applying campaign branding for:', campaign.title);

    const campaignCreatorProfile = campaign.creator_profiles?.[0] || campaign.creator_profile;
    if (campaignCreatorProfile?.watermark?.url) {
      try {
        const filename = `campaign-watermark-${campaignCreatorProfile.watermark.id}.png`;
        const filePath = await invoke<string>('download_org_asset_from_url', {
          url: campaignCreatorProfile.watermark.url,
          filename,
          assetType: 'watermarks',
          organizationId: String(campaign.organization_id),
        });
        let defaultPos = { x: 12, y: 92, opacity: 80, scale: 20 };
        if (campaignCreatorProfile.watermark_settings) {
          try {
            const wmSettings = typeof campaignCreatorProfile.watermark_settings === 'string'
              ? JSON.parse(campaignCreatorProfile.watermark_settings as unknown as string)
              : campaignCreatorProfile.watermark_settings;
            const ratioConfig = wmSettings['16:9'];
            if (ratioConfig?.position) defaultPos = ratioConfig.position;
          } catch (e) {
            console.warn('[QuickPublishWizard] Failed to parse campaign watermark settings:', e);
          }
        }
        watermarkForBuild = {
          enabled: true,
          watermarkId: `org-asset-${campaignCreatorProfile.watermark.id}`,
          positionX: defaultPos.x,
          positionY: defaultPos.y,
          opacity: defaultPos.opacity,
          scale: defaultPos.scale,
          perRatioSettings: (campaignCreatorProfile.watermark_settings as any) ?? null,
        };
        console.warn('[QuickPublishWizard] Campaign watermark applied:', campaignCreatorProfile.watermark.name);
      } catch (e) {
        console.warn('[QuickPublishWizard] Failed to download campaign watermark:', e);
      }
    } else if (isForCampaign.value) {
      // Campaign selected but no watermark - clear any existing watermark
      watermarkForBuild = null;
      console.warn('[QuickPublishWizard] Campaign has no watermark, clearing watermark');
    }

    // Save campaign_id to the clip for payment tracking
    if (props.clip) {
      try {
        const { updateClip } = await import('@/services/database/clips');
        await updateClip(props.clip.id, { campaign_id: selectedCampaignId.value });
        console.warn('[QuickPublishWizard] Saved campaign_id', selectedCampaignId.value, 'to clip', props.clip.id);
      } catch (e) {
        console.warn('[QuickPublishWizard] Failed to save campaign_id to clip:', e);
      }
    }
  }

  console.warn('[QuickPublishWizard] Watermark for build:', watermarkForBuild);

  // Download org intro if needed
  if (selectedIntro.value) {
    const introAny = selectedIntro.value as any;
    if (introAny.isOrgAsset && introAny.serverId) {
      console.warn('[QuickPublishWizard] Downloading org intro asset on-demand:', selectedIntro.value.name);
      try {
        const introResult = await ensureAssetDownloaded({
          id: introAny.serverId,
          name: selectedIntro.value.name,
          asset_type: 'intro',
          url: introAny.serverUrl || selectedIntro.value.file_path,
          organization_id: Number(introAny.organization_id),
          organization_name: introAny.organization_name || undefined,
          duration: selectedIntro.value.duration || undefined,
          thumbnail_url: introAny.thumbnail_path || undefined,
          inserted_at: introAny.created_at,
          updated_at: introAny.updated_at,
        } as unknown as ServerOrganizationAsset);

        if (introResult.success && introResult.filePath) {
          introForBuild = {
            ...selectedIntro.value,
            file_path: introResult.filePath,
          };
          console.warn('[QuickPublishWizard] Org intro downloaded to:', introResult.filePath);
        } else {
          throw new Error(`Failed to download intro asset: ${introResult.error || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('[QuickPublishWizard] Failed to download intro:', err);
        throw err;
      }
    }
  }

  // Download org outro if needed
  if (selectedOutro.value) {
    const outroAny = selectedOutro.value as any;
    if (outroAny.isOrgAsset && outroAny.serverId) {
      console.warn('[QuickPublishWizard] Downloading org outro asset on-demand:', selectedOutro.value.name);
      try {
        const outroResult = await ensureAssetDownloaded({
          id: outroAny.serverId,
          name: selectedOutro.value.name,
          asset_type: 'outro',
          url: outroAny.serverUrl || selectedOutro.value.file_path,
          organization_id: Number(outroAny.organization_id),
          organization_name: outroAny.organization_name || undefined,
          duration: selectedOutro.value.duration || undefined,
          thumbnail_url: outroAny.thumbnail_path || undefined,
          inserted_at: outroAny.created_at,
          updated_at: outroAny.updated_at,
        } as unknown as ServerOrganizationAsset);

        if (outroResult.success && outroResult.filePath) {
          outroForBuild = {
            ...selectedOutro.value,
            file_path: outroResult.filePath,
          };
          console.warn('[QuickPublishWizard] Org outro downloaded to:', outroResult.filePath);
        } else {
          throw new Error(`Failed to download outro asset: ${outroResult.error || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('[QuickPublishWizard] Failed to download outro:', err);
        throw err;
      }
    }
  }

  const settings = {
    aspectRatios: [...selectedRatios.value],
    quality: quality.value,
    frameRate: frameRate.value,
    format: outputFormat.value,
    intro: introForBuild,
    outro: outroForBuild,
    watermark: watermarkForBuild,
    framingMode: hasPortraitRatio.value ? 'manual' as const : undefined,
    manualFramingConfigs: hasPortraitRatio.value ? manualFramingConfigs.value : undefined,
    campaignId: isForCampaign.value && selectedCampaignId.value ? selectedCampaignId.value : null,
    selectedCampaign: isForCampaign.value ? selectedCampaign.value : null,
  };

  console.warn('[QuickPublishWizard] Build settings (after download):', settings);

  try {
    await buildPipeline.startBuild({
      clip: props.clip,
      projectId: props.projectId,
      settings,
      videoPath: props.clipPath,
    });
    console.warn('[QuickPublishWizard] Build completed successfully');
  } catch (err) {
    console.error('[QuickPublishWizard] Build failed:', err);
  }
}

// Publish
async function handlePublish() {
  if (!canPublish.value) return;

  const targets: PublishTarget[] = [];
  const platformToRatioMap: Record<string, string> = {};
  
  for (const platformId of selectedPublishPlatforms.value) {
    const config = platformConfigs.value[platformId];
    if (!config?.accountId) continue;
    
    const [accountType, accountIdStr] = config.accountId.split(':');
    targets.push({
      platformId,
      accountType: accountType as 'org' | 'user',
      accountId: Number(accountIdStr),
    });
    
    // Store platform to aspect ratio mapping
    platformToRatioMap[platformId] = config.aspectRatio;
  }

  backgroundPublish.queuePublish(
    targets,
    caption.value,
    orgId.value,
    buildState.value.thumbnailPath,
    {
      creatorProfileId: props.creatorProfileServerId ?? undefined,
      campaignId: isForCampaign.value && selectedCampaignId.value ? selectedCampaignId.value : undefined,
      platformToRatioMap,
    }
  );
  hasQueuedBackgroundPublish.value = true;
  
  // Close dialog immediately
  emit('published');
  emit('close');
  emit('update:modelValue', false);
}

function handleClose() {
  if (isBuilding.value) return;
  buildPipeline.cleanup();
  if (!hasQueuedBackgroundPublish.value) {
    backgroundPublish.reset();
  }
  emit('close');
  emit('update:modelValue', false);
}

// Load data
async function loadIntroOutros() {
  loadingAssets.value = true;
  console.warn('[QuickPublishWizard] Loading intro/outro assets...');
  try {
    const localAssets = await getAllIntroOutros();
    console.warn('[QuickPublishWizard] Local assets loaded:', localAssets.length, localAssets);
    const localIntros: IntroOutroItem[] = localAssets
      .filter((a) => a.type === 'intro' && !a.organization_id)
      .map((a) => ({ ...a, isOrgAsset: false }));
    const localOutros: IntroOutroItem[] = localAssets
      .filter((a) => a.type === 'outro' && !a.organization_id)
      .map((a) => ({ ...a, isOrgAsset: false }));

    let orgIntros: IntroOutroItem[] = [];
    let orgOutros: IntroOutroItem[] = [];

    const user = authStore.user;
    const hasOrganizations = user && (user.owned_organization_id || user.created_by_organization_id);
    console.log('[QuickPublishWizard] User has organizations:', hasOrganizations, 'owned:', user?.owned_organization_id, 'created_by:', user?.created_by_organization_id);
    if (hasOrganizations) {
      try {
        const serverResponse = await getUserOrganizationAssets();
        console.log('[QuickPublishWizard] Organization assets response:', serverResponse);
        if (serverResponse.success) {
          orgIntros = serverResponse.assets
            .filter((a: ServerOrganizationAsset) => a.asset_type === 'intro')
            .map((a: ServerOrganizationAsset) => ({
              id: `org_${a.id}`,
              name: a.name,
              file_path: a.url, // Remote URL - will be downloaded before build in startBuildProcess
              type: 'intro' as const,
              duration: a.duration || null,
              thumbnail_path: a.thumbnail_url || null,
              thumbnail_generation_status: 'completed' as const,
              created_at: new Date(a.inserted_at).getTime(),
              updated_at: new Date(a.updated_at).getTime(),
              organization_id: String(a.organization_id),
              organization_name: a.organization_name,
              isOrgAsset: true,
              serverId: a.id,
              serverUrl: a.url,
            }));
          orgOutros = serverResponse.assets
            .filter((a: ServerOrganizationAsset) => a.asset_type === 'outro')
            .map((a: ServerOrganizationAsset) => ({
              id: `org_${a.id}`,
              name: a.name,
              file_path: a.url, // Remote URL - will be downloaded before build in startBuildProcess
              type: 'outro' as const,
              duration: a.duration || null,
              thumbnail_path: a.thumbnail_url || null,
              thumbnail_generation_status: 'completed' as const,
              created_at: new Date(a.inserted_at).getTime(),
              updated_at: new Date(a.updated_at).getTime(),
              organization_id: String(a.organization_id),
              organization_name: a.organization_name,
              isOrgAsset: true,
              serverId: a.id,
              serverUrl: a.url,
            }));
        }
      } catch (orgError) {
        console.warn('Failed to load organization assets:', orgError);
      }
    }

    intros.value = [...orgIntros, ...localIntros];
    outros.value = [...orgOutros, ...localOutros];
    console.warn('[QuickPublishWizard] Final intros:', intros.value.length, 'outros:', outros.value.length);
  } catch (error) {
    console.error('[QuickPublishWizard] Failed to load assets:', error);
  } finally {
    loadingAssets.value = false;
  }
}

async function loadCreatorProfileData() {
  try {
    if (props.creatorProfileServerId) {
      // Load organization creator profile from server
      const { getMyAssignedCreatorProfiles } = await import('@/services/organizationProfilesApi');
      const response = await getMyAssignedCreatorProfiles();
      
      if (response.success && response.profiles) {
        // Find the specific creator profile by ID
        const profile = response.profiles.find(p => p.id === props.creatorProfileServerId);
        if (profile) {
          creatorProfileData.value = profile;
          console.warn('[QuickPublishWizard] Loaded org creator profile:', profile.name, 'intro_id:', profile.intro_id, 'outro_id:', profile.outro_id);
          return;
        }
      }
      console.warn('[QuickPublishWizard] Creator profile not found in assigned profiles');
    }
    
    // Fall back to local global branding if no creator profile assigned
    console.warn('[QuickPublishWizard] No creator profile assigned, checking for global branding...');
    const { getAllGlobalProfiles } = await import('@/services/database/creator-profiles');
    const globalProfiles = await getAllGlobalProfiles();
    if (globalProfiles.length > 0) {
      globalBrandingProfile.value = globalProfiles[0];
      console.warn('[QuickPublishWizard] Loaded global branding profile:', globalBrandingProfile.value.name, 'intro_id:', globalBrandingProfile.value.intro_id, 'outro_id:', globalBrandingProfile.value.outro_id);
    }
  } catch (e) {
    console.warn('[QuickPublishWizard] Failed to load creator profile data:', e);
  }
}

async function loadAvailableCampaigns() {
  console.warn('[QuickPublishWizard] Loading campaigns... creatorProfileServerId:', props.creatorProfileServerId);
  try {
    const results: Campaign[] = [];
    const globalRes = await getMyGlobalBrandingCampaigns();
    console.warn('[QuickPublishWizard] Global campaigns response:', globalRes);
    if (globalRes.success && globalRes.campaigns) {
      results.push(...globalRes.campaigns);
    }
    if (props.creatorProfileServerId) {
      const profileRes = await getCampaignsByCreatorProfile(props.creatorProfileServerId);
      if (profileRes.success && profileRes.campaigns) {
        for (const c of profileRes.campaigns) {
          if (!results.find((r) => r.id === c.id)) {
            results.push(c);
          }
        }
      }
    }
    availableCampaigns.value = results;
    console.warn('[QuickPublishWizard] Final campaigns:', results.length, results);
  } catch (e) {
    console.warn('[QuickPublishWizard] Failed to load campaigns:', e);
    availableCampaigns.value = [];
  }
}

async function loadAccounts() {
  loadingAccounts.value = true;
  try {
    const user = authStore.user;
    if (user?.owned_organization_id) {
      const orgRes = await listSocialAccounts(user.owned_organization_id);
      if (orgRes.success) {
        orgAccounts.value = orgRes.accounts || [];
      }
    }
    const [twitterRes, tiktokRes, instagramRes, youtubeRes] = await Promise.all([
      listUserTwitterAccounts(),
      listUserTiktokAccounts(),
      listUserInstagramAccounts(),
      listUserYoutubeAccounts(),
    ]);
    if (twitterRes.success) personalTwitterAccounts.value = twitterRes.accounts || [];
    if (tiktokRes.success) personalTiktokAccounts.value = tiktokRes.accounts || [];
    if (instagramRes.success) personalInstagramAccounts.value = instagramRes.accounts || [];
    if (youtubeRes.success) personalYoutubeAccounts.value = youtubeRes.accounts || [];
  } catch (error) {
    console.error('Failed to load accounts:', error);
  } finally {
    loadingAccounts.value = false;
  }
}

// Load a frame from the video for the POI editor preview
async function loadVideoFrame() {
  if (!props.clipPath || loadingVideoFrame.value) return;

  loadingVideoFrame.value = true;
  try {
    const { invoke } = await import('@tauri-apps/api/core');

    // For livestream clips, the clipPath IS the extracted clip file - use it directly
    // The clip is already extracted from HLS segments, so it's the source video
    videoPath.value = props.clipPath;
    console.log('[QuickPublishWizard] Using clip path as source video:', props.clipPath.split(/[\\/]/).pop());

    // Generate a frame at 1 second into the clip for preview
    const thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
      videoPath: props.clipPath,
      timestampSeconds: 1,
      outputFilename: `poi_preview_${props.clip?.id || Date.now()}`,
    });

    // Convert to data URL for display
    const dataUrl = await invoke<string>('read_file_as_data_url', {
      filePath: thumbnailPath,
    });

    videoFrameUrl.value = dataUrl;
  } catch (error) {
    console.warn('[QuickPublishWizard] Failed to load video frame:', error);
    // Use thumbnail URL prop as fallback
    videoFrameUrl.value = props.thumbnailUrl || null;
    // Still set the video path so POI editor can play the video
    videoPath.value = props.clipPath;
  } finally {
    loadingVideoFrame.value = false;
  }
}

// Helpers
function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Watch for dialog open
watch(
  () => props.modelValue,
  async (isOpen) => {
    console.warn('[QuickPublishWizard] modelValue changed:', isOpen);
    if (isOpen) {
      console.warn('[QuickPublishWizard] Dialog opened, loading data...');
      hasQueuedBackgroundPublish.value = false;
      currentStep.value = 'platforms';
      selectedRatios.value = ['16:9'];
      quality.value = 'high';
      frameRate.value = 30;
      outputFormat.value = 'mp4';
      manualFramingConfigs.value = {};
      selectedIntroId.value = null;
      selectedOutroId.value = null;
      isForCampaign.value = false;
      selectedCampaignId.value = null;
      platformConfigs.value = {};
      caption.value = '';
      
      buildPipeline.reset();
      if (!hasQueuedBackgroundPublish.value) {
        backgroundPublish.reset();
      }
      
      await Promise.all([
        loadIntroOutros(),
        loadCreatorProfileData(),
        loadAvailableCampaigns(),
        loadAccounts(),
        loadVideoFrame(),
      ]);
      console.warn('[QuickPublishWizard] All data loaded. intros:', intros.value.length, 'outros:', outros.value.length, 'campaigns:', availableCampaigns.value.length);
    }
  },
  { immediate: true }
);

// Handle framing step visibility
watch(
  () => hasPortraitRatio.value,
  (showFramingStep) => {
    if (!showFramingStep && currentStep.value === 'framing') {
      currentStep.value = 'export';
    }
  }
);

// Watch for build completion to trigger R2 upload
watch(
  () => buildState.value.status,
  (status) => {
    if (status === 'complete' && buildState.value.aspectRatioOutputPaths) {
      console.warn('[QuickPublishWizard] Build complete, starting R2 upload');
      backgroundPublish.startUpload(
        buildState.value.aspectRatioOutputPaths,
        buildState.value.thumbnailPath,
        orgId.value
      );
    }
  }
);

onMounted(() => {
  console.warn('[QuickPublishWizard] Component mounted');
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  buildPipeline.cleanup();
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
/* ===== Overlay ===== */
.build-dialog__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

/* ===== Dialog Container ===== */
.build-dialog {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  margin: 1rem;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

/* ===== Accent Bar ===== */
.build-dialog__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

/* ===== Header ===== */
.build-dialog__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.build-dialog__close {
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

.build-dialog__close:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.build-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  margin-bottom: 0.875rem;
}

.build-dialog__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.build-dialog__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

/* ===== Step Indicator ===== */
.build-dialog__steps-wrapper {
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--sidebar-border);
  background-color: rgba(0, 0, 0, 0.2);
}

.build-dialog__steps {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.build-dialog__step-container {
  display: flex;
  align-items: center;
}

.build-dialog__step-container--with-line {
  flex: 1;
}

.build-dialog__step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: opacity 150ms ease;
}

.build-dialog__step--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.build-dialog__step-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 150ms ease;
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text-muted);
  border: 1px solid var(--sidebar-border);
}

.build-dialog__step--active .build-dialog__step-circle {
  background-color: var(--sidebar-accent);
  color: white;
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.build-dialog__step--completed .build-dialog__step-circle {
  background-color: rgba(6, 182, 212, 0.2);
  color: var(--sidebar-accent);
  border-color: rgba(6, 182, 212, 0.4);
}

.build-dialog__step-icon {
  width: 16px;
  height: 16px;
}

.build-dialog__step-label {
  font-size: 0.75rem;
  font-weight: 500;
  transition: color 150ms ease;
  color: var(--sidebar-text-muted);
}

.build-dialog__step--active .build-dialog__step-label {
  color: var(--sidebar-text);
}

.build-dialog__step--completed .build-dialog__step-label {
  color: var(--sidebar-accent);
}

.build-dialog__step-connector {
  flex: 1;
  height: 1px;
  margin: 0 0.75rem;
  background-color: var(--sidebar-border);
  transition: background-color 150ms ease;
}

.build-dialog__step-connector--completed {
  background-color: rgba(6, 182, 212, 0.4);
}

@media (max-width: 640px) {
  .build-dialog__step-label {
    display: none;
  }
}

/* ===== Content Area ===== */
.build-dialog__content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  min-height: 0;
}

.build-dialog__content::-webkit-scrollbar {
  width: 8px;
}

.build-dialog__content::-webkit-scrollbar-track {
  background: transparent;
}

.build-dialog__content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.build-dialog__content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.25);
}

.build-dialog__content-inner {
  padding: 0;
  min-height: min-content;
}

/* ===== Step Content ===== */
.build-dialog__step-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  min-height: min-content;
}

.build-dialog__step-header {
  text-align: center;
  margin-bottom: 0.5rem;
}

.build-dialog__step-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.25rem;
}

.build-dialog__step-subtitle {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

/* ===== Platform Cards Grid ===== */
.build-dialog__platform-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.build-dialog__platform-card {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  border: 2px solid var(--sidebar-border);
  background-color: rgba(255, 255, 255, 0.03);
  transition: all 150ms ease;
  cursor: pointer;
  padding: 0;
}

.build-dialog__platform-card:hover {
  border-color: rgba(6, 182, 212, 0.3);
  background-color: rgba(255, 255, 255, 0.05);
}

.build-dialog__platform-card--selected {
  border-color: var(--sidebar-accent);
  background-color: rgba(6, 182, 212, 0.1);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2);
}

.build-dialog__platform-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem 0.5rem;
}

.build-dialog__platform-label-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.build-dialog__platform-ratio {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--sidebar-text);
}

.build-dialog__platform-badge {
  font-size: 0.625rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}

.build-dialog__platform-badge--original {
  background-color: rgba(6, 182, 212, 0.2);
  color: var(--sidebar-accent);
}

.build-dialog__platform-check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--sidebar-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
}

.build-dialog__platform-check--active {
  border-color: var(--sidebar-accent);
  background-color: var(--sidebar-accent);
  transform: scale(1.1);
}

.build-dialog__platform-check-icon {
  width: 12px;
  height: 12px;
  color: white;
}

.build-dialog__platform-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 0;
}

.build-dialog__platform-box {
  border: 2px solid var(--sidebar-text-muted);
  border-radius: 4px;
  transition: all 150ms ease;
}

.build-dialog__platform-box--16-9 { width: 80px; height: 45px; }
.build-dialog__platform-box--9-16 { width: 24px; height: 44px; }
.build-dialog__platform-box--1-1 { width: 44px; height: 44px; }
.build-dialog__platform-box--4-5 { width: 35px; height: 44px; }

.build-dialog__platform-box--selected {
  border-color: var(--sidebar-accent);
}

.build-dialog__platform-platforms {
  text-align: center;
  padding: 0 1rem 0.875rem;
}

.build-dialog__platform-text {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--sidebar-text-muted);
  margin: 0;
}

/* ===== Selection Summary ===== */
.build-dialog__selection-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.15);
  border-radius: 8px;
  margin-top: 0.5rem;
}

.build-dialog__selection-icon {
  width: 16px;
  height: 16px;
  color: var(--sidebar-accent);
  flex-shrink: 0;
}

.build-dialog__selection-text {
  font-size: 0.875rem;
  color: var(--sidebar-accent);
}

/* ===== Framing Section ===== */
.build-dialog__framing-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.build-dialog__section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.build-dialog__section-icon {
  width: 16px;
  height: 16px;
  color: var(--sidebar-accent);
}

.build-dialog__section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
}

/* ===== Manual Config ===== */
.build-dialog__manual-config {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.build-dialog__manual-hint {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.build-dialog__manual-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.build-dialog__ratio-config {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--sidebar-border);
  background-color: rgba(255, 255, 255, 0.03);
  transition: all 150ms ease;
  cursor: pointer;
}

.build-dialog__ratio-config:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(6, 182, 212, 0.4);
}

.build-dialog__ratio-config--configured {
  background-color: rgba(6, 182, 212, 0.1);
  border-color: rgba(6, 182, 212, 0.3);
}

.build-dialog__ratio-config-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.build-dialog__ratio-preview {
  border: 2px solid var(--sidebar-text-muted);
  border-radius: 3px;
  flex-shrink: 0;
}

.build-dialog__ratio-preview--configured {
  border-color: var(--sidebar-accent);
}

.build-dialog__ratio-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.build-dialog__ratio-config-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.build-dialog__ratio-status {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.build-dialog__ratio-status--configured {
  color: var(--sidebar-accent);
}

.build-dialog__ratio-chevron {
  width: 16px;
  height: 16px;
  color: var(--sidebar-text-muted);
}

/* ===== Empty State ===== */
.build-dialog__empty-state {
  text-align: center;
  padding: 2rem 0;
}

.build-dialog__empty-text {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

/* ===== Export Settings ===== */
.build-dialog__export-settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.build-dialog__setting-group {
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.build-dialog__setting-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.build-dialog__setting-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text);
}

.build-dialog__setting-badge {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--sidebar-accent);
  background-color: rgba(6, 182, 212, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  text-transform: capitalize;
}

.build-dialog__setting-buttons {
  display: flex;
  gap: 0.5rem;
}

.build-dialog__setting-btn {
  flex: 1;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid var(--sidebar-border);
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.build-dialog__setting-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: var(--sidebar-text);
}

.build-dialog__setting-btn--active {
  background-color: var(--sidebar-accent);
  color: white;
  border-color: var(--sidebar-accent);
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.2);
}

.build-dialog__setting-hint {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  line-height: 1.4;
  margin: 0;
}

/* ===== Add-ons Section ===== */
.build-dialog__addons-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.build-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.build-dialog__field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.build-dialog__field-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--sidebar-text-muted);
}

.build-dialog__intro-outro-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.build-dialog__dropdown-wrapper {
  position: relative;
}

.build-dialog__dropdown-trigger {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  cursor: pointer;
  transition: all 150ms ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
}

.build-dialog__dropdown-trigger:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.build-dialog__dropdown-trigger:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.build-dialog__dropdown-trigger--locked {
  opacity: 0.7;
  cursor: not-allowed;
  background-color: rgba(6, 182, 212, 0.1);
  border-color: rgba(6, 182, 212, 0.3);
}

.build-dialog__dropdown-trigger--locked:hover {
  border-color: rgba(6, 182, 212, 0.3);
}

.build-dialog__dropdown-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.build-dialog__dropdown-icon {
  width: 16px;
  height: 16px;
  color: var(--sidebar-text-muted);
  transition: transform 150ms ease;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.build-dialog__dropdown-icon--open {
  transform: rotate(180deg);
}

.build-dialog__dropdown-text--placeholder {
  color: var(--sidebar-text-muted);
  opacity: 0.7;
}

/* ===== Campaign Section ===== */
.build-dialog__campaign-section {
  padding: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  gap: 0;
}

.build-dialog__campaign-toggle {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  color: var(--sidebar-text);
}

.build-dialog__campaign-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1.5px solid var(--sidebar-border);
  background-color: var(--sidebar-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 150ms ease;
  margin-top: 1px;
}

.build-dialog__campaign-checkbox--checked {
  background-color: var(--sidebar-accent);
  border-color: var(--sidebar-accent);
}

.build-dialog__campaign-checkbox-icon {
  width: 11px;
  height: 11px;
  color: #000;
}

.build-dialog__campaign-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.build-dialog__campaign-toggle-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.build-dialog__campaign-toggle-icon {
  width: 14px;
  height: 14px;
  color: var(--sidebar-accent);
  flex-shrink: 0;
}

.build-dialog__campaign-toggle-hint {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  line-height: 1.4;
}

.build-dialog__campaign-picker {
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.build-dialog__campaign-selected {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex: 1;
  min-width: 0;
}

.build-dialog__campaign-selected-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  background-color: var(--sidebar-surface);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.build-dialog__campaign-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.build-dialog__campaign-cover-icon {
  width: 14px;
  height: 14px;
  color: var(--sidebar-text-muted);
}

.build-dialog__campaign-selected-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.build-dialog__campaign-selected-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.build-dialog__campaign-selected-org {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.build-dialog__campaign-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
}

.build-dialog__campaign-item-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  background-color: var(--sidebar-hover);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.build-dialog__campaign-item-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.build-dialog__campaign-item-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.build-dialog__campaign-item-org {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.build-dialog__campaign-notice {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background-color: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.15);
  border-radius: 6px;
}

.build-dialog__campaign-notice-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--sidebar-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #000;
  margin-top: 1px;
}

.build-dialog__campaign-notice-text {
  font-size: 0.8125rem;
  color: var(--sidebar-accent);
  margin: 0;
  line-height: 1.4;
}

.build-dialog__badge--global {
  background-color: rgba(34, 197, 94, 0.2);
  color: rgb(134, 239, 172);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

/* Slide-fade transition for campaign picker */
.slide-fade-enter-active {
  transition: all 200ms ease-out;
}

.slide-fade-leave-active {
  transition: all 150ms ease-in;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.build-dialog__duration-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background-color: rgba(6, 182, 212, 0.05);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 8px;
}

.build-dialog__duration-label {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
}

.build-dialog__duration-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-accent);
}

.build-dialog__field-badges {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.build-dialog__badge {
  font-size: 0.5625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.build-dialog__badge--org {
  background-color: rgba(99, 102, 241, 0.2);
  color: rgb(165, 180, 252);
  border: 1px solid rgba(99, 102, 241, 0.3);
}

.build-dialog__badge--campaign {
  background-color: rgba(6, 182, 212, 0.2);
  color: rgb(103, 232, 249);
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.build-dialog__badge--org-small {
  font-size: 0.5625rem;
  padding: 0.125rem 0.375rem;
  background-color: rgba(99, 102, 241, 0.2);
  color: rgb(165, 180, 252);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 9999px;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.build-dialog__badge-icon {
  width: 10px;
  height: 10px;
}

.build-dialog__select,
.schedule-dialog__select {
  width: 100%;
  padding: 0.625rem 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 6px;
  color: var(--sidebar-text);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 150ms ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
}

.build-dialog__select:hover,
.schedule-dialog__select:hover {
  border-color: rgba(6, 182, 212, 0.4);
}

.build-dialog__select:focus,
.schedule-dialog__select:focus {
  outline: none;
  border-color: var(--sidebar-accent);
}

/* ===== Footer ===== */
.build-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

.build-dialog__footer-left,
.build-dialog__footer-right {
  flex: 1;
}

.build-dialog__footer-right {
  display: flex;
  justify-content: flex-end;
}

.build-dialog__step-info {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.build-dialog__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
}

.build-dialog__btn-icon {
  width: 16px;
  height: 16px;
}

.build-dialog__btn--back {
  background: transparent;
  color: var(--sidebar-text-muted);
  padding: 0.5rem 1rem;
}

.build-dialog__btn--back:hover {
  color: var(--sidebar-text);
}

.build-dialog__btn--next {
  background-color: var(--sidebar-accent);
  color: white;
}

.build-dialog__btn--next:hover:not(.build-dialog__btn--disabled) {
  opacity: 0.9;
}

.build-dialog__btn--primary {
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: white;
}

.build-dialog__btn--primary:hover:not(.build-dialog__btn--disabled) {
  opacity: 0.9;
}

.build-dialog__btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== Schedule Dialog Styles for Publish Step ===== */
.schedule-dialog__step-content {
  padding: 0;
  min-height: min-content;
}

.schedule-dialog__content {
  padding: 1.5rem;
  min-height: min-content;
}

.schedule-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-height: min-content;
}

.schedule-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.schedule-dialog__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.schedule-dialog__clip-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
}

.schedule-dialog__clip-thumbnail {
  width: 80px;
  height: 45px;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--sidebar-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.schedule-dialog__clip-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.schedule-dialog__clip-info {
  flex: 1;
  min-width: 0;
}

.schedule-dialog__clip-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.schedule-dialog__clip-meta {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin-top: 0.25rem;
}

.schedule-dialog__alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
}

.schedule-dialog__alert--info {
  background-color: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.schedule-dialog__alert--error {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.schedule-dialog__alert-text {
  font-size: 0.875rem;
  margin: 0;
}

.schedule-dialog__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.schedule-dialog__build-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.schedule-dialog__progress-bar {
  height: 4px;
  background-color: var(--sidebar-border);
  border-radius: 2px;
  overflow: hidden;
}

.schedule-dialog__progress-fill {
  height: 100%;
  background-color: var(--sidebar-accent);
  transition: width 200ms ease;
}

.schedule-dialog__platform-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.625rem;
}

.schedule-dialog__platform-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
}

.schedule-dialog__platform-option:hover {
  border-color: rgba(6, 182, 212, 0.3);
}

.schedule-dialog__platform-option--selected {
  border-color: var(--sidebar-accent);
  background-color: rgba(6, 182, 212, 0.1);
}

.schedule-dialog__checkbox {
  display: none;
}

.schedule-dialog__aspect-ratio-rows {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: 0.75rem;
}

.schedule-dialog__aspect-ratio-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  background-color: rgba(6, 182, 212, 0.05);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 6px;
}

.schedule-dialog__aspect-ratio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  min-width: 140px;
}

.schedule-dialog__aspect-ratio-select {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 6px;
  color: var(--sidebar-text);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 150ms ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  padding-right: 2rem;
}

.schedule-dialog__aspect-ratio-select:hover {
  border-color: rgba(6, 182, 212, 0.4);
}

.schedule-dialog__aspect-ratio-select:focus {
  outline: none;
  border-color: var(--sidebar-accent);
}

.schedule-dialog__field-hint {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.schedule-dialog__field-hint--error {
  color: #ef4444;
}

.schedule-dialog__account-configs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.schedule-dialog__account-config {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.schedule-dialog__account-config-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 100px;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
}

.schedule-dialog__account-aspect-ratio {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin-left: 0.25rem;
}

.schedule-dialog__dropdown-wrapper {
  flex: 1;
}

.schedule-dialog__input,
.schedule-dialog__textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  font-family: inherit;
  transition: all 150ms ease;
}

.schedule-dialog__textarea {
  resize: vertical;
  min-height: 80px;
}

.schedule-dialog__input:focus,
.schedule-dialog__textarea:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.schedule-dialog__select-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  text-align: left;
}

.schedule-dialog__select-button:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.schedule-dialog__input::placeholder {
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}

.schedule-dialog__dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  overflow: hidden;
  z-index: 10001;
  max-height: 12rem;
  overflow-y: auto;
}

.schedule-dialog__dropdown::-webkit-scrollbar {
  width: 6px;
}

.schedule-dialog__dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.schedule-dialog__dropdown::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.schedule-dialog__dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.625rem 0.75rem;
  border-radius: 5px;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  background: transparent;
  border: none;
  transition: background-color 150ms ease;
  cursor: pointer;
}

.schedule-dialog__dropdown-item:hover {
  background-color: var(--sidebar-hover);
}

.schedule-dialog__dropdown-item--selected {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
}

.schedule-dialog__dropdown-group-label {
  padding: 0.5rem 0.875rem 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.schedule-dialog__caption-info {
  text-align: right;
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

.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.step-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.step-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* ===== Responsive ===== */
@media (max-width: 640px) {
  .build-dialog {
    max-width: calc(100% - 1rem);
    margin: 0.5rem;
  }

  .build-dialog__header {
    padding: 1.25rem 1.25rem 0.875rem;
  }

  .build-dialog__steps-wrapper {
    padding: 0.625rem 1.25rem;
  }

  .build-dialog__step-content {
    padding: 1.25rem;
  }

  .build-dialog__footer {
    padding: 0.875rem 1.25rem;
  }
}
</style>

<!-- Non-scoped styles for teleported dropdown menus -->
<style>
.build-dialog__dropdown-menu {
  position: fixed;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  overflow: hidden;
  z-index: 10001;
  max-height: 12rem;
  overflow-y: auto;
}

.build-dialog__dropdown-menu::-webkit-scrollbar {
  width: 6px;
}

.build-dialog__dropdown-menu::-webkit-scrollbar-track {
  background: transparent;
}

.build-dialog__dropdown-menu::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.build-dialog__dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.625rem 0.75rem;
  border-radius: 5px;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.build-dialog__dropdown-item:hover {
  background-color: var(--sidebar-hover);
}

.build-dialog__dropdown-item--first {
  border-bottom: 1px solid var(--sidebar-border);
  border-radius: 5px 5px 0 0;
  margin-bottom: 0.25rem;
}

.build-dialog__dropdown-item--selected {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
}

.build-dialog__dropdown-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.build-dialog__dropdown-item-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  overflow: hidden;
}

.build-dialog__dropdown-item-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.build-dialog__dropdown-item-duration {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  flex-shrink: 0;
}

.build-dialog__dropdown-loading {
  padding: 0.75rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
}

/* Campaign dropdown items */
.build-dialog__campaign-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
}

.build-dialog__campaign-item-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  background-color: var(--sidebar-hover);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.build-dialog__campaign-item-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.build-dialog__campaign-item-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.build-dialog__campaign-item-org {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.build-dialog__campaign-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.build-dialog__campaign-cover-icon {
  width: 14px;
  height: 14px;
  color: var(--sidebar-text-muted);
}

.build-dialog__badge--global {
  background-color: rgba(34, 197, 94, 0.2);
  color: rgb(134, 239, 172);
  border: 1px solid rgba(34, 197, 94, 0.3);
  font-size: 0.6875rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.build-dialog__badge-icon {
  width: 10px;
  height: 10px;
}
</style>

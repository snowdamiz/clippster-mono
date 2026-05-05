<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="build-dialog__overlay">
        <Transition name="dialog" appear>
          <div v-if="show" class="build-dialog" role="dialog" aria-modal="true">
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

                      <!-- Organization Builds Section (shown only when orgs with matching streamer exist) -->
                      <div v-if="availableOrgs.length > 0" class="build-dialog__field build-dialog__multi-select-section">
                        <div class="build-dialog__section-header">
                          <Building2 class="build-dialog__section-icon" />
                          <span class="build-dialog__section-title">Build for Organizations</span>
                        </div>
                        <p class="build-dialog__section-hint">Select organizations and aspect ratios for each build</p>
                        
                        <div class="build-dialog__multi-select-list">
                          <div
                            v-for="(org, orgIndex) in availableOrgs"
                            :key="org.profile.id"
                            class="build-dialog__multi-select-item"
                          >
                            <!-- Org checkbox -->
                            <button
                              type="button"
                              @click="toggleOrgSelection(orgIndex)"
                              class="build-dialog__multi-select-toggle"
                            >
                              <div
                                class="build-dialog__multi-select-checkbox"
                                :class="{ 'build-dialog__multi-select-checkbox--checked': org.selected }"
                              >
                                <CheckIcon v-if="org.selected" class="build-dialog__multi-select-checkbox-icon" />
                              </div>
                              <span class="build-dialog__multi-select-name">{{ org.profile.organization_name || org.profile.name }}</span>
                            </button>
                            
                            <!-- Nested aspect ratio checkboxes (shown when org is selected AND multiple ratios available) -->
                            <Transition name="slide-fade">
                              <div v-if="org.selected && hasMultipleAspectRatios" class="build-dialog__nested-ratios">
                                <button
                                  v-for="ratio in selectedRatios"
                                  :key="ratio"
                                  type="button"
                                  @click="toggleOrgAspectRatio(orgIndex, ratio)"
                                  class="build-dialog__ratio-chip"
                                  :class="{ 'build-dialog__ratio-chip--selected': org.aspectRatios.includes(ratio) }"
                                >
                                  <CheckIcon v-if="org.aspectRatios.includes(ratio)" class="build-dialog__ratio-chip-icon" />
                                  {{ ratio }}
                                </button>
                              </div>
                            </Transition>
                          </div>
                        </div>
                      </div>

                      <!-- Campaign Builds Section (shown only when campaigns exist) -->
                      <div v-if="availableCampaignSelections.length > 0" class="build-dialog__field build-dialog__multi-select-section">
                        <div class="build-dialog__section-header">
                          <Megaphone class="build-dialog__section-icon text-orange-400" />
                          <span class="build-dialog__section-title">Build for Campaigns</span>
                        </div>
                        <p class="build-dialog__section-hint">Campaign branding will override organization branding</p>
                        
                        <div class="build-dialog__multi-select-list">
                          <div
                            v-for="(campaignSel, campaignIndex) in availableCampaignSelections"
                            :key="campaignSel.campaign.id"
                            class="build-dialog__multi-select-item"
                          >
                            <!-- Campaign checkbox -->
                            <button
                              type="button"
                              @click="toggleCampaignSelectionMulti(campaignIndex)"
                              class="build-dialog__multi-select-toggle"
                            >
                              <div
                                class="build-dialog__multi-select-checkbox build-dialog__multi-select-checkbox--campaign"
                                :class="{ 'build-dialog__multi-select-checkbox--checked': campaignSel.selected }"
                              >
                                <CheckIcon v-if="campaignSel.selected" class="build-dialog__multi-select-checkbox-icon" />
                              </div>
                              <div class="build-dialog__campaign-info">
                                <span class="build-dialog__multi-select-name">{{ campaignSel.campaign.title }}</span>
                                <span class="build-dialog__campaign-org-name">{{ campaignSel.campaign.organization?.name }}</span>
                              </div>
                              <span v-if="!campaignSel.campaign.branding_profile_id" class="build-dialog__badge build-dialog__badge--global">
                                <Globe class="build-dialog__badge-icon" />
                                Global
                              </span>
                            </button>
                            
                            <!-- Nested aspect ratio checkboxes (shown when campaign is selected AND multiple ratios available) -->
                            <Transition name="slide-fade">
                              <div v-if="campaignSel.selected && hasMultipleAspectRatios" class="build-dialog__nested-ratios">
                                <button
                                  v-for="ratio in selectedRatios"
                                  :key="ratio"
                                  type="button"
                                  @click="toggleCampaignAspectRatio(campaignIndex, ratio)"
                                  class="build-dialog__ratio-chip"
                                  :class="{ 'build-dialog__ratio-chip--selected': campaignSel.aspectRatios.includes(ratio) }"
                                >
                                  <CheckIcon v-if="campaignSel.aspectRatios.includes(ratio)" class="build-dialog__ratio-chip-icon" />
                                  {{ ratio }}
                                </button>
                              </div>
                            </Transition>
                          </div>
                        </div>
                      </div>
                      
                      <!-- Build count summary -->
                      <div v-if="totalBuildsCount > 0" class="build-dialog__builds-summary">
                        <span class="build-dialog__builds-count">{{ totalBuildsCount }} build{{ totalBuildsCount !== 1 ? 's' : '' }} will be created</span>
                      </div>

                      <!-- Intro/Outro section - hidden for free tier users -->
                      <!-- Disabled when orgs/campaigns are selected (branding comes from their profiles) -->
                      <div v-if="!isFreeTier" class="build-dialog__intro-outro-section" :class="{ 'build-dialog__intro-outro-section--disabled': hasOrgOrCampaignSelected }">
                        <div v-if="hasOrgOrCampaignSelected" class="build-dialog__disabled-notice">
                          <span>Intro/Outro controlled by organization or campaign branding</span>
                        </div>
                        <!-- Intro Compact Selector -->
                        <div class="build-dialog__field">
                          <div class="build-dialog__field-header">
                            <label class="build-dialog__field-label">Intro</label>
                            <div class="build-dialog__field-badges">
                              <span v-if="hasOrgOrCampaignSelected" class="build-dialog__badge build-dialog__badge--org">
                                <Building2 class="build-dialog__badge-icon" />
                                Auto
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
                              @click="!hasOrgOrCampaignSelected && toggleIntroDropdown()"
                              class="build-dialog__dropdown-trigger"
                              :class="{ 'build-dialog__dropdown-trigger--disabled': hasOrgOrCampaignSelected }"
                              :disabled="hasOrgOrCampaignSelected"
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
                              <span v-if="hasOrgOrCampaignSelected" class="build-dialog__badge build-dialog__badge--org">
                                <Building2 class="build-dialog__badge-icon" />
                                Auto
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
                              @click="!hasOrgOrCampaignSelected && toggleOutroDropdown()"
                              class="build-dialog__dropdown-trigger"
                              :class="{ 'build-dialog__dropdown-trigger--disabled': hasOrgOrCampaignSelected }"
                              :disabled="hasOrgOrCampaignSelected"
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

                <!-- Step 1: Subtitles (choosing / transcribing / editing sub-states) -->
                <Transition name="step-slide" mode="out-in">
                  <div v-if="currentStep === 'subtitles'" key="subtitles" class="build-dialog__step-content">

                    <!-- SUB-STATE: choosing -->
                    <template v-if="subtitleSubState === 'choosing'">
                      <div class="build-dialog__step-header">
                        <h3 class="build-dialog__step-title">Would you like to add subtitles?</h3>
                        <p class="build-dialog__step-subtitle">Auto-generate and burn subtitles into your clip</p>
                      </div>

                      <!-- Error banner (if transcription failed previously) -->
                      <div v-if="subtitleTranscribeError" class="build-dialog__alert build-dialog__alert--error" style="margin-bottom:1rem;">
                        <AlertCircle :size="15" />
                        <span>Transcription failed: {{ subtitleTranscribeError }}</span>
                      </div>

                      <div class="build-dialog__subtitle-choice">
                        <button
                          type="button"
                          class="build-dialog__subtitle-choice-btn build-dialog__subtitle-choice-btn--yes"
                          @click="chooseSubtitlesYes"
                        >
                          <CaptionsIcon :size="28" />
                          <span class="build-dialog__subtitle-choice-label">Yes, add subtitles</span>
                          <span class="build-dialog__subtitle-choice-hint">Transcribe the clip and customise subtitle style</span>
                        </button>
                        <button
                          type="button"
                          class="build-dialog__subtitle-choice-btn build-dialog__subtitle-choice-btn--no"
                          @click="chooseSubtitlesNo"
                        >
                          <X :size="28" />
                          <span class="build-dialog__subtitle-choice-label">No, skip subtitles</span>
                          <span class="build-dialog__subtitle-choice-hint">Continue without subtitles</span>
                        </button>
                      </div>
                    </template>

                    <!-- SUB-STATE: transcribing -->
                    <template v-else-if="subtitleSubState === 'transcribing'">
                      <div class="build-dialog__step-header">
                        <h3 class="build-dialog__step-title">Transcribing your clip…</h3>
                        <p class="build-dialog__step-subtitle">{{ wizardTranscription.progress.value.message || 'Analysing audio…' }}</p>
                      </div>
                      <div class="build-dialog__transcribing-body">
                        <Loader2 :size="48" class="build-dialog__spinner build-dialog__spinner--large" />
                        <div class="build-dialog__progress-track">
                          <div
                            class="build-dialog__progress-fill"
                            :style="{ width: `${wizardTranscription.progress.value.progress}%` }"
                          />
                        </div>
                        <span class="build-dialog__transcribing-pct">{{ Math.round(wizardTranscription.progress.value.progress) }}%</span>
                      </div>
                    </template>

                    <!-- SUB-STATE: editing -->
                    <template v-else-if="subtitleSubState === 'editing' && wizardSubtitleSettings">
                      <div class="build-dialog__subtitle-editing-note">
                        Position the subtitles on the 16:9 preview, then adjust text, font, outline, color, and animation below.
                      </div>
                      <div class="build-dialog__subtitle-editor">

                        <!-- 16:9 canvas with thumbnail + draggable subtitle -->
                        <div class="build-dialog__subtitle-canvas-col">
                          <SubtitlePreviewCanvas
                            :thumbnail-url="subtitleFirstFrameUrl"
                            :aspect-ratio="{ width: 16, height: 9 }"
                            :subtitle-settings="wizardSubtitleSettings"
                            :subtitle-position="wizardSubtitlePosition"
                            :transcript-words="wizardTranscriptWords"
                            :transcript-segments="wizardTranscriptSegments"
                            :static-preview="true"
                            @subtitle-position-change="onWizardSubtitlePositionChange"
                            @subtitle-settings-change="onWizardSubtitleSettingsChange"
                          />
                          <p class="build-dialog__subtitle-canvas-label">Drag to reposition · corners to resize</p>
                        </div>

                        <!-- Subtitle style/transcript editor -->
                        <div class="build-dialog__subtitle-panel">
                          <div class="build-dialog__subtitle-panel-header">
                            <span>Edit subtitles</span>
                            <span>16:9</span>
                          </div>
                          <SubtitlePropertiesPanel
                            class="build-dialog__subtitle-panel-content"
                            variant="embedded"
                            :settings="wizardSubtitleSettings"
                            :segments="wizardTranscriptSegments"
                            :current-time="0"
                            @update-settings="(s: any) => onWizardSubtitleSettingsUpdate(s)"
                            @delete="removeWizardSubtitles"
                          />
                        </div>
                      </div>
                    </template>

                  </div>
                </Transition>

                <!-- Step 6: Publish -->
                <Transition name="step-slide" mode="out-in">
                  <div v-if="currentStep === 'publish'" key="publish" class="build-dialog__step-content">
                      <form class="build-dialog__form" @submit.prevent="handlePublish">
                        <!-- Build Progress -->
                        <div v-if="buildState.status === 'building'" class="build-dialog__alert build-dialog__alert--info">
                          <Loader2 :size="16" class="build-dialog__spinner" />
                          <div class="build-dialog__build-info">
                            <span>Building clip... {{ buildState.progress }}%</span>
                            <div class="build-dialog__progress-bar">
                              <div class="build-dialog__progress-fill" :style="{ width: `${buildState.progress}%` }"></div>
                            </div>
                          </div>
                        </div>
                        <div v-else-if="buildState.status === 'error'" class="build-dialog__alert build-dialog__alert--error">
                          <AlertCircle :size="16" />
                          <p class="build-dialog__alert-text">Build failed: {{ buildState.error }}</p>
                        </div>

                        <!-- Multi-Target Build Grid -->
                        <div v-if="buildTargets.length > 0" class="build-dialog__field">
                          <label class="build-dialog__label">Built Clips ({{ buildTargets.length }})</label>
                          <p class="build-dialog__field-hint">Select platforms and accounts for each aspect ratio</p>
                          
                          <!-- Group builds by aspect ratio -->
                          <div class="build-dialog__aspect-ratio-groups">
                            <div
                              v-for="(targets, aspectRatio) in groupedBuildTargets"
                              :key="aspectRatio"
                              class="build-dialog__aspect-ratio-group"
                            >
                              <!-- Aspect Ratio Header -->
                              <div class="build-dialog__aspect-ratio-header">
                                <span class="build-dialog__aspect-ratio-badge">{{ aspectRatio }}</span>
                                <div class="build-dialog__build-badges">
                                  <span
                                    v-for="target in targets"
                                    :key="`${target.type}-${target.id}`"
                                    :class="[
                                      'build-dialog__build-badge',
                                      target.type === 'campaign' ? 'build-dialog__build-badge--campaign' :
                                      target.type === 'org' ? 'build-dialog__build-badge--org' :
                                      'build-dialog__build-badge--personal'
                                    ]"
                                  >
                                    {{ target.name }}
                                  </span>
                                </div>
                              </div>
                              
                              <!-- Platform Selection -->
                              <div class="build-dialog__field">
                                <label class="build-dialog__label">Platforms *</label>
                                <div class="build-dialog__platforms">
                                  <label
                                    v-for="platform in availablePlatforms"
                                    :key="platform.id"
                                    class="build-dialog__platform-option"
                                    :class="{ 'build-dialog__platform-option--selected': targets[0].selectedPlatforms.has(platform.id) }"
                                  >
                                    <input
                                      type="checkbox"
                                      :checked="targets[0].selectedPlatforms.has(platform.id)"
                                      @change="togglePlatformForAspectRatio(aspectRatio, platform.id)"
                                      class="build-dialog__checkbox"
                                    />
                                    <component :is="platform.icon" :size="16" />
                                    <span>{{ platform.label }}</span>
                                  </label>
                                </div>
                              </div>
                              
                              <!-- Account Selection per Platform -->
                              <div v-if="getSelectedPlatformsForAspectRatio(aspectRatio).length > 0" class="build-dialog__field">
                                <label class="build-dialog__label">Accounts *</label>
                                <div class="build-dialog__account-configs">
                                  <div
                                    v-for="platformId in getSelectedPlatformsForAspectRatio(aspectRatio)"
                                    :key="platformId"
                                    class="build-dialog__account-config"
                                  >
                                    <div class="build-dialog__account-config-header">
                                      <component :is="getPlatformIcon(platformId)" :size="14" />
                                      <span>{{ getPlatformLabel(platformId) }}</span>
                                    </div>
                                    <div class="build-dialog__dropdown-wrapper">
                                      <button
                                        type="button"
                                        @click="toggleAccountDropdownForAspectRatio(aspectRatio, platformId)"
                                        class="build-dialog__dropdown-trigger build-dialog__dropdown-trigger--sm"
                                      >
                                        <span class="truncate">{{ getAccountLabelForAspectRatio(aspectRatio, platformId) }}</span>
                                        <ChevronDown
                                          class="build-dialog__dropdown-chevron"
                                          :class="{ 'build-dialog__dropdown-chevron--open': activeAccountDropdown === `${aspectRatio}-${platformId}` }"
                                          :size="14"
                                        />
                                      </button>
                                      
                                      <div v-if="activeAccountDropdown === `${aspectRatio}-${platformId}`" class="build-dialog__dropdown">
                                        <!-- Org Accounts Section -->
                                        <div v-if="getOrgAccountsForPlatform(platformId).length > 0">
                                          <div class="build-dialog__dropdown-group">Organization Accounts</div>
                                          <button
                                            v-for="account in getOrgAccountsForPlatform(platformId)"
                                            :key="`org-${account.id}`"
                                            type="button"
                                            @click="selectAccountForAspectRatio(aspectRatio, platformId, `org:${account.id}`)"
                                            class="build-dialog__dropdown-item"
                                            :class="{ 'build-dialog__dropdown-item--selected': targets[0].selectedPlatforms.get(platformId) === `org:${account.id}` }"
                                          >
                                            @{{ account.username }}
                                          </button>
                                        </div>
                                        
                                        <!-- Personal Accounts Section -->
                                        <div v-if="getPersonalAccountsForPlatform(platformId).length > 0">
                                          <div class="build-dialog__dropdown-group">Personal Accounts</div>
                                          <button
                                            v-for="account in getPersonalAccountsForPlatform(platformId)"
                                            :key="`user-${account.id}`"
                                            type="button"
                                            @click="selectAccountForAspectRatio(aspectRatio, platformId, `user:${account.id}`)"
                                            class="build-dialog__dropdown-item"
                                            :class="{ 'build-dialog__dropdown-item--selected': targets[0].selectedPlatforms.get(platformId) === `user:${account.id}` }"
                                          >
                                            @{{ account.username }}
                                          </button>
                                        </div>
                                        
                                        <!-- No Accounts Message -->
                                        <div v-if="getOrgAccountsForPlatform(platformId).length === 0 && getPersonalAccountsForPlatform(platformId).length === 0" class="build-dialog__dropdown-item" style="opacity: 0.6; cursor: default;">
                                          No accounts connected
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <!-- Legacy Single Build UI (shown when no multi-target builds) -->
                        <div v-else class="build-dialog__field">
                          <label class="build-dialog__label">Platforms *</label>
                          
                          <!-- Platform Grid (2 columns) -->
                          <div class="build-dialog__platform-grid">
                            <label
                              v-for="platform in availablePlatforms"
                              :key="platform.id"
                              class="build-dialog__platform-option"
                              :class="{ 'build-dialog__platform-option--selected': isPlatformSelected(platform.id) }"
                            >
                              <input
                                type="checkbox"
                                :checked="isPlatformSelected(platform.id)"
                                @change="togglePlatform(platform.id)"
                                class="build-dialog__checkbox"
                              />
                              <component :is="platform.icon" :size="16" />
                              <span>{{ platform.label }}</span>
                            </label>
                          </div>
                          
                          <!-- Aspect Ratio Selectors (shown below for selected platforms) -->
                          <div v-if="selectedPublishPlatforms.length > 0 && selectedRatios.length > 1" class="build-dialog__aspect-ratio-rows">
                            <div
                              v-for="platformId in selectedPublishPlatforms"
                              :key="platformId"
                              class="build-dialog__aspect-ratio-row"
                            >
                              <div class="build-dialog__aspect-ratio-label">
                                <component :is="getPlatformIcon(platformId)" :size="14" />
                                <span>{{ getPlatformLabel(platformId) }} aspect ratio:</span>
                              </div>
                              <div class="build-dialog__dropdown-wrapper" style="flex:1">
                                <button
                                  @click="toggleAspectRatioDropdown(platformId)"
                                  class="build-dialog__dropdown-trigger"
                                >
                                  <span class="build-dialog__dropdown-text truncate">
                                    {{ platformConfigs[platformId]?.aspectRatio || 'Select...' }}
                                  </span>
                                  <ChevronDown
                                    class="build-dialog__dropdown-chevron"
                                    :class="{ 'build-dialog__dropdown-chevron--open': activeAspectRatioDropdown === platformId }"
                                    :size="14"
                                  />
                                </button>

                                <!-- Dropdown -->
                                <div v-if="activeAspectRatioDropdown === platformId" class="build-dialog__dropdown">
                                  <button
                                    v-for="ratio in selectedRatios"
                                    :key="ratio"
                                    @click="selectAspectRatio(platformId, ratio)"
                                    class="build-dialog__dropdown-item"
                                    :class="{ 'build-dialog__dropdown-item--selected': platformConfigs[platformId]?.aspectRatio === ratio }"
                                  >
                                    {{ ratio }}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <p v-if="selectedPublishPlatforms.length === 0" class="build-dialog__field-hint build-dialog__field-hint--error">
                            Please select at least one platform
                          </p>
                        </div>

                        <!-- Account Selection -->
                        <div v-if="selectedPublishPlatforms.length > 0" class="build-dialog__field">
                          <label class="build-dialog__label">Accounts *</label>
                          <div class="build-dialog__account-configs">
                            <div
                              v-for="platformId in selectedPublishPlatforms"
                              :key="platformId"
                              class="build-dialog__account-config"
                            >
                              <div class="build-dialog__account-config-label">
                                <component :is="getPlatformIcon(platformId)" :size="14" />
                                <span>{{ getPlatformLabel(platformId) }}</span>
                                <span class="build-dialog__account-aspect-ratio">({{ platformConfigs[platformId]?.aspectRatio }})</span>
                              </div>
                              <div class="build-dialog__dropdown-wrapper" style="flex:1">
                                <button
                                  @click="toggleAccountDropdown(platformId)"
                                  class="build-dialog__dropdown-trigger"
                                >
                                  <span class="build-dialog__dropdown-text truncate">
                                    {{ getSelectedAccountLabel(platformId) || 'Select account...' }}
                                  </span>
                                  <ChevronDown
                                    class="build-dialog__dropdown-chevron"
                                    :class="{ 'build-dialog__dropdown-chevron--open': activeAccountDropdown === platformId }"
                                    :size="14"
                                  />
                                </button>

                                <!-- Dropdown -->
                                <div v-if="activeAccountDropdown === platformId" class="build-dialog__dropdown">
                                  <button
                                    @click="selectAccount(platformId, '')"
                                    class="build-dialog__dropdown-item"
                                    :class="{ 'build-dialog__dropdown-item--selected': !platformConfigs[platformId]?.accountId }"
                                  >
                                    Select account...
                                  </button>
                                  <template v-if="getOrgAccountsForPlatform(platformId).length > 0">
                                    <div class="build-dialog__dropdown-group-label">Organization</div>
                                    <button
                                      v-for="account in getOrgAccountsForPlatform(platformId)"
                                      :key="`org-${account.id}`"
                                      @click="selectAccount(platformId, `org:${account.id}`)"
                                      class="build-dialog__dropdown-item"
                                      :class="{ 'build-dialog__dropdown-item--selected': platformConfigs[platformId]?.accountId === `org:${account.id}` }"
                                    >
                                      @{{ account.username }}
                                    </button>
                                  </template>
                                  <template v-if="getPersonalAccountsForPlatform(platformId).length > 0">
                                    <div class="build-dialog__dropdown-group-label">Personal</div>
                                    <button
                                      v-for="account in getPersonalAccountsForPlatform(platformId)"
                                      :key="`user-${account.id}`"
                                      @click="selectAccount(platformId, `user:${account.id}`)"
                                      class="build-dialog__dropdown-item"
                                      :class="{ 'build-dialog__dropdown-item--selected': platformConfigs[platformId]?.accountId === `user:${account.id}` }"
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
                        <div class="build-dialog__field">
                          <label class="build-dialog__label">Caption</label>
                          <textarea
                            v-model="caption"
                            rows="3"
                            :maxlength="2200"
                            placeholder="Add a caption for your post..."
                            class="build-dialog__input build-dialog__textarea"
                          ></textarea>
                          <div class="build-dialog__caption-info">
                            <p class="build-dialog__field-hint">
                              {{ caption.length }} / 2200
                            </p>
                          </div>
                        </div>
                      </form>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Footer with Navigation -->
            <div class="build-dialog__footer">
              <!-- Back button or spacer -->
              <div class="build-dialog__footer-left">
                <button v-if="!isFirstStep || (currentStep === 'subtitles' && subtitleSubState === 'editing')" @click="previousStep" :disabled="isBuilding" class="build-dialog__btn build-dialog__btn--back">
                  <ArrowLeftIcon class="build-dialog__btn-icon" />
                  Back
                </button>
              </div>

              <!-- Step info -->
              <div class="build-dialog__step-info">Step {{ currentStepIndex + 1 }} of {{ visibleSteps.length }}</div>

              <!-- Next/Publish button -->
              <div class="build-dialog__footer-right">
                <button
                  v-if="!isLastStep && !(currentStep === 'subtitles' && subtitleSubState === 'choosing')"
                  @click="nextStep"
                  :disabled="!canProceed"
                  class="build-dialog__btn build-dialog__btn--next"
                  :class="{ 'build-dialog__btn--disabled': !canProceed }"
                >
                  Next
                  <ArrowRightIcon class="build-dialog__btn-icon" />
                </button>
                <template v-else>
                  <button
                    @click="handleNotNow"
                    :disabled="isBuilding"
                    class="build-dialog__btn build-dialog__btn--secondary"
                    :class="{ 'build-dialog__btn--disabled': isBuilding }"
                    style="margin-right: 0.75rem;"
                  >
                    Not Now
                  </button>
                  <button
                    @click="handlePublish"
                    :disabled="!canPublish || isBuilding"
                    class="build-dialog__btn build-dialog__btn--primary"
                    :class="{ 'build-dialog__btn--disabled': !canPublish || isBuilding }"
                  >
                    <Loader2 v-if="isBuilding" class="build-dialog__spinner" />
                    <Share2 v-else class="build-dialog__btn-icon" />
                    <span>{{ isBuilding ? 'Building...' : `Publish (${totalSelectedPlatforms})` }}</span>
                  </button>
                </template>
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
      :thumbnail-url="thumbnailUrl"
      :video-path="clipPath"
      :clip-start-time="clipStartTime"
      :clip-end-time="clipEndTime"
      :watermark-settings="watermarkSettings"
      :subtitle-settings="subtitlesEnabled ? wizardSubtitleSettings : null"
      :subtitle-position-override="wizardSubtitlePosition"
      :transcript-words="subtitlesEnabled ? wizardTranscriptWords : []"
      :transcript-segments="subtitlesEnabled ? wizardTranscriptSegments : []"
      :clip-id="clip?.id ?? null"
      :clip-text-overlay-json="clipTextOverlayRaw"
      @confirm="onManualConfigConfirm"
      @subtitlePositionChange="onManualPoiSubtitlePositionChange"
      @subtitleSettingsChange="onManualPoiSubtitleSettingsChange"
      @clip-text-overlay-change="onClipTextOverlayChange"
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
  CaptionsIcon,
} from 'lucide-vue-next';
import XLogo from '@/components/icons/XLogo.vue';
import TiktokLogo from '@/components/icons/TiktokLogo.vue';
import ManualPOIEditor from './poi/ManualPOIEditor.vue';
import SubtitlePropertiesPanel from './SubtitlePropertiesPanel.vue';
import SubtitlePreviewCanvas from './SubtitlePreviewCanvas.vue';
import { useTranscriptionOnly } from '@/composables/useTranscriptionOnly';
import type { ClipWithVersion, WatermarkSettings } from '@/services/database';
import type { ManualFramingConfig, ManualFramingConfigs } from '@/types';
import { getAllIntroOutros, type IntroOutro } from '@/services/database';
import { markBuildAsPublished } from '@/services/database/clip-build';
import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
import { ensureAssetDownloaded } from '@/services/orgAssetSync';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '@/stores/auth';
import { useFreeTierLimits } from '@/composables/useFreeTierLimits';
import { useClipBuildPipeline } from '@/composables/useClipBuildPipeline';
import { useBackgroundPublish, type PublishTarget } from '@/composables/useBackgroundPublish';
import { getMyGlobalBrandingCampaigns, getCampaignsByCreatorProfile, type Campaign } from '@/services/campaignApi';
import { getUserAssignedCreatorProfiles, type ServerOrganizationCreatorProfile } from '@/services/organizationProfilesApi';
import { listSocialAccounts, type SocialAccount } from '@/services/socialAccountsApi';
import { listUserTwitterAccounts, type UserTwitterAccount } from '@/services/userTwitterApi';
import { listUserTiktokAccounts, type UserTiktokAccount } from '@/services/userTiktokApi';
import { listUserInstagramAccounts, type UserInstagramAccount } from '@/services/userInstagramApi';
import { listUserYoutubeAccounts, type UserYoutubeAccount } from '@/services/userYoutubeApi';
import { createProject } from '@/services/database/projects';
import { updateClip } from '@/services/database/clips';
import type {
  SubtitleSettings,
  SubtitleOverride,
  SubtitleOverrides,
  WordInfo,
  WhisperSegment,
} from '@/types';
import { maxWordsChunkForAspectRatioString } from '@/utils/subtitleVisibleWords';

interface IntroOutroItem extends Omit<IntroOutro, 'id'> {
  id: string;
  isOrgAsset?: boolean;
  serverId?: number;
  serverUrl?: string;
}

// Multi-target selection interfaces (matching ClipBuildSettingsDialog)
interface OrgSelection {
  profile: ServerOrganizationCreatorProfile;
  selected: boolean;
  aspectRatios: string[];
}

interface CampaignSelection {
  campaign: Campaign;
  selected: boolean;
  aspectRatios: string[];
}

// Build target for multi-org/campaign builds
export interface BuildTarget {
  type: 'org' | 'campaign' | 'personal';
  id: number | null;
  name: string;
  aspectRatio: string;
  organizationId?: number;
  organizationName?: string;
  campaignId?: number;
  campaignName?: string;
  brandingProfileId?: number;
  buildFilePath?: string; // Set after build completes
  buildId?: string; // Database build record ID
  selectedPlatforms: Map<string, string>; // Map of platform ID to account ID (e.g., 'instagram' -> 'org:123')
}

type StepId = 'platforms' | 'framing' | 'export' | 'addons' | 'subtitles' | 'publish';

interface Step {
  id: StepId;
  label: string;
  icon: typeof LayoutGridIcon;
}

const allSteps: Step[] = [
  { id: 'subtitles', label: 'Subtitles', icon: CaptionsIcon },
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
  show: boolean;
  clip: ClipWithVersion | null;
  clipPath: string;
  projectId: string;
  watermarkSettings?: WatermarkSettings | null;
  thumbnailUrl?: string | null;
  creatorProfileServerId?: number | null;
  platform?: 'PumpFun' | 'Kick' | 'Twitch' | 'YouTube' | 'Rumble' | 'Twitter';
}>();

const emit = defineEmits<{
  'close': [];
  'published': [];
}>();

const authStore = useAuthStore();
const { isFreeTier } = useFreeTierLimits();
const buildPipeline = useClipBuildPipeline();
const backgroundPublish = useBackgroundPublish();

// Step state
const currentStep = ref<StepId>('subtitles');

// Build settings (Step 1-4)
const selectedRatios = ref<string[]>(['16:9']);
const quality = ref<'low' | 'medium' | 'high'>('high');
const frameRate = ref<30 | 60>(30);
const outputFormat = ref<'mp4' | 'mov'>('mp4');
const manualFramingConfigs = ref<ManualFramingConfigs>({});
const showManualPOIEditor = ref(false);
const editingAspectRatio = ref<string>('9:16');
const clipTextOverlayRaw = ref<string | null>(null);

// Subtitles step
const subtitlesEnabled = ref(false);
const selectedSubtitlePreset = ref<string | null>('neon-glow');

// Subtitle wizard sub-state: 'choosing' | 'transcribing' | 'editing'
const subtitleSubState = ref<'choosing' | 'transcribing' | 'editing'>('choosing');
const wizardSubtitleSettings = ref<SubtitleSettings | null>(null);
const wizardSubtitlePosition = ref<{ x: number; y: number; width?: number }>({ x: 50, y: 85, width: 80 });
const wizardTranscriptSegments = ref<WhisperSegment[]>([]);
const wizardTranscriptWords = ref<WordInfo[]>([]);
const subtitleFirstFrameUrl = ref<string | null>(null);
const subtitleTranscribeError = ref<string | null>(null);

const wizardTranscription = useTranscriptionOnly({ showSuccessToast: false, showErrorToast: false, showChunkCompletionToast: false, showCacheReuseToast: false });

function onWizardSubtitlePositionChange(position: { x: number; y: number; width?: number }) {
  wizardSubtitlePosition.value = { ...position };
}

function onWizardSubtitleSettingsChange(settings: SubtitleSettings) {
  wizardSubtitleSettings.value = { ...settings };
}

// Add-ons (Step 4)
const intros = ref<IntroOutroItem[]>([]);
const outros = ref<IntroOutroItem[]>([]);
const selectedIntroId = ref<string | null>(null);
const selectedOutroId = ref<string | null>(null);
const loadingAssets = ref(false);

// Multi-target selection (orgs and campaigns)
const availableOrgs = ref<OrgSelection[]>([]);
const availableCampaignSelections = ref<CampaignSelection[]>([]);
const loadingOrgsAndCampaigns = ref(false);
const buildTargets = ref<BuildTarget[]>([]); // Generated from selections before build

// Track which account dropdown is open (aspect ratio + platform)
const activeAccountDropdown = ref<string | null>(null);

// Group build targets by aspect ratio
const groupedBuildTargets = computed(() => {
  const groups: Record<string, BuildTarget[]> = {};
  
  for (const target of buildTargets.value) {
    if (!groups[target.aspectRatio]) {
      groups[target.aspectRatio] = [];
    }
    groups[target.aspectRatio].push(target);
  }
  
  return groups;
});

// Legacy single campaign selection (kept for backward compatibility)
const isForCampaign = ref(false);
const availableCampaigns = ref<Campaign[]>([]);
const selectedCampaignId = ref<number | null>(null);

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
    case 'subtitles':
      // In choosing sub-state, the Yes/No buttons handle navigation directly
      // In editing sub-state, always allow Next
      if (subtitleSubState.value === 'transcribing') return false;
      return true;
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
  // Multi-target build flow validation
  if (buildTargets.value.length > 0) {
    // Check if at least one target has platforms with accounts selected
    for (const target of buildTargets.value) {
      if (target.selectedPlatforms.size === 0) continue;
      
      // Check if all selected platforms have accounts
      for (const [platformId, accountId] of target.selectedPlatforms.entries()) {
        if (!accountId) return false;
      }
      
      // At least one valid target found
      return true;
    }
    // No valid targets found
    return false;
  }
  
  // Legacy single-build flow validation
  if (selectedPublishPlatforms.value.length === 0) return false;
  for (const platformId of selectedPublishPlatforms.value) {
    const config = platformConfigs.value[platformId];
    if (!config?.accountId || !config?.aspectRatio) return false;
  }
  return true;
});

const selectedCampaign = computed(() => availableCampaigns.value.find((c) => c.id === selectedCampaignId.value) || null);

// Count total platforms across all build targets (for multi-target flow) or legacy flow
const totalSelectedPlatforms = computed(() => {
  // Multi-target build flow
  if (buildTargets.value.length > 0) {
    const uniquePlatforms = new Set<string>();
    for (const target of buildTargets.value) {
      for (const platformId of target.selectedPlatforms.keys()) {
        uniquePlatforms.add(platformId);
      }
    }
    return uniquePlatforms.size;
  }
  
  // Legacy single-build flow
  return selectedPublishPlatforms.value.length;
});

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

async function nextStep() {
  // Subtitle step internal sub-state transitions
  if (currentStep.value === 'subtitles') {
    if (subtitleSubState.value === 'editing') {
      // Save full subtitle settings to DB then advance to platforms
      await saveWizardSubtitleSettings();
      advanceToNextWizardStep();
      return;
    }
    // 'choosing' sub-state — handled by chooseSubtitlesYes/No buttons directly
    return;
  }

  if (!isLastStep.value && canProceed.value) {
    const nextIndex = currentStepIndex.value + 1;
    if (nextIndex < visibleSteps.value.length) {
      const nextStepId = visibleSteps.value[nextIndex].id;
      currentStep.value = nextStepId;
      if (nextStepId === 'publish') {
        await saveSubtitleChoiceAndBuild();
      }
    }
  }
}

function advanceToNextWizardStep() {
  if (!isLastStep.value) {
    const nextIndex = currentStepIndex.value + 1;
    if (nextIndex < visibleSteps.value.length) {
      const nextStepId = visibleSteps.value[nextIndex].id;
      currentStep.value = nextStepId;
      if (nextStepId === 'publish') {
        void saveSubtitleChoiceAndBuild();
      }
    }
  }
}

async function chooseSubtitlesNo() {
  subtitlesEnabled.value = false;
  wizardSubtitleSettings.value = null;
  advanceToNextWizardStep();
}

async function chooseSubtitlesYes() {
  subtitlesEnabled.value = true;
  subtitleSubState.value = 'transcribing';
  subtitleTranscribeError.value = null;

  // Capture first frame thumbnail (needs convertFileSrc for Tauri file:// paths)
  if (props.thumbnailUrl) {
    try {
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      subtitleFirstFrameUrl.value = convertFileSrc(props.thumbnailUrl);
    } catch {
      subtitleFirstFrameUrl.value = props.thumbnailUrl;
    }
  }

  // Ensure a raw_video record exists for the clip file so transcribeProject can find it
  try {
    const { getRawVideoByPath, createRawVideo } = await import('@/services/database');
    const existing = await getRawVideoByPath(props.clipPath);
    if (!existing) {
      await createRawVideo(props.clipPath, { projectId: props.projectId });
    }
  } catch (e) {
    console.warn('[QuickPublishWizard] Failed to ensure raw_video for clip:', e);
  }

  // Run transcription
  const result = await wizardTranscription.transcribeProject(props.projectId, {
    organizationId: null,
  });

  if (!result.success && result.error !== 'Cancelled') {
    subtitleTranscribeError.value = result.error ?? 'Transcription failed';
    subtitleSubState.value = 'choosing';
    return;
  }

  // Load the transcript data from DB to populate the panel
  try {
    const { getTranscriptByProjectId, getTranscriptSegments } = await import('@/services/database');
    const transcript = await getTranscriptByProjectId(props.projectId);
    if (transcript) {
      if (transcript.raw_json) {
        const { parseTranscriptToWords } = await import('@/utils/timelineUtils');
        wizardTranscriptWords.value = parseTranscriptToWords(transcript.raw_json);
        wizardTranscriptSegments.value = parseWhisperSegmentsFromRawJson(transcript.raw_json);
      }
      const segs = await getTranscriptSegments(transcript.id);
      if (wizardTranscriptSegments.value.length === 0) {
        wizardTranscriptSegments.value = segs.map((s: any, index: number) => ({
          id: s.id ?? index,
          start: s.start_time,
          end: s.end_time,
          text: s.text,
        }));
      }
    }
  } catch (e) {
    console.warn('[QuickPublishWizard] Failed to load transcript segments after transcription', e);
  }

  // Initialize subtitle settings from the selected preset
  wizardSubtitleSettings.value = buildSubtitleSettingsFromPreset(selectedSubtitlePreset.value ?? 'neon-glow');
  subtitleSubState.value = 'editing';
}

function buildSubtitleSettingsFromPreset(presetId: string): SubtitleSettings {
  const base: SubtitleSettings = {
    enabled: true,
    fontFamily: 'Montserrat',
    fontSize: 48,
    fontWeight: 900,
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0)',
    backgroundEnabled: false,
    border1Width: 0,
    border1Color: '#000000',
    border2Width: 3,
    border2Color: '#000000',
    shadowBlur: 0,
    shadowColor: '#000000',
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    highlightColor: '#FACC15',
    animationStyle: 'karaoke',
    position: 'bottom',
    positionPercentage: 80,
    maxWidth: 85,
    multiColorEnabled: false,
    multiColorMode: 'default',
    colorPalette: [],
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: 'center',
    textOffsetX: 0,
    textOffsetY: 0,
    padding: 0,
    borderRadius: 0,
    // 0.35em is the ProjectWorkspaceDialog/VideoPlayer default — without this
    // the flex `gap` between word spans collapses to 0 and words run together
    // ("ThereasonwhyI'msurprisedis") in both the preview and the burned export.
    wordSpacing: 0.35,
  };
  switch (presetId) {
    case 'mr-beast':
      return { ...base, textColor: '#FACC15', fontFamily: 'Bebas Neue', border2Width: 4, highlightColor: '#FFFFFF', animationStyle: 'zoom' };
    case 'tiktok-bold':
      return { ...base, textColor: '#FFFFFF', backgroundEnabled: true, backgroundColor: 'rgba(0,0,0,0.8)', border2Width: 0, animationStyle: 'karaoke' };
    case 'subtitle-tutorial':
      return { ...base, textColor: '#FFFFFF', fontFamily: 'Roboto', fontWeight: 400, fontSize: 40, backgroundEnabled: true, backgroundColor: 'rgba(0,0,0,0.6)', border2Width: 0, animationStyle: 'none' };
    case 'neon-glow':
      return { ...base, textColor: '#FFFFFF', shadowBlur: 15, shadowColor: '#22D3EE', shadowOffsetX: 0, shadowOffsetY: 0, highlightColor: '#22D3EE', animationStyle: 'glow' };
    case 'karaoke':
      return { ...base, textColor: '#FFFFFF', highlightColor: '#FACC15', animationStyle: 'karaoke' };
    default:
      return base;
  }
}

function parseWhisperSegmentsFromRawJson(rawJson: string): WhisperSegment[] {
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed?.segments)) return [];

    return parsed.segments.map((segment: any, index: number) => ({
      id: segment.id ?? index,
      start: Number(segment.start) || 0,
      end: Number(segment.end) || 0,
      text: segment.text || '',
      words: Array.isArray(segment.words)
        ? segment.words.map((word: any) => ({
            word: String(word.word || '').trim(),
            start: Number(word.start) || 0,
            end: Number(word.end) || 0,
            confidence: word.confidence,
          }))
        : undefined,
    }));
  } catch (error) {
    console.warn('[QuickPublishWizard] Failed to parse whisper segments:', error);
    return [];
  }
}

async function saveWizardSubtitleSettings() {
  if (!props.clip?.id || !wizardSubtitleSettings.value) return;
  const { updateClipFullSubtitleSettings, updateClipSubtitlePosition } = await import('@/services/database/clips');
  await updateClipFullSubtitleSettings(props.clip.id, wizardSubtitleSettings.value);
  const pos = wizardSubtitlePosition.value;
  await updateClipSubtitlePosition(props.clip.id, pos.x, pos.y, pos.width ?? undefined);
}

/**
 * Build a subtitle payload (settings + transcript + max words) for a build target.
 * Returns `null` when subtitles are disabled or transcript is missing — caller
 * passes through as-null so the Rust pipeline skips subtitle rendering cleanly.
 *
 * The wizard captures position/width from the 16:9 preview (and for portrait
 * ratios, from the POI editor) into `wizardSubtitlePosition`. We bake that into
 * `perRatioConfigs[ratio].position` here so each build's burned-in subtitles
 * land exactly where the user placed them.
 */
function buildSubtitlePayloadForTarget(aspectRatio: string): {
  settings: SubtitleSettings;
  subtitleOverrides: SubtitleOverrides;
  transcriptWords: WordInfo[];
  transcriptSegments: WhisperSegment[];
  maxWords: number;
} | null {
  if (!subtitlesEnabled.value || !wizardSubtitleSettings.value) return null;
  if (wizardTranscriptWords.value.length === 0) return null;

  const base = wizardSubtitleSettings.value;
  const pos = wizardSubtitlePosition.value;
  const existingPerRatio = base.perRatioConfigs?.[aspectRatio] ?? ({} as SubtitleOverride);
  const { perRatioConfigs: _ignored, ...rootSettings } = base;

  // Per-ratio override carries the dragged position + width AND the rest of the
  // styling so the Rust ASS generator picks up the user's exact x/y/width
  // (orchestrator reads `subtitle_overrides[ratio].position.{x,y}` + `maxWidth`).
  const ratioOverride: SubtitleOverride = {
    ...rootSettings,
    ...existingPerRatio,
    fontSize: existingPerRatio.fontSize ?? base.fontSize,
    position: { x: pos.x, y: pos.y },
    positionPercentage: pos.y,
    maxWidth: pos.width ?? existingPerRatio.maxWidth ?? base.maxWidth,
  };

  const settings: SubtitleSettings = {
    ...base,
    enabled: true,
    positionPercentage: pos.y,
    maxWidth: pos.width ?? base.maxWidth,
    perRatioConfigs: {
      ...(base.perRatioConfigs ?? {}),
      [aspectRatio]: ratioOverride,
    },
  };

  return {
    settings,
    subtitleOverrides: { [aspectRatio]: ratioOverride } as SubtitleOverrides,
    transcriptWords: wizardTranscriptWords.value,
    transcriptSegments: wizardTranscriptSegments.value,
    maxWords: maxWordsChunkForAspectRatioString(aspectRatio, base.animationStyle),
  };
}

function onWizardSubtitleSettingsUpdate(patch: Record<string, unknown>) {
  if (!wizardSubtitleSettings.value) return;
  wizardSubtitleSettings.value = { ...wizardSubtitleSettings.value, ...(patch as Partial<SubtitleSettings>) };
}

function removeWizardSubtitles() {
  subtitlesEnabled.value = false;
  wizardSubtitleSettings.value = null;
  wizardTranscriptSegments.value = [];
  wizardTranscriptWords.value = [];
  subtitleSubState.value = 'choosing';
}


async function saveSubtitleChoiceAndBuild() {
  if (!props.clip?.id) return;
  const { updateClipSubtitleSettings } = await import('@/services/database/clips');
  await updateClipSubtitleSettings(
    props.clip.id,
    subtitlesEnabled.value,
    subtitlesEnabled.value ? (selectedSubtitlePreset.value ?? null) : null,
  );
  startBuildProcess();
}

function previousStep() {
  if (isBuilding.value) return;
  // If on the subtitle editing screen, go back to choosing rather than leaving the step
  if (currentStep.value === 'subtitles' && subtitleSubState.value === 'editing') {
    subtitleSubState.value = 'choosing';
    subtitlesEnabled.value = false;
    wizardSubtitleSettings.value = null;
    return;
  }
  if (!isFirstStep.value) {
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

async function onManualPoiSubtitlePositionChange(position: { x: number; y: number; width?: number }) {
  wizardSubtitlePosition.value = { ...position };
  if (!props.clip?.id || !subtitlesEnabled.value) return;

  try {
    const { updateClipSubtitlePosition } = await import('@/services/database/clips');
    await updateClipSubtitlePosition(props.clip.id, position.x, position.y, position.width);
  } catch (error) {
    console.warn('[QuickPublishWizard] Failed to save subtitle position from POI editor:', error);
  }
}

async function onManualPoiSubtitleSettingsChange(settings: SubtitleSettings) {
  wizardSubtitleSettings.value = { ...settings };
  if (!props.clip?.id || !subtitlesEnabled.value) return;

  try {
    const { updateClipFullSubtitleSettings } = await import('@/services/database/clips');
    await updateClipFullSubtitleSettings(props.clip.id, settings);
  } catch (error) {
    console.warn('[QuickPublishWizard] Failed to save subtitle settings from POI editor:', error);
  }
}

function onClipTextOverlayChange(json: string | null) {
  clipTextOverlayRaw.value = json;
}

async function loadClipTextOverlay() {
  clipTextOverlayRaw.value = null;
  if (!props.clip?.id) return;

  try {
    const { getClip } = await import('@/services/database/clips');
    const row = await getClip(props.clip.id);
    clipTextOverlayRaw.value = row?.clip_text_overlay ?? null;
  } catch (error) {
    console.warn('[QuickPublishWizard] Failed to load clip text overlay:', error);
  }
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
    const clickedInsideDropdown = (target as Element).closest('.build-dialog__dropdown');
    const clickedInsideButton = (target as Element).closest('.build-dialog__dropdown-trigger');
    if (!clickedInsideDropdown && !clickedInsideButton) {
      activeAccountDropdown.value = null;
    }
  }
  // Close aspect ratio dropdown when clicking outside
  if (activeAspectRatioDropdown.value) {
    const clickedInsideDropdown = (target as Element).closest('.build-dialog__dropdown');
    const clickedInsideButton = (target as Element).closest('.build-dialog__select-button');
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

// Aspect ratio-based platform/account selection
function togglePlatformForAspectRatio(aspectRatio: string, platformId: string) {
  const targets = groupedBuildTargets.value[aspectRatio];
  if (!targets || targets.length === 0) return;
  
  const firstTarget = targets[0];
  const isSelected = firstTarget.selectedPlatforms.has(platformId);
  
  // Toggle for all targets with this aspect ratio
  for (const target of targets) {
    if (isSelected) {
      target.selectedPlatforms.delete(platformId);
    } else {
      // Auto-select account based on target type
      let defaultAccount = '';
      
      if (target.type === 'org' || target.type === 'campaign') {
        const orgAccounts = getOrgAccountsForPlatform(platformId);
        if (orgAccounts.length > 0) {
          defaultAccount = `org:${orgAccounts[0].id}`;
        }
      } else {
        const personalAccounts = getPersonalAccountsForPlatform(platformId);
        if (personalAccounts.length > 0) {
          defaultAccount = `user:${personalAccounts[0].id}`;
        }
      }
      
      target.selectedPlatforms.set(platformId, defaultAccount);
    }
  }
}

function getSelectedPlatformsForAspectRatio(aspectRatio: string): string[] {
  const targets = groupedBuildTargets.value[aspectRatio];
  if (!targets || targets.length === 0) return [];
  
  return Array.from(targets[0].selectedPlatforms.keys());
}

function toggleAccountDropdownForAspectRatio(aspectRatio: string, platformId: string) {
  const key = `${aspectRatio}-${platformId}`;
  console.log('[QuickPublishWizard] toggleAccountDropdownForAspectRatio:', { aspectRatio, platformId, key });
  console.log('[QuickPublishWizard] Current activeAccountDropdown:', activeAccountDropdown.value);
  console.log('[QuickPublishWizard] Org accounts for platform:', getOrgAccountsForPlatform(platformId));
  console.log('[QuickPublishWizard] Personal accounts for platform:', getPersonalAccountsForPlatform(platformId));
  
  activeAccountDropdown.value = activeAccountDropdown.value === key ? null : key;
  
  console.log('[QuickPublishWizard] New activeAccountDropdown:', activeAccountDropdown.value);
}

function selectAccountForAspectRatio(aspectRatio: string, platformId: string, accountId: string) {
  const targets = groupedBuildTargets.value[aspectRatio];
  if (!targets) return;
  
  // Set account for all targets with this aspect ratio
  for (const target of targets) {
    target.selectedPlatforms.set(platformId, accountId);
  }
  
  activeAccountDropdown.value = null;
}

function getAccountLabelForAspectRatio(aspectRatio: string, platformId: string): string {
  const targets = groupedBuildTargets.value[aspectRatio];
  if (!targets || targets.length === 0) return 'Select account...';
  
  const accountId = targets[0].selectedPlatforms.get(platformId);
  if (!accountId) return 'Select account...';
  
  return getAccountLabel(platformId, accountId) || 'Select account...';
}

function getAccountLabel(platformId: string, accountId: string): string | null {
  if (!accountId) return null;
  
  const [type, id] = accountId.split(':');
  const accountIdNum = Number(id);
  
  if (type === 'org') {
    const accounts = getOrgAccountsForPlatform(platformId);
    const account = accounts.find(a => a.id === accountIdNum);
    return account ? `@${account.username}` : null;
  } else if (type === 'user') {
    const accounts = getPersonalAccountsForPlatform(platformId);
    const account = accounts.find(a => a.id === accountIdNum);
    return account ? `@${account.username}` : null;
  }
  
  return null;
}

function toggleAccountDropdown(platformId: string) {
  console.log('[QuickPublishWizard] toggleAccountDropdown called for platform:', platformId);
  console.log('[QuickPublishWizard] Current activeAccountDropdown:', activeAccountDropdown.value);
  console.log('[QuickPublishWizard] Org accounts for platform:', getOrgAccountsForPlatform(platformId));
  console.log('[QuickPublishWizard] Personal accounts for platform:', getPersonalAccountsForPlatform(platformId));
  
  if (activeAccountDropdown.value === platformId) {
    activeAccountDropdown.value = null;
  } else {
    activeAccountDropdown.value = platformId;
  }
  
  console.log('[QuickPublishWizard] New activeAccountDropdown:', activeAccountDropdown.value);
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

// Helper: Load branding assets for an organization target
async function loadOrgBranding(orgProfile: ServerOrganizationCreatorProfile) {
  let intro: IntroOutroItem | null = null;
  let outro: IntroOutroItem | null = null;
  let watermark: any = null;
  
  // Load intro
  if (orgProfile.intro?.url) {
    try {
      const introResult = await ensureAssetDownloaded({
        id: orgProfile.intro.id,
        name: orgProfile.intro.name,
        asset_type: 'intro',
        url: orgProfile.intro.url,
        organization_id: orgProfile.organization_id,
        organization_name: orgProfile.organization_name || undefined,
        duration: orgProfile.intro.duration || undefined,
        thumbnail_url: orgProfile.intro.thumbnail_url || undefined,
        inserted_at: Date.now().toString(),
        updated_at: Date.now().toString(),
      } as unknown as ServerOrganizationAsset);
      
      if (introResult.success && introResult.filePath) {
        intro = {
          id: `org-intro-${orgProfile.intro.id}`,
          name: orgProfile.intro.name,
          file_path: introResult.filePath,
          type: 'intro' as const,
          duration: orgProfile.intro.duration ? parseFloat(String(orgProfile.intro.duration)) : null,
          thumbnail_path: orgProfile.intro.thumbnail_url || null,
          thumbnail_generation_status: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
      }
    } catch (e) {
      console.warn('[QuickPublishWizard] Failed to load org intro:', e);
    }
  }
  
  // Load outro
  if (orgProfile.outro?.url) {
    try {
      const outroResult = await ensureAssetDownloaded({
        id: orgProfile.outro.id,
        name: orgProfile.outro.name,
        asset_type: 'outro',
        url: orgProfile.outro.url,
        organization_id: orgProfile.organization_id,
        organization_name: orgProfile.organization_name || undefined,
        duration: orgProfile.outro.duration || undefined,
        thumbnail_url: orgProfile.outro.thumbnail_url || undefined,
        inserted_at: Date.now().toString(),
        updated_at: Date.now().toString(),
      } as unknown as ServerOrganizationAsset);
      
      if (outroResult.success && outroResult.filePath) {
        outro = {
          id: `org-outro-${orgProfile.outro.id}`,
          name: orgProfile.outro.name,
          file_path: outroResult.filePath,
          type: 'outro' as const,
          duration: orgProfile.outro.duration ? parseFloat(String(orgProfile.outro.duration)) : null,
          thumbnail_path: orgProfile.outro.thumbnail_url || null,
          thumbnail_generation_status: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
      }
    } catch (e) {
      console.warn('[QuickPublishWizard] Failed to load org outro:', e);
    }
  }
  
  // Load watermark
  if (orgProfile.watermark?.url) {
    try {
      const filename = `org-watermark-${orgProfile.watermark.id}.png`;
      const filePath = await invoke<string>('download_org_asset_from_url', {
        url: orgProfile.watermark.url,
        filename,
        assetType: 'watermarks',
        organizationId: String(orgProfile.organization_id),
      });
      
      let defaultPos = { x: 12, y: 92, opacity: 80, scale: 20 };
      if (orgProfile.watermark_settings) {
        try {
          const wmSettings = typeof orgProfile.watermark_settings === 'string'
            ? JSON.parse(orgProfile.watermark_settings as unknown as string)
            : orgProfile.watermark_settings;
          const ratioConfig = wmSettings['16:9'];
          if (ratioConfig?.position) defaultPos = ratioConfig.position;
        } catch (e) {
          console.warn('[QuickPublishWizard] Failed to parse org watermark settings:', e);
        }
      }
      
      watermark = {
        enabled: true,
        watermarkId: `org-asset-${orgProfile.watermark.id}`,
        positionX: defaultPos.x,
        positionY: defaultPos.y,
        opacity: defaultPos.opacity,
        scale: defaultPos.scale,
        perRatioSettings: (orgProfile.watermark_settings as any) ?? null,
      };
    } catch (e) {
      console.warn('[QuickPublishWizard] Failed to load org watermark:', e);
    }
  }
  
  return { intro, outro, watermark };
}

// Helper: Load branding assets for a campaign target
async function loadCampaignBranding(campaign: Campaign) {
  let intro: IntroOutroItem | null = null;
  let outro: IntroOutroItem | null = null;
  let watermark: any = null;
  
  // Campaign intro (global_intro takes priority, then branding_profile.intro)
  if (campaign.global_intro) {
    try {
      const introResult = await ensureAssetDownloaded({
        id: campaign.global_intro.id,
        name: campaign.global_intro.name,
        asset_type: 'intro',
        url: campaign.global_intro.url,
        organization_id: campaign.organization_id,
        organization_name: campaign.organization?.name || undefined,
        duration: campaign.global_intro.duration || undefined,
        thumbnail_url: campaign.global_intro.thumbnail_url || undefined,
        inserted_at: Date.now().toString(),
        updated_at: Date.now().toString(),
      } as unknown as ServerOrganizationAsset);
      
      if (introResult.success && introResult.filePath) {
        intro = {
          id: `campaign-intro-${campaign.global_intro.id}`,
          name: campaign.global_intro.name,
          file_path: introResult.filePath,
          type: 'intro' as const,
          duration: campaign.global_intro.duration ? parseFloat(campaign.global_intro.duration) : null,
          thumbnail_path: campaign.global_intro.thumbnail_url || null,
          thumbnail_generation_status: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
      }
    } catch (e) {
      console.warn('[QuickPublishWizard] Failed to load campaign global_intro:', e);
    }
  }
  
  // Campaign outro (global_outro takes priority, then branding_profile.outro)
  if (campaign.global_outro) {
    try {
      const outroResult = await ensureAssetDownloaded({
        id: campaign.global_outro.id,
        name: campaign.global_outro.name,
        asset_type: 'outro',
        url: campaign.global_outro.url,
        organization_id: campaign.organization_id,
        organization_name: campaign.organization?.name || undefined,
        duration: campaign.global_outro.duration || undefined,
        thumbnail_url: campaign.global_outro.thumbnail_url || undefined,
        inserted_at: Date.now().toString(),
        updated_at: Date.now().toString(),
      } as unknown as ServerOrganizationAsset);
      
      if (outroResult.success && outroResult.filePath) {
        outro = {
          id: `campaign-outro-${campaign.global_outro.id}`,
          name: campaign.global_outro.name,
          file_path: outroResult.filePath,
          type: 'outro' as const,
          duration: campaign.global_outro.duration ? parseFloat(campaign.global_outro.duration) : null,
          thumbnail_path: campaign.global_outro.thumbnail_url || null,
          thumbnail_generation_status: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
      }
    } catch (e) {
      console.warn('[QuickPublishWizard] Failed to load campaign global_outro:', e);
    }
  }
  
  // Fallback to branding_profile intro/outro if global_intro/outro not set
  const campaignCreatorProfile = campaign.branding_profile || campaign.creator_profiles?.[0] || campaign.creator_profile;
  
  if (!intro && campaignCreatorProfile?.intro?.url) {
    try {
      const introResult = await ensureAssetDownloaded({
        id: campaignCreatorProfile.intro.id,
        name: campaignCreatorProfile.intro.name,
        asset_type: 'intro',
        url: campaignCreatorProfile.intro.url,
        organization_id: campaign.organization_id,
        organization_name: campaign.organization?.name || undefined,
        duration: campaignCreatorProfile.intro.duration || undefined,
        thumbnail_url: campaignCreatorProfile.intro.thumbnail_url || undefined,
        inserted_at: Date.now().toString(),
        updated_at: Date.now().toString(),
      } as unknown as ServerOrganizationAsset);
      
      if (introResult.success && introResult.filePath) {
        intro = {
          id: `campaign-intro-${campaignCreatorProfile.intro.id}`,
          name: campaignCreatorProfile.intro.name,
          file_path: introResult.filePath,
          type: 'intro' as const,
          duration: campaignCreatorProfile.intro.duration ? parseFloat(campaignCreatorProfile.intro.duration) : null,
          thumbnail_path: campaignCreatorProfile.intro.thumbnail_url || null,
          thumbnail_generation_status: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
      }
    } catch (e) {
      console.warn('[QuickPublishWizard] Failed to load campaign branding_profile intro:', e);
    }
  }
  
  if (!outro && campaignCreatorProfile?.outro?.url) {
    try {
      const outroResult = await ensureAssetDownloaded({
        id: campaignCreatorProfile.outro.id,
        name: campaignCreatorProfile.outro.name,
        asset_type: 'outro',
        url: campaignCreatorProfile.outro.url,
        organization_id: campaign.organization_id,
        organization_name: campaign.organization?.name || undefined,
        duration: campaignCreatorProfile.outro.duration || undefined,
        thumbnail_url: campaignCreatorProfile.outro.thumbnail_url || undefined,
        inserted_at: Date.now().toString(),
        updated_at: Date.now().toString(),
      } as unknown as ServerOrganizationAsset);
      
      if (outroResult.success && outroResult.filePath) {
        outro = {
          id: `campaign-outro-${campaignCreatorProfile.outro.id}`,
          name: campaignCreatorProfile.outro.name,
          file_path: outroResult.filePath,
          type: 'outro' as const,
          duration: campaignCreatorProfile.outro.duration ? parseFloat(campaignCreatorProfile.outro.duration) : null,
          thumbnail_path: campaignCreatorProfile.outro.thumbnail_url || null,
          thumbnail_generation_status: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
      }
    } catch (e) {
      console.warn('[QuickPublishWizard] Failed to load campaign branding_profile outro:', e);
    }
  }
  
  // Campaign watermark
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
      
      watermark = {
        enabled: true,
        watermarkId: `org-asset-${campaignCreatorProfile.watermark.id}`,
        positionX: defaultPos.x,
        positionY: defaultPos.y,
        opacity: defaultPos.opacity,
        scale: defaultPos.scale,
        perRatioSettings: (campaignCreatorProfile.watermark_settings as any) ?? null,
      };
    } catch (e) {
      console.warn('[QuickPublishWizard] Failed to load campaign watermark:', e);
    }
  }
  
  return { intro, outro, watermark };
}

// Generate BuildTarget array from org/campaign selections
function generateBuildTargets(): BuildTarget[] {
  const targets: BuildTarget[] = [];
  
  // Generate targets for selected orgs
  for (const org of availableOrgs.value) {
    if (!org.selected) continue;
    
    // Determine which aspect ratios to use for this org
    const ratios = hasMultipleAspectRatios.value && org.aspectRatios.length > 0
      ? org.aspectRatios
      : selectedRatios.value;
    
    // Create one target per aspect ratio
    for (const ratio of ratios) {
      targets.push({
        type: 'org',
        id: org.profile.id,
        name: org.profile.organization_name || org.profile.name || 'Organization',
        aspectRatio: ratio,
        organizationId: org.profile.organization_id,
        organizationName: org.profile.organization_name,
        brandingProfileId: org.profile.id,
        selectedPlatforms: new Map(),
      });
    }
  }
  
  // Generate targets for selected campaigns
  for (const campaignSel of availableCampaignSelections.value) {
    if (!campaignSel.selected) continue;
    
    // Determine which aspect ratios to use for this campaign
    const ratios = hasMultipleAspectRatios.value && campaignSel.aspectRatios.length > 0
      ? campaignSel.aspectRatios
      : selectedRatios.value;
    
    // Create one target per aspect ratio
    for (const ratio of ratios) {
      targets.push({
        type: 'campaign',
        id: campaignSel.campaign.id,
        name: campaignSel.campaign.title,
        aspectRatio: ratio,
        organizationId: campaignSel.campaign.organization_id,
        organizationName: campaignSel.campaign.organization?.name,
        campaignId: campaignSel.campaign.id,
        campaignName: campaignSel.campaign.title,
        brandingProfileId: campaignSel.campaign.branding_profile_id || undefined,
        selectedPlatforms: new Map(),
      });
    }
  }
  
  // If no orgs/campaigns selected, create personal build targets
  if (targets.length === 0) {
    for (const ratio of selectedRatios.value) {
      targets.push({
        type: 'personal',
        id: null,
        name: 'Personal',
        aspectRatio: ratio,
        selectedPlatforms: new Map(),
      });
    }
  }
  
  console.log('[QuickPublishWizard] Generated', targets.length, 'build targets:', targets);
  return targets;
}

// Build process - Multi-target implementation
async function startBuildProcess() {
  if (!props.clip || !props.projectId) return;

  console.log('[QuickPublishWizard] Starting multi-target build process...');
  
  // Generate build targets from user selections
  const targets = generateBuildTargets();
  buildTargets.value = targets;
  
  console.log('[QuickPublishWizard] Building', targets.length, 'targets:', targets);
  
  if (targets.length === 0) {
    console.error('[QuickPublishWizard] No build targets generated');
    return;
  }
  
  // Import database functions
  const { createClipBuild } = await import('@/services/database/clip-build');
  const { updateClip } = await import('@/services/database/clips');
  
  // Track all builds
  const allBuilds: Array<{
    target: BuildTarget;
    buildNumber: number;
    buildId: string;
  }> = [];
  
  // Loop through each target and create a separate build
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(`[QuickPublishWizard] Processing target ${i + 1}/${targets.length}:`, target.name, target.aspectRatio);
    
    let intro: IntroOutroItem | null = null;
    let outro: IntroOutroItem | null = null;
    let watermark: any = null;
    
    // Load branding based on target type
    if (target.type === 'org') {
      // Find the org profile
      const orgSel = availableOrgs.value.find(o => o.profile.id === target.id);
      if (orgSel) {
        const branding = await loadOrgBranding(orgSel.profile);
        intro = branding.intro;
        outro = branding.outro;
        watermark = branding.watermark;
        console.log('[QuickPublishWizard] Loaded org branding for:', target.name);
      }
    } else if (target.type === 'campaign') {
      // Find the campaign
      const campaignSel = availableCampaignSelections.value.find(c => c.campaign.id === target.id);
      if (campaignSel) {
        const branding = await loadCampaignBranding(campaignSel.campaign);
        intro = branding.intro;
        outro = branding.outro;
        watermark = branding.watermark;
        console.log('[QuickPublishWizard] Loaded campaign branding for:', target.name);
        
        // Save campaign_id to clip for payment tracking
        try {
          await updateClip(props.clip!.id, { campaign_id: target.campaignId });
          console.log('[QuickPublishWizard] Saved campaign_id to clip');
        } catch (e) {
          console.warn('[QuickPublishWizard] Failed to save campaign_id:', e);
        }
      }
    } else {
      // Personal build - use selected intro/outro from dialog
      intro = selectedIntro.value;
      outro = selectedOutro.value;
      watermark = props.watermarkSettings || null;
      
      // Download org intro/outro if needed
      if (intro) {
        const introAny = intro as any;
        if (introAny.isOrgAsset && introAny.serverId) {
          try {
            const introResult = await ensureAssetDownloaded({
              id: introAny.serverId,
              name: intro.name,
              asset_type: 'intro',
              url: introAny.serverUrl || intro.file_path,
              organization_id: Number(introAny.organization_id),
              organization_name: introAny.organization_name || undefined,
              duration: intro.duration || undefined,
              thumbnail_url: introAny.thumbnail_path || undefined,
              inserted_at: introAny.created_at,
              updated_at: introAny.updated_at,
            } as unknown as ServerOrganizationAsset);
            
            if (introResult.success && introResult.filePath) {
              intro = { ...intro, file_path: introResult.filePath };
            }
          } catch (e) {
            console.warn('[QuickPublishWizard] Failed to download personal intro:', e);
          }
        }
      }
      
      if (outro) {
        const outroAny = outro as any;
        if (outroAny.isOrgAsset && outroAny.serverId) {
          try {
            const outroResult = await ensureAssetDownloaded({
              id: outroAny.serverId,
              name: outro.name,
              asset_type: 'outro',
              url: outroAny.serverUrl || outro.file_path,
              organization_id: Number(outroAny.organization_id),
              organization_name: outroAny.organization_name || undefined,
              duration: outro.duration || undefined,
              thumbnail_url: outroAny.thumbnail_path || undefined,
              inserted_at: outroAny.created_at,
              updated_at: outroAny.updated_at,
            } as unknown as ServerOrganizationAsset);
            
            if (outroResult.success && outroResult.filePath) {
              outro = { ...outro, file_path: outroResult.filePath };
            }
          } catch (e) {
            console.warn('[QuickPublishWizard] Failed to download personal outro:', e);
          }
        }
      }
    }
    
    // Create build record in database with tracking fields
    // Use modulo to fit timestamp in u32 range (max 4,294,967,295)
    const buildNumber = Date.now() % 4294967295;
    const buildId = await createClipBuild(props.clip!.id, {
      aspectRatios: [target.aspectRatio],
      quality: quality.value,
      frameRate: frameRate.value,
      outputFormat: outputFormat.value,
      organizationId: target.organizationId || null,
      organizationName: target.organizationName || null,
      campaignId: target.campaignId || null,
      campaignName: target.campaignName || null,
      brandingProfileId: target.brandingProfileId ? String(target.brandingProfileId) : null,
      brandingType: target.type === 'org' ? 'org' : target.type === 'campaign' ? 'campaign' : 'personal',
    });
    
    console.log('[QuickPublishWizard] Created build record:', buildId, 'for', target.name);
    
    // Store build info
    allBuilds.push({
      target,
      buildNumber,
      buildId,
    });
    
    // Subtitle payload — pulls position into per-ratio config so the export uses
    // the same x/y/width the user dragged on the preview. Without this, the build
    // falls back to default bottom-center placement and the resize/reposition is
    // silently lost.
    const subtitlePayload = buildSubtitlePayloadForTarget(target.aspectRatio);

    // Build settings for this target
    const settings = {
      aspectRatios: [target.aspectRatio],
      quality: quality.value,
      frameRate: frameRate.value,
      format: outputFormat.value,
      intro,
      outro,
      watermark,
      framingMode: target.aspectRatio.includes('9:16') || target.aspectRatio.includes('4:5') ? 'manual' as const : undefined,
      manualFramingConfigs: target.aspectRatio.includes('9:16') || target.aspectRatio.includes('4:5') ? manualFramingConfigs.value : undefined,
      campaignId: target.campaignId || null,
      buildNumber,
      buildId,
      subtitleSettings: subtitlePayload?.settings ?? null,
      subtitleOverrides: subtitlePayload?.subtitleOverrides,
      transcriptWords: subtitlePayload?.transcriptWords ?? [],
      transcriptSegments: subtitlePayload?.transcriptSegments ?? [],
      maxWords: subtitlePayload?.maxWords,
    };
    
    console.log('[QuickPublishWizard] Starting build for target:', target.name, target.aspectRatio);
    
    // Start the build (non-blocking - don't await)
    // The global build event handler in App.vue will show completion notification
    buildPipeline.startBuild({
      clip: props.clip!,
      projectId: props.projectId!,
      settings,
      videoPath: props.clipPath!,
    }).catch((err) => {
      console.error('[QuickPublishWizard] Build failed for target:', target.name, err);
    });
    
    // Store build metadata for later use
    target.buildId = buildId;
    console.log('[QuickPublishWizard] Build started for target:', target.name, target.aspectRatio, 'buildId:', buildId);
  }
  
  console.log('[QuickPublishWizard] All builds completed successfully. Total builds:', allBuilds.length);
}

// Publish
async function handlePublish() {
  if (!canPublish.value) return;

  // Multi-target build flow
  if (buildTargets.value.length > 0) {
    console.log('[QuickPublishWizard] Publishing multi-target builds:', buildTargets.value.length);
    
    for (const target of buildTargets.value) {
      // Skip if no platforms selected
      if (target.selectedPlatforms.size === 0) {
        console.warn('[QuickPublishWizard] Skipping target without platforms:', target);
        continue;
      }
      
      // Build platform to ratio map for this target
      const platformToRatioMap: Record<string, string> = {};
      const publishTargets: PublishTarget[] = [];
      
      // Publish to each selected platform
      for (const [platformId, accountId] of target.selectedPlatforms.entries()) {
        if (!accountId) {
          console.warn('[QuickPublishWizard] Skipping platform without account:', platformId);
          continue;
        }
        
        const [accountType, accountIdStr] = accountId.split(':');
        publishTargets.push({
          platformId,
          accountType: accountType as 'org' | 'user',
          accountId: Number(accountIdStr),
        });
        
        // Map this platform to the target's aspect ratio
        platformToRatioMap[platformId] = target.aspectRatio;
      }
      
      // Build metadata with tracking fields
      const metadata = {
        clipId: props.clip?.id,
        clipBuildId: target.buildId,
        organizationId: target.organizationId,
        campaignId: target.campaignId,
        brandingProfileId: target.brandingProfileId,
        aspectRatio: target.aspectRatio,
        buildType: target.type,
        platformToRatioMap,
      };
      
      console.log('[QuickPublishWizard] Publishing target:', target.name, target.aspectRatio, 'to', publishTargets.length, 'platforms', metadata);
      
      backgroundPublish.queuePublish(
        publishTargets,
        caption.value,
        orgId.value,
        buildState.value.thumbnailPath,
        metadata
      );
      
      // Mark build as published
      if (target.buildId) {
        await markBuildAsPublished(target.buildId);
      }
    }
    
    hasQueuedBackgroundPublish.value = true;
    emit('close');
    return;
  }
  
  // Legacy single build flow (fallback)
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
}

async function handleNotNow() {
  if (isBuilding.value) return;
  
  console.log('[QuickPublishWizard] Not Now clicked - saving as manual clip project');
  
  try {
    // Create a manual clip project
    const projectName = `Manual Clip - ${props.clip?.current_version_name || props.clip?.name || 'Untitled'}`;
    const projectDescription = `Manual clip saved from Quick Publish wizard`;
    
    const projectId = await createProject(
      projectName,
      projectDescription,
      undefined, // no parent
      'Manual' // platform type
    );
    
    console.log('[QuickPublishWizard] Created manual clip project:', projectId, projectName);
    
    // Update the clip to link it to this project using direct database update
    if (props.clip?.id) {
      const { getDatabase, timestamp } = await import('@/services/database/core');
      const db = await getDatabase();
      const now = timestamp();
      await db.execute(
        'UPDATE clips SET project_id = ?, updated_at = ? WHERE id = ?',
        [projectId, now, props.clip.id]
      );
      console.log('[QuickPublishWizard] Linked clip to manual project');
    }
    
    // Show success message
    const { useToast } = await import('@/composables/useToast');
    const toast = useToast();
    toast.success('Clip saved to Manual Clips project');
    
    emit('close');
  } catch (error) {
    console.error('[QuickPublishWizard] Failed to save manual clip:', error);
    const { useToast } = await import('@/composables/useToast');
    const toast = useToast();
    toast.error('Failed to save clip');
  }
}

function handleClose() {
  if (isBuilding.value) return;
  buildPipeline.cleanup();
  if (!hasQueuedBackgroundPublish.value) {
    backgroundPublish.reset();
  }
  emit('close');
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

// Load available orgs and campaigns for the streamer (matching ClipBuildSettingsDialog)
async function loadOrgsAndCampaigns() {
  loadingOrgsAndCampaigns.value = true;
  try {
    // Get streamer name from clip's project or props
    const streamerName = props.clip?.project_name?.toLowerCase() || '';
    console.log('[QuickPublishWizard] Loading orgs/campaigns for streamer:', streamerName);
    
    // 1. Fetch org profiles assigned to user and filter by streamer match
    const orgRes = await getUserAssignedCreatorProfiles();
    const matchingOrgs: OrgSelection[] = [];
    
    // Get stream platform and streamer name for matching
    const streamPlatform = props.platform?.toLowerCase() || null;
    const streamProjectName = props.clip?.project_name?.toLowerCase() || '';
    
    console.log('[QuickPublishWizard] Stream info:', { 
      platform: streamPlatform, 
      projectName: streamProjectName 
    });
    
    if (orgRes.success && orgRes.profiles.length > 0) {
      // Group profiles by organization_id
      const profilesByOrg = new Map<number, ServerOrganizationCreatorProfile[]>();
      
      for (const profile of orgRes.profiles) {
        const orgId = profile.organization_id;
        if (!profilesByOrg.has(orgId)) {
          profilesByOrg.set(orgId, []);
        }
        profilesByOrg.get(orgId)!.push(profile);
      }
      
      // For each organization, select ONE profile based on priority
      for (const [orgId, profiles] of profilesByOrg.entries()) {
        let selectedProfile: ServerOrganizationCreatorProfile | null = null;
        
        // Priority 1: Profile with matching platform_links (streamer-specific match)
        if (streamPlatform && streamProjectName) {
          const matchingProfile = profiles.find(p => {
            if (!p.platform_links || p.platform_links.length === 0) return false;
            
            // Check if any platform_link matches the stream platform and name
            return p.platform_links.some((link: any) => {
              const linkPlatform = link.platform?.toLowerCase();
              const linkDisplayName = link.display_name?.toLowerCase() || '';
              const linkPlatformId = link.platform_id?.toLowerCase() || '';
              
              // Match if:
              // 1. Platform matches (kick, youtube, twitch, etc.)
              // 2. AND (display_name or platform_id matches the project name)
              const platformMatches = linkPlatform === streamPlatform;
              const nameMatches = 
                linkDisplayName.includes(streamProjectName) ||
                streamProjectName.includes(linkDisplayName) ||
                linkPlatformId.includes(streamProjectName) ||
                streamProjectName.includes(linkPlatformId);
              
              return platformMatches && nameMatches;
            });
          });
          
          if (matchingProfile) {
            selectedProfile = matchingProfile;
            console.log('[QuickPublishWizard] ✅ Selected streamer-specific profile:', {
              org: matchingProfile.organization_name,
              profile: matchingProfile.name,
              scope: matchingProfile.scope
            });
          }
        }
        
        // Priority 2: Global profile (fallback)
        if (!selectedProfile) {
          const globalProfile = profiles.find(p => p.scope === 'global');
          if (globalProfile) {
            selectedProfile = globalProfile;
            console.log('[QuickPublishWizard] ✅ Selected global profile:', {
              org: globalProfile.organization_name,
              profile: globalProfile.name,
              scope: globalProfile.scope
            });
          }
        }
        
        // Add the selected profile (only ONE per organization)
        if (selectedProfile) {
          matchingOrgs.push({
            profile: selectedProfile,
            selected: false,
            aspectRatios: [],
          });
        }
      }
    }
    
    availableOrgs.value = matchingOrgs;
    console.log('[QuickPublishWizard] Found', matchingOrgs.length, 'organizations with profiles');
    
    // 2. Fetch campaigns (global branding + creator-profile-specific)
    const campaignResults: Campaign[] = [];
    
    // Global branding campaigns
    const globalRes = await getMyGlobalBrandingCampaigns();
    if (globalRes.success && globalRes.campaigns) {
      campaignResults.push(...globalRes.campaigns);
    }
    
    // Profile-specific campaigns
    if (props.creatorProfileServerId) {
      const profileRes = await getCampaignsByCreatorProfile(props.creatorProfileServerId);
      if (profileRes.success && profileRes.campaigns) {
        for (const c of profileRes.campaigns) {
          if (!campaignResults.find((r) => r.id === c.id)) {
            campaignResults.push(c);
          }
        }
      }
    }
    
    // Filter out ended campaigns (only show active ones)
    const now = new Date();
    const activeCampaigns = campaignResults.filter(campaign => {
      if (!campaign.ends_at) return true; // No end date = always active
      const endsAt = new Date(campaign.ends_at);
      return endsAt > now; // Only include if end date is in the future
    });
    
    // Convert to CampaignSelection format
    availableCampaignSelections.value = activeCampaigns.map(campaign => ({
      campaign,
      selected: false,
      aspectRatios: [],
    }));
    
    // Also set legacy availableCampaigns for backward compatibility
    availableCampaigns.value = activeCampaigns;
    
    if (campaignResults.length > activeCampaigns.length) {
      console.log('[QuickPublishWizard] Filtered out', campaignResults.length - activeCampaigns.length, 'ended campaigns');
    }
    
    console.log('[QuickPublishWizard] Found', campaignResults.length, 'campaigns');
  } catch (e) {
    console.warn('[QuickPublishWizard] Failed to load orgs/campaigns:', e);
    availableOrgs.value = [];
    availableCampaignSelections.value = [];
    availableCampaigns.value = [];
  } finally {
    loadingOrgsAndCampaigns.value = false;
  }
}

// Toggle org selection
function toggleOrgSelection(index: number) {
  const org = availableOrgs.value[index];
  org.selected = !org.selected;
  if (!org.selected) {
    org.aspectRatios = [];
  }
}

// Toggle aspect ratio for org
function toggleOrgAspectRatio(orgIndex: number, ratio: string) {
  const org = availableOrgs.value[orgIndex];
  const ratioIndex = org.aspectRatios.indexOf(ratio);
  if (ratioIndex > -1) {
    org.aspectRatios.splice(ratioIndex, 1);
  } else {
    org.aspectRatios.push(ratio);
  }
}

// Toggle campaign selection
function toggleCampaignSelectionMulti(index: number) {
  const campaign = availableCampaignSelections.value[index];
  campaign.selected = !campaign.selected;
  if (!campaign.selected) {
    campaign.aspectRatios = [];
  }
}

// Toggle aspect ratio for campaign
function toggleCampaignAspectRatio(campaignIndex: number, ratio: string) {
  const campaign = availableCampaignSelections.value[campaignIndex];
  const ratioIndex = campaign.aspectRatios.indexOf(ratio);
  if (ratioIndex > -1) {
    campaign.aspectRatios.splice(ratioIndex, 1);
  } else {
    campaign.aspectRatios.push(ratio);
  }
}

// Check if any org or campaign is selected (for disabling intro/outro)
const hasOrgOrCampaignSelected = computed(() => {
  const hasSelectedOrg = availableOrgs.value.some(org => org.selected);
  const hasSelectedCampaign = availableCampaignSelections.value.some(c => c.selected);
  return hasSelectedOrg || hasSelectedCampaign;
});

// Check if multiple aspect ratios are selected
const hasMultipleAspectRatios = computed(() => selectedRatios.value.length > 1);

// Calculate total builds count
const totalBuildsCount = computed(() => {
  let count = 0;
  
  // Count org builds (each org × each aspect ratio = 1 build)
  for (const org of availableOrgs.value) {
    if (org.selected) {
      const ratios = hasMultipleAspectRatios.value && org.aspectRatios.length > 0 
        ? org.aspectRatios 
        : selectedRatios.value;
      count += ratios.length;
    }
  }
  
  // Count campaign builds
  for (const campaign of availableCampaignSelections.value) {
    if (campaign.selected) {
      const ratios = hasMultipleAspectRatios.value && campaign.aspectRatios.length > 0 
        ? campaign.aspectRatios 
        : selectedRatios.value;
      count += ratios.length;
    }
  }
  
  // If no org/campaign selected, it's a personal build
  if (count === 0) {
    count = selectedRatios.value.length;
  }
  
  return count;
});

// Legacy function for backward compatibility
async function loadAvailableCampaigns() {
  // Now handled by loadOrgsAndCampaigns
  await loadOrgsAndCampaigns();
}

async function loadAccounts() {
  loadingAccounts.value = true;
  try {
    const user = authStore.user;
    console.log('[QuickPublishWizard] Loading accounts for user:', user?.id, 'org:', user?.owned_organization_id);
    
    if (user?.owned_organization_id) {
      const orgRes = await listSocialAccounts(user.owned_organization_id);
      console.log('[QuickPublishWizard] Org accounts response:', orgRes);
      if (orgRes.success) {
        orgAccounts.value = orgRes.accounts || [];
        console.log('[QuickPublishWizard] Loaded org accounts:', orgAccounts.value.length);
      }
    }
    
    const [twitterRes, tiktokRes, instagramRes, youtubeRes] = await Promise.all([
      listUserTwitterAccounts(),
      listUserTiktokAccounts(),
      listUserInstagramAccounts(),
      listUserYoutubeAccounts(),
    ]);
    
    console.log('[QuickPublishWizard] Personal account responses:', {
      twitter: twitterRes,
      tiktok: tiktokRes,
      instagram: instagramRes,
      youtube: youtubeRes
    });
    
    if (twitterRes.success) personalTwitterAccounts.value = twitterRes.accounts || [];
    if (tiktokRes.success) personalTiktokAccounts.value = tiktokRes.accounts || [];
    if (instagramRes.success) personalInstagramAccounts.value = instagramRes.accounts || [];
    if (youtubeRes.success) personalYoutubeAccounts.value = youtubeRes.accounts || [];
    
    console.log('[QuickPublishWizard] Loaded personal accounts - Twitter:', personalTwitterAccounts.value.length, 
      'TikTok:', personalTiktokAccounts.value.length,
      'Instagram:', personalInstagramAccounts.value.length,
      'YouTube:', personalYoutubeAccounts.value.length);
  } catch (error) {
    console.error('[QuickPublishWizard] Failed to load accounts:', error);
  } finally {
    loadingAccounts.value = false;
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
  () => props.show,
  async (isOpen) => {
    console.warn('[QuickPublishWizard] show changed:', isOpen);
    if (isOpen) {
      console.warn('[QuickPublishWizard] Dialog opened, loading data...');
      hasQueuedBackgroundPublish.value = false;
      currentStep.value = 'subtitles';
      selectedRatios.value = ['16:9'];
      quality.value = 'high';
      frameRate.value = 30;
      outputFormat.value = 'mp4';
      manualFramingConfigs.value = {};
      selectedIntroId.value = null;
      selectedOutroId.value = null;
      subtitlesEnabled.value = false;
      selectedSubtitlePreset.value = 'neon-glow';
      subtitleSubState.value = 'choosing';
      wizardSubtitleSettings.value = null;
      wizardSubtitlePosition.value = { x: 50, y: 85, width: 80 };
      wizardTranscriptSegments.value = [];
      wizardTranscriptWords.value = [];
      clipTextOverlayRaw.value = null;
      subtitleFirstFrameUrl.value = null;
      subtitleTranscribeError.value = null;
      wizardTranscription.reset();
      isForCampaign.value = false;
      selectedCampaignId.value = null;
      platformConfigs.value = {};
      caption.value = '';
      
      // Reset multi-target selection state
      availableOrgs.value = [];
      availableCampaignSelections.value = [];
      buildTargets.value = [];
      
      buildPipeline.reset();
      if (!hasQueuedBackgroundPublish.value) {
        backgroundPublish.reset();
      }
      
      await Promise.all([
        loadIntroOutros(),
        loadCreatorProfileData(),
        loadAvailableCampaigns(),
        loadAccounts(),
        loadClipTextOverlay(),
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
      // Defer upload start to next tick to prevent UI freeze
      setTimeout(() => {
        backgroundPublish.startUpload(
          buildState.value.aspectRatioOutputPaths,
          buildState.value.thumbnailPath,
          orgId.value
        );
      }, 0);
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

.build-dialog__section-hint {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0.75rem 0;
}

.build-dialog__multi-select-section {
  margin-bottom: 1.5rem;
}

.build-dialog__multi-select-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.build-dialog__multi-select-item {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  padding: 0.5rem;
}

.build-dialog__multi-select-toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}

.build-dialog__multi-select-checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid var(--sidebar-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 150ms ease;
}

.build-dialog__multi-select-checkbox--checked {
  background: var(--sidebar-accent);
  border-color: var(--sidebar-accent);
}

.build-dialog__multi-select-checkbox--campaign.build-dialog__multi-select-checkbox--checked {
  background: rgb(249, 115, 22);
  border-color: rgb(249, 115, 22);
}

.build-dialog__multi-select-checkbox-icon {
  width: 12px;
  height: 12px;
  color: white;
}

.build-dialog__multi-select-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.build-dialog__campaign-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
}

.build-dialog__campaign-org-name {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.build-dialog__nested-ratios {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.25rem 2.5rem;
}

.build-dialog__ratio-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--sidebar-border);
  border-radius: 999px;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.build-dialog__ratio-chip:hover {
  background: rgba(255, 255, 255, 0.08);
}

.build-dialog__ratio-chip--selected {
  background: rgba(6, 182, 212, 0.15);
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
}

.build-dialog__ratio-chip-icon {
  width: 10px;
  height: 10px;
}

.build-dialog__builds-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  margin-bottom: 1rem;
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: 8px;
}

.build-dialog__builds-count {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-accent);
}

.build-dialog__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
  font-weight: 600;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.build-dialog__badge--global {
  background: rgba(147, 51, 234, 0.15);
  color: rgb(168, 85, 247);
  border: 1px solid rgba(147, 51, 234, 0.3);
}

.build-dialog__badge-icon {
  width: 10px;
  height: 10px;
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
  margin-top: 1.5rem;
}

.build-dialog__intro-outro-section--disabled {
  opacity: 0.6;
  pointer-events: none;
}

.build-dialog__disabled-notice {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  background-color: rgba(251, 146, 60, 0.1);
  border: 1px solid rgba(251, 146, 60, 0.3);
  border-radius: 6px;
  font-size: 0.75rem;
  color: rgb(251, 146, 60);
}

.build-dialog__dropdown-wrapper {
  position: relative;
  flex: 1;
}

.build-dialog__dropdown-trigger {
  width: 100%;
  padding: 0.75rem 1rem;
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
  gap: 0.5rem;
  text-align: left;
  font-family: inherit;
}

.build-dialog__dropdown-trigger:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.build-dialog__dropdown-trigger:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.build-dialog__dropdown-trigger--disabled,
.build-dialog__dropdown-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: rgba(39, 39, 42, 0.5);
}

.build-dialog__dropdown-trigger--disabled:hover,
.build-dialog__dropdown-trigger:disabled:hover {
  border-color: var(--sidebar-border);
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
.build-dialog__select {
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
.build-dialog__select:hover {
  border-color: rgba(6, 182, 212, 0.4);
}

.build-dialog__select:focus,
.build-dialog__select:focus {
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
  white-space: nowrap;
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

/* ===== Publish Step: Form & Fields ===== */
.build-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.build-dialog__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.build-dialog__field-hint {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.build-dialog__field-hint--error {
  color: #ef4444;
}

/* Platform pill grid */
.build-dialog__platform-grid,
.build-dialog__platforms {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.build-dialog__platform-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
}

.build-dialog__platform-option:hover {
  border-color: rgba(6, 182, 212, 0.3);
}

.build-dialog__platform-option--selected {
  background-color: rgba(6, 182, 212, 0.1);
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
}

.build-dialog__checkbox {
  display: none;
}

/* Input */
.build-dialog__input {
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

.build-dialog__input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.build-dialog__input::placeholder {
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}

/* Textarea */
.build-dialog__textarea {
  resize: vertical;
  min-height: 80px;
}

/* Caption counter */
.build-dialog__caption-info {
  text-align: right;
}

/* Aspect ratio groups container */
.build-dialog__aspect-ratio-groups {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Account aspect ratio tag */
.build-dialog__account-aspect-ratio {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  opacity: 0.7;
}

/* ===== Publish Step: Alerts ===== */
.build-dialog__alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
}

.build-dialog__alert--info {
  background-color: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.build-dialog__alert--error {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.build-dialog__alert-text {
  font-size: 0.875rem;
  margin: 0;
}

.build-dialog__build-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.build-dialog__progress-bar {
  height: 4px;
  background-color: var(--sidebar-border);
  border-radius: 2px;
  overflow: hidden;
}

.build-dialog__progress-fill {
  height: 100%;
  background-color: var(--sidebar-accent);
  transition: width 200ms ease;
}

.build-dialog__clip-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
}

.build-dialog__clip-thumbnail {
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

.build-dialog__clip-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.build-dialog__clip-info { flex: 1; min-width: 0; }

.build-dialog__clip-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.build-dialog__clip-meta {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin-top: 0.25rem;
}

.build-dialog__aspect-ratio-rows {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: 0.75rem;
}

.build-dialog__aspect-ratio-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  background-color: rgba(6, 182, 212, 0.05);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 6px;
}

.build-dialog__aspect-ratio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  min-width: 140px;
}

.build-dialog__account-aspect-ratio {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin-left: 0.25rem;
}

.build-dialog__caption-info { text-align: right; }

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

/* ===== Aspect Ratio Grouping ===== */
.build-dialog__aspect-ratio-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: visible;
  position: relative;
}

.build-dialog__aspect-ratio-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.build-dialog__aspect-ratio-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.75rem;
  background-color: rgba(6, 182, 212, 0.15);
  border: 1px solid rgba(6, 182, 212, 0.25);
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-accent);
}

.build-dialog__build-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.build-dialog__build-badge {
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid;
}

.build-dialog__build-badge--campaign {
  background-color: rgba(251, 146, 60, 0.15);
  border-color: rgba(251, 146, 60, 0.3);
  color: rgb(251, 146, 60);
}

.build-dialog__build-badge--org {
  background-color: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
  color: rgb(96, 165, 250);
}

.build-dialog__build-badge--personal {
  background-color: rgba(113, 113, 122, 0.15);
  border-color: rgba(113, 113, 122, 0.3);
  color: rgb(161, 161, 170);
}

/* ===== Account Configs ===== */
.build-dialog__account-configs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow: visible;
}

.build-dialog__account-config {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  overflow: visible;
  position: relative;
}

.build-dialog__account-config-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 100px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--sidebar-text-muted);
}

.build-dialog__dropdown-trigger--sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
}

.build-dialog__dropdown-chevron {
  flex-shrink: 0;
  color: var(--sidebar-text-muted);
  transition: transform 150ms ease;
}

.build-dialog__dropdown-chevron--open {
  transform: rotate(180deg);
}

.build-dialog__dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10001;
}

.build-dialog__dropdown-group {
  padding: 0.5rem 0.75rem 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.build-dialog__dropdown-item {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  text-align: left;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  cursor: pointer;
  transition: background-color 150ms ease;
}

.build-dialog__dropdown-item:hover {
  background-color: var(--sidebar-hover);
}

.build-dialog__dropdown-item--selected {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  font-weight: 500;
}

.build-dialog__badge-icon {
  width: 10px;
  height: 10px;
}

/* ===== Subtitles step: toggle ===== */
.build-dialog__toggle-box {
  background: var(--sidebar-bg, #1e1e22);
  border: 1px solid var(--sidebar-border, #2d2d33);
  border-radius: 8px;
  padding: 0.75rem 1rem;
}

.build-dialog__toggle {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: none;
  background: var(--sidebar-border, #3a3a42);
  cursor: pointer;
  transition: background 200ms ease;
  flex-shrink: 0;
  padding: 0;
}

.build-dialog__toggle--active {
  background: #8b5cf6;
}

.build-dialog__toggle-thumb {
  display: block;
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 200ms ease;
}

.build-dialog__toggle-thumb--active {
  transform: translateX(16px);
}

/* ===== Subtitles step: Yes/No choice ===== */
.build-dialog__subtitle-choice {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.build-dialog__subtitle-choice-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.75rem 1rem;
  border-radius: 12px;
  border: 2px solid var(--sidebar-border, #2d2d33);
  background: var(--sidebar-bg, #1e1e22);
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease, transform 100ms ease;
  text-align: center;
  color: var(--sidebar-text, #e4e4e7);
}

.build-dialog__subtitle-choice-btn:hover {
  transform: translateY(-2px);
}

.build-dialog__subtitle-choice-btn--yes {
  border-color: var(--sidebar-accent);
}
.build-dialog__subtitle-choice-btn--yes:hover {
  border-color: var(--sidebar-accent);
  background: rgba(6, 182, 212, 0.1);
}

.build-dialog__subtitle-choice-btn--no {
  border-color: var(--sidebar-border, #2d2d33);
}
.build-dialog__subtitle-choice-btn--no:hover {
  border-color: #52525b;
  background: rgba(82, 82, 91, 0.15);
}

.build-dialog__subtitle-choice-label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--sidebar-text, #e4e4e7);
}

.build-dialog__subtitle-choice-hint {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted, #71717a);
  line-height: 1.3;
}

/* ===== Subtitles step: transcribing spinner ===== */
.build-dialog__transcribing-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 0;
}

.build-dialog__spinner--large {
  animation: spin 1s linear infinite;
  color: var(--sidebar-accent);
}

.build-dialog__progress-track {
  width: 100%;
  max-width: 320px;
  height: 4px;
  border-radius: 999px;
  background: var(--sidebar-border, #2d2d33);
  overflow: hidden;
}

.build-dialog__progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--sidebar-accent), #0891b2);
  transition: width 300ms ease;
}

.build-dialog__transcribing-pct {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted, #71717a);
  font-variant-numeric: tabular-nums;
}

/* ===== Subtitles step: editing layout ===== */
.build-dialog__subtitle-editing-note {
  margin: -0.5rem 0 0;
  color: var(--sidebar-text-muted, #71717a);
  font-size: 0.75rem;
  line-height: 1.4;
  text-align: center;
}

.build-dialog__subtitle-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.build-dialog__subtitle-canvas-col {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.build-dialog__subtitle-canvas-label {
  font-size: 0.625rem;
  color: var(--sidebar-text-muted, #71717a);
  margin: 0;
  text-align: center;
}

.build-dialog__subtitle-panel {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--sidebar-border, #2d2d33);
  background: var(--sidebar-surface, #18181b);
  display: flex;
  flex-direction: column;
  height: clamp(260px, 36vh, 360px);
  min-height: 260px;
  overflow: hidden;
}

.build-dialog__subtitle-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border-bottom: 1px solid var(--sidebar-border, #2d2d33);
  color: var(--sidebar-text, #e4e4e7);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  flex-shrink: 0;
}

.build-dialog__subtitle-panel-header span:last-child {
  color: var(--sidebar-text-muted, #71717a);
  font-size: 0.6875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 500;
}

.build-dialog__subtitle-panel-content {
  flex: 1 1 0;
  min-height: 0;
}

/* ===== Subtitles step: preset cards ===== */
.detect-clips-dialog__preset-card {
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--sidebar-border, #2d2d33);
  background: var(--sidebar-bg, #1e1e22);
  cursor: pointer;
  text-align: left;
  transition: border-color 150ms ease, background 150ms ease;
}

.detect-clips-dialog__preset-card:hover {
  border-color: #6d28d9;
  background: rgba(109, 40, 217, 0.08);
}

.detect-clips-dialog__preset-card--selected {
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.12);
}

.detect-clips-dialog__preset-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.375rem;
  color: var(--sidebar-text, #e4e4e7);
}

.detect-clips-dialog__preset-check {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #8b5cf6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.detect-clips-dialog__preset-sample {
  border-radius: 4px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 0.25rem;
}
</style>

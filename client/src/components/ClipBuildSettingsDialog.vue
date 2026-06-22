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
              <button class="build-dialog__close" @click="close" title="Close">
                <X :size="18" />
              </button>
              <div class="build-dialog__icon">
                <WrenchIcon :size="24" />
              </div>
              <h2 class="build-dialog__title">Export Configuration</h2>
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
                  <!-- Step Circle -->
                  <button
                    @click="goToStep(step.id)"
                    :disabled="!canNavigateToStep(step.id)"
                    class="build-dialog__step"
                    :class="{
                      'build-dialog__step--active': currentStep === step.id,
                      'build-dialog__step--completed': isStepCompleted(step.id) && currentStep !== step.id,
                      'build-dialog__step--disabled': !canNavigateToStep(step.id),
                    }"
                  >
                    <div class="build-dialog__step-circle">
                      <CheckIcon
                        v-if="isStepCompleted(step.id) && currentStep !== step.id"
                        class="build-dialog__step-icon"
                      />
                      <component v-else :is="step.icon" class="build-dialog__step-icon" />
                    </div>
                    <span class="build-dialog__step-label">
                      {{ step.label }}
                    </span>
                  </button>

                  <!-- Connector Line -->
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
                            <CheckIcon
                              v-if="selectedRatios.includes('16:9')"
                              class="build-dialog__platform-check-icon"
                            />
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
                            <CheckIcon
                              v-if="selectedRatios.includes('9:16')"
                              class="build-dialog__platform-check-icon"
                            />
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
                            <CheckIcon
                              v-if="selectedRatios.includes('1:1')"
                              class="build-dialog__platform-check-icon"
                            />
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
                            <CheckIcon
                              v-if="selectedRatios.includes('4:5')"
                              class="build-dialog__platform-check-icon"
                            />
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

                <!-- Step 2: Framing (conditional) -->
                <Transition name="step-slide" mode="out-in">
                  <div v-if="currentStep === 'framing'" key="framing" class="build-dialog__step-content">
                    <div class="build-dialog__step-header">
                      <h3 class="build-dialog__step-title">Framing & Layout</h3>
                      <p class="build-dialog__step-subtitle">Configure cropping and subtitle positioning</p>
                    </div>

                    <!-- Portrait Framing Mode (only when portrait ratios selected) -->
                    <div v-if="hasPortraitRatio" class="build-dialog__framing-section">
                      <div class="build-dialog__section-header">
                        <CropIcon class="build-dialog__section-icon" />
                        <h4 class="build-dialog__section-title">Portrait Cropping</h4>
                      </div>

                      <!-- Mode Toggle -->
                      <div class="build-dialog__framing-grid">
                        <button
                          disabled
                          class="build-dialog__framing-mode build-dialog__framing-mode--disabled"
                        >
                          <div class="build-dialog__framing-mode-header">
                            <div
                              class="build-dialog__framing-mode-icon"
                            >
                              <SparklesIcon class="build-dialog__framing-icon" />
                            </div>
                            <span class="build-dialog__framing-mode-label">Auto</span>
                          </div>
                          <p class="build-dialog__framing-mode-desc">
                            Coming soon - Use manual configuration
                          </p>
                        </button>

                        <button
                          @click="framingMode = 'manual'"
                          class="build-dialog__framing-mode"
                          :class="{ 'build-dialog__framing-mode--active': framingMode === 'manual' }"
                        >
                          <div class="build-dialog__framing-mode-header">
                            <div
                              class="build-dialog__framing-mode-icon"
                              :class="{ 'build-dialog__framing-mode-icon--active': framingMode === 'manual' }"
                            >
                              <PencilRulerIcon class="build-dialog__framing-icon" />
                            </div>
                            <span class="build-dialog__framing-mode-label">Manual</span>
                          </div>
                          <p class="build-dialog__framing-mode-desc">
                            Manually configure regions for each aspect ratio
                          </p>
                        </button>
                      </div>

                      <!-- Manual mode configuration -->
                      <Transition name="slide-fade">
                        <div v-if="framingMode === 'manual'" class="build-dialog__manual-config">
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

                          <div v-if="loadingVideoFrame" class="build-dialog__loading-hint">
                            Loading video preview...
                          </div>
                        </div>
                      </Transition>
                    </div>

                    <!-- Empty state when no content to show -->
                    <div
                      v-if="!hasPortraitRatio"
                      class="build-dialog__empty-state"
                    >
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
                          {{
                            frameRate === 30 ? 'Standard for most platforms' : 'Smoother motion for fast-paced content'
                          }}
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
                      <p class="build-dialog__step-subtitle">Add intro/outro clips and customize subtitles</p>
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
                            :key="org.organizationId"
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
                              <span class="build-dialog__multi-select-name">{{ org.organizationName }}</span>
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
                              @click="toggleCampaignSelection(campaignIndex)"
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

                      <!-- Intro/Outro section - hidden for free tier users (admin-controlled) -->
                      <!-- Disabled when orgs/campaigns are selected (branding comes from their profiles) -->
                      <div v-if="!isFreeTier" class="build-dialog__intro-outro-section" :class="{ 'build-dialog__intro-outro-section--disabled': hasOrgOrCampaignSelected }">
                      <div v-if="hasOrgOrCampaignSelected" class="build-dialog__disabled-notice">
                        <span>Branding from organization or campaign (applied per build target)</span>
                      </div>
                      <!-- Intro Compact Selector -->
                      <div class="build-dialog__field">
                        <div class="build-dialog__field-header">
                          <label class="build-dialog__field-label">Intro</label>
                          <div class="build-dialog__field-badges">
                            <span v-if="selectedIntro?.isOrgAsset" class="build-dialog__badge build-dialog__badge--org">
                              <Building2 class="build-dialog__badge-icon" />
                              Org
                            </span>
                            <span
                              v-if="defaultIntro && selectedIntro?.id === defaultIntro.id"
                              class="build-dialog__badge build-dialog__badge--default"
                            >
                              Creator Default
                            </span>
                          </div>
                        </div>
                        <div class="build-dialog__dropdown-wrapper">
                          <button
                            ref="introButtonRef"
                            @click="toggleIntroDropdown"
                            :disabled="hasOrgOrCampaignSelected"
                            class="build-dialog__dropdown-trigger"
                            :class="{ 'build-dialog__dropdown-trigger--disabled': hasOrgOrCampaignSelected }"
                          >
                            <span class="build-dialog__dropdown-text">
                              {{
                                selectedIntro
                                  ? `${selectedIntro.name} (${formatDuration(selectedIntro.duration || 0)})`
                                  : 'None'
                              }}
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
                                    <span
                                      v-if="intro.isOrgAsset"
                                      class="build-dialog__badge build-dialog__badge--org-small"
                                    >
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
                            <span v-if="selectedOutro?.isOrgAsset" class="build-dialog__badge build-dialog__badge--org">
                              <Building2 class="build-dialog__badge-icon" />
                              Org
                            </span>
                            <span
                              v-if="defaultOutro && selectedOutro?.id === defaultOutro.id"
                              class="build-dialog__badge build-dialog__badge--default"
                            >
                              Creator Default
                            </span>
                          </div>
                        </div>
                        <div class="build-dialog__dropdown-wrapper">
                          <button
                            ref="outroButtonRef"
                            @click="toggleOutroDropdown"
                            :disabled="hasOrgOrCampaignSelected"
                            class="build-dialog__dropdown-trigger"
                            :class="{ 'build-dialog__dropdown-trigger--disabled': hasOrgOrCampaignSelected }"
                          >
                            <span class="build-dialog__dropdown-text">
                              {{
                                selectedOutro
                                  ? `${selectedOutro.name} (${formatDuration(selectedOutro.duration || 0)})`
                                  : 'None'
                              }}
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
                                    <span
                                      v-if="outro.isOrgAsset"
                                      class="build-dialog__badge build-dialog__badge--org-small"
                                    >
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
              </div>
            </div>

            <!-- Footer with Navigation -->
            <div class="build-dialog__footer">
              <!-- Back button or spacer -->
              <div class="build-dialog__footer-left">
                <button v-if="!isFirstStep" @click="previousStep" class="build-dialog__btn build-dialog__btn--back">
                  <ArrowLeftIcon class="build-dialog__btn-icon" />
                  Back
                </button>
              </div>

              <!-- Step info -->
              <div class="build-dialog__step-info">Step {{ currentStepIndex + 1 }} of {{ visibleSteps.length }}</div>

              <!-- Next/Build button -->
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
                  @click="confirmBuild"
                  :disabled="!canProceed"
                  class="build-dialog__btn build-dialog__btn--primary"
                  :class="{ 'build-dialog__btn--disabled': !canProceed }"
                >
                  <WrenchIcon class="build-dialog__btn-icon" />
                  <span>{{ publishMode ? 'Build & Publish' : `Build ${totalBuildsCount > 0 ? totalBuildsCount : selectedRatios.length} Video${(totalBuildsCount > 0 ? totalBuildsCount : selectedRatios.length) !== 1 ? 's' : ''}` }}</span>
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
      :layout-overlays="vodPresetConfig?.layoutOverlays"
      :overlay-preview-urls="overlayPreviewUrls"
      :subtitle-settings="subtitleSettingsForPOIEditor"
      :subtitle-position-override="getSubtitlePositionForRatio(editingAspectRatio)"
      :transcript-words="transcriptWords"
      :transcript-segments="transcriptSegments"
      :clip-id="clip?.id ?? null"
      :project-id="clipProjectId"
      :clip-text-overlay-json="clipTextOverlayRaw"
      @confirm="onManualConfigConfirm"
      @subtitlePositionChange="onSubtitlePositionChange"
      @subtitleSettingsChange="onSubtitleSettingsChange"
      @clip-text-overlay-change="onClipTextOverlayChange"
    />

    <!-- Subtitle Adjustment Dialog -->
    <SubtitleAdjustmentDialog
      v-model="showSubtitleAdjustmentDialog"
      :aspect-ratio="editingSubtitleRatio"
      :subtitle-settings="subtitleSettings"
      :initial-override="subtitleOverrides[editingSubtitleRatio as keyof SubtitleOverrides]"
      :thumbnail-url="videoFrameUrl || thumbnailUrl"
      :video-path="videoPath"
      :clip-start-time="clipStartTime"
      :clip-end-time="clipEndTime"
      @confirm="onSubtitleOverrideConfirm"
    />
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
  import {
    WrenchIcon,
    CheckIcon,
    X,
    ChevronDown,
    ChevronRightIcon,
    SparklesIcon,
    PencilRulerIcon,
    Type,
    ArrowLeftIcon,
    ArrowRightIcon,
    LayoutGridIcon,
    CropIcon,
    SettingsIcon,
    SparkleIcon,
    Building2,
    Megaphone,
    Globe,
  } from 'lucide-vue-next';
  import type { ClipWithVersion, WatermarkSettings } from '@/services/database';
  import { getAllIntroOutros, type IntroOutro } from '@/services/database';
  import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { resolveOverlayImagePath } from '@/services/database/watermarks';
  import { useAuthStore } from '@/stores/auth';
  import { useFreeTierLimits } from '@/composables/useFreeTierLimits';
  import { useTranscriptData } from '@/composables/useTranscriptData';
  import ManualPOIEditor from './poi/ManualPOIEditor.vue';
  import { parseClipTextOverlayJson } from '@/utils/clipTextBox';
  import SubtitleAdjustmentDialog from './SubtitleAdjustmentDialog.vue';
  import {
    getMyGlobalBrandingCampaigns,
    getCampaignsByCreatorProfile,
    type Campaign,
  } from '@/services/campaignApi';
  import { type ServerOrganizationCreatorProfile } from '@/services/organizationProfilesApi';
  import type {
    ManualFramingConfig,
    SubtitleOverride,
    SubtitleOverrides,
    SubtitleSettings,
    IntroOutroRef,
  } from '@/types';
  import { resolveSelectionBrandingPreview } from '@/composables/useOrgCampaignBuildBranding';
  import {
    getSelfContainedClipDuration,
    isSelfContainedClip as checkSelfContainedClip,
    normalizePathForCompare,
    resolveClipVideoSourceForPreview,
  } from '@/utils/selfContainedClip';

  // Extended IntroOutro type that can be a local asset or server org asset
  interface IntroOutroItem extends Omit<IntroOutro, 'id'> {
    id: string;
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string; // For org assets, the streaming URL
  }

  // Step definitions
  type StepId = 'platforms' | 'framing' | 'export' | 'addons';

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
  ];

  // Current step state
  const currentStep = ref<StepId>('platforms');

  const props = defineProps<{
    modelValue: boolean;
    clip: ClipWithVersion | null;
    watermarkSettings?: WatermarkSettings | null;
    // Creator profile default assets (auto-applied when dialog opens)
    defaultIntro?: IntroOutroRef | null;
    defaultOutro?: IntroOutroRef | null;
    thumbnailUrl?: string | null;
    subtitleSettings?: SubtitleSettings | null;
    // Pre-configured aspect ratio settings from ClipEditor's AspectTab
    initialAspectRatios?: string[] | null;
    initialFramingMode?: 'auto' | 'manual' | null;
    initialFramingConfigs?: import('@/types').ManualFramingConfigs | null;
    vodPresetConfig?: import('@/types').ActiveVodPresetConfig | null;
    // Server ID of the creator profile for this clip (used to fetch profile-specific campaigns)
    creatorProfileServerId?: number | null;
    // Publish mode - when true, shows "Build & Publish" and emits build-complete event
    publishMode?: boolean;
    // Single ratio mode - when true, only one aspect ratio can be selected at a time
    singleRatioMode?: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [settings: BuildSettings];
    'build-complete': [buildIds: string[]];
  }>();

  // Build target for multi-org/campaign builds
  export interface BuildTarget {
    type: 'org' | 'campaign' | 'personal';
    id: number | null;
    name: string;
    brandingProfileId?: number | null;
    aspectRatios: string[];
    organizationId?: number;
    organizationName?: string;
    selectedPlatforms?: Map<string, any>;
  }

  export interface BuildSettings {
    aspectRatios: string[];
    quality: 'low' | 'medium' | 'high';
    frameRate: 30 | 60;
    format: 'mp4' | 'mov';
    intro: IntroOutroItem | null;
    outro: IntroOutroItem | null;
    watermark: WatermarkSettings | null;
    framingMode?: 'auto' | 'manual';
    manualFramingConfig?: import('@/types').ManualFramingConfig;
    manualFramingConfigs?: import('@/types').ManualFramingConfigs;
    /** Full subtitle styling to burn in (when enabled). */
    subtitleSettings?: SubtitleSettings | null;
    subtitleOverrides?: SubtitleOverrides;
    /** Word-level transcript needed for subtitle generation. */
    transcriptWords?: import('@/types').WordInfo[];
    /** Segment-level transcript for chunk paging. */
    transcriptSegments?: import('@/types').WhisperSegment[];
    /** Max words per subtitle chunk; per-aspect-ratio caller may override. */
    maxWords?: number;
    layoutOverlays?: import('@/types').LayoutOverlay[];
    // Multi-build targets (orgs and campaigns with their aspect ratios)
    buildTargets?: BuildTarget[];
    // Legacy single campaign fields (kept for backward compatibility)
    campaignId?: number | null;
    selectedCampaign?: import('@/services/campaignApi').Campaign | null;
    campaignBrandingProfileId?: number | null;
    brandingType?: 'org' | 'campaign' | 'personal' | 'none';
    organizationId?: number | null;
    organizationName?: string | null;
    // Pre-created build record IDs — when provided, pipeline skips creating a new record
    buildId?: string;
    buildNumber?: number;
  }

  // Re-export the IntroOutroItem type for use in other components
  export type { IntroOutroItem };

  // Auth store for checking org memberships
  const authStore = useAuthStore();

  // Free tier limits composable
  const { isFreeTier } = useFreeTierLimits();

  // Multi-org/campaign selection state
  interface OrgSelection {
    organizationId: number;
    organizationName: string;
    resolvedProfile: import('@/services/database/types').CreatorProfileWithLinks;
    serverProfile: ServerOrganizationCreatorProfile;
    selected: boolean;
    aspectRatios: string[];
  }
  interface CampaignSelection {
    campaign: Campaign;
    selected: boolean;
    aspectRatios: string[];
  }
  
  const availableOrgs = ref<OrgSelection[]>([]);
  const availableCampaignSelections = ref<CampaignSelection[]>([]);
  const loadingOrgsAndCampaigns = ref(false);
  
  // Legacy campaign selection state (kept for backward compatibility)
  const isForCampaign = ref(false);
  const availableCampaigns = ref<Campaign[]>([]);
  const selectedCampaign = ref<Campaign | null>(null);
  const loadingCampaigns = ref(false);
  const showCampaignDropdown = ref(false);
  const campaignButtonRef = ref<HTMLElement | null>(null);
  const campaignDropdownRef = ref<HTMLElement | null>(null);
  const campaignDropdownPosition = ref<{ top: string; left: string; width: string; maxHeight: string }>({
    top: '0px',
    left: '0px',
    width: '0px',
    maxHeight: '192px',
  });

  // State
  const selectedRatios = ref<string[]>(['16:9']);
  const quality = ref<'low' | 'medium' | 'high'>('high');
  const frameRate = ref<30 | 60>(30);
  const outputFormat = ref<'mp4' | 'mov'>('mp4');
  const intros = ref<IntroOutroItem[]>([]);
  const outros = ref<IntroOutroItem[]>([]);
  const selectedIntro = ref<IntroOutroItem | null>(null);
  const selectedOutro = ref<IntroOutroItem | null>(null);
  const loadingAssets = ref(false);
  const showIntroDropdown = ref(false);
  const showOutroDropdown = ref(false);

  // Framing mode state (forced to manual since auto is not implemented)
  const framingMode = ref<'auto' | 'manual'>('manual');
  const manualFramingConfigs = ref<import('@/types').ManualFramingConfigs>({});
  const showManualPOIEditor = ref(false);
  /** Synced from DB on dialog open; updated when POI editor persists clip text box */
  const clipTextOverlayRaw = ref<string | null>(null);
  const editingAspectRatio = ref<string>('9:16');
  const videoFrameUrl = ref<string | null>(null);
  const loadingVideoFrame = ref(false);
  const videoPath = ref<string | null>(null);
  let loadVideoFrameGeneration = 0;

  // Overlay preview state for ManualPOIEditor
  const overlayPreviewUrls = ref<Record<string, string>>({});

  // Use transcript data composable for the clip's project
  const clipProjectId = computed(() => {
    const clip = props.clip as { segment_id?: string; project_id?: string } | null;
    return clip?.segment_id || clip?.project_id || null;
  });
  const { transcriptData } = useTranscriptData(clipProjectId);

  /** True when the clip's extracted MP4 is the full playable source (0-based). */
  const isSelfContainedClip = computed(() => checkSelfContainedClip(props.clip));

  /**
   * Per-clip transcript for self-contained clips. The project-wide transcript
   * (returned by `getTranscriptByProjectId`) is the LONGEST transcript across
   * all auto-detected clips in the same project, so it's almost always the
   * wrong one for the currently selected clip. We instead resolve the clip's
   * own raw_video by its file_path and load that transcript directly.
   */
  interface SelfContainedTranscriptData {
    words: import('@/utils/timelineUtils').WordInfo[];
    whisperSegments: import('@/types').WhisperSegment[];
  }
  const selfContainedTranscriptData = ref<SelfContainedTranscriptData | null>(null);

  async function loadSelfContainedTranscriptForClip() {
    selfContainedTranscriptData.value = null;
    const clip = props.clip;
    if (!clip || !isSelfContainedClip.value) return;
    if (!clip.project_id || !clip.file_path) return;

    try {
      const { getRawVideosByProjectId, getTranscriptByRawVideoId } = await import('@/services/database');
      const { parseTranscriptToWords } = await import('@/utils/timelineUtils');
      const rawVideos = await getRawVideosByProjectId(clip.project_id);
      const targetPath = normalizePathForCompare(clip.file_path);
      const rawVideo = rawVideos.find((rv) => normalizePathForCompare(rv.file_path) === targetPath);
      if (!rawVideo) {
        console.warn(
          '[ClipBuildSettingsDialog] No raw video matched self-contained clip file_path:',
          clip.file_path
        );
        return;
      }
      const transcript = await getTranscriptByRawVideoId(rawVideo.id);
      if (!transcript?.raw_json) return;

      const words = parseTranscriptToWords(transcript.raw_json);
      let whisperSegments: import('@/types').WhisperSegment[] = [];
      try {
        const parsed = JSON.parse(transcript.raw_json);
        if (Array.isArray(parsed?.segments)) {
          whisperSegments = parsed.segments.map((segment: any, index: number) => ({
            id: segment.id ?? index,
            start: Number(segment.start) || 0,
            end: Number(segment.end) || 0,
            text: segment.text || '',
            words: Array.isArray(segment.words)
              ? segment.words.map((w: any) => ({
                  word: String(w.word || '').trim(),
                  start: Number(w.start) || 0,
                  end: Number(w.end) || 0,
                  confidence: w.confidence,
                }))
              : undefined,
          }));
        }
      } catch (err) {
        console.warn('[ClipBuildSettingsDialog] Failed to parse self-contained whisper segments:', err);
      }

      selfContainedTranscriptData.value = { words, whisperSegments };
    } catch (err) {
      console.warn('[ClipBuildSettingsDialog] Failed to load self-contained transcript:', err);
    }
  }

  // Reload the per-clip transcript when the clip changes or the dialog opens.
  watch(
    () => [props.modelValue, props.clip?.id, isSelfContainedClip.value] as const,
    ([open]) => {
      if (open && isSelfContainedClip.value) {
        void loadSelfContainedTranscriptForClip();
      } else {
        selfContainedTranscriptData.value = null;
      }
    },
    { immediate: true }
  );

  // Get transcript words and segments for the current clip (filtered and adjusted)
  const transcriptWords = computed(() => {
    if (!props.clip) return [];

    if (isSelfContainedClip.value) {
      // Self-contained clip transcripts are already stored with timestamps
      // relative to the clip start (0..duration), so no offset/filter is needed.
      return selfContainedTranscriptData.value?.words || [];
    }

    if (!transcriptData.value?.words) return [];
    const clipStart = props.clip.current_version_start_time || 0;
    const clipEnd = props.clip.current_version_end_time || clipStart + (props.clip.duration || 0);

    // Include words that overlap the clip window, then normalize to clip-relative time.
    return transcriptData.value.words
      .filter((w) => w.end > clipStart && w.start < clipEnd)
      .map((w) => ({
        ...w,
        start: Math.max(0, w.start - clipStart),
        end: Math.min(clipEnd - clipStart, w.end - clipStart),
      }));
  });

  const transcriptSegments = computed(() => {
    if (!props.clip) return [];

    if (isSelfContainedClip.value) {
      // Already clip-relative (0..duration). Return as-is.
      return selfContainedTranscriptData.value?.whisperSegments || [];
    }

    if (!transcriptData.value?.whisperSegments) return [];
    const clipStart = props.clip.current_version_start_time || 0;
    const clipEnd = props.clip.current_version_end_time || clipStart + (props.clip.duration || 0);

    // Include segments that overlap the clip window, then normalize to clip-relative time.
    return transcriptData.value.whisperSegments
      .filter((s) => s.end > clipStart && s.start < clipEnd)
      .map((s) => ({
        ...s,
        start: Math.max(0, s.start - clipStart),
        end: Math.min(clipEnd - clipStart, s.end - clipStart),
        words: s.words
          ?.filter((w) => w.end > clipStart && w.start < clipEnd)
          .map((w) => ({
            ...w,
            start: Math.max(0, w.start - clipStart),
            end: Math.min(clipEnd - clipStart, w.end - clipStart),
          })),
      }));
  });

  // Subtitle override state - stores per-ratio customizations
  const subtitleOverrides = ref<SubtitleOverrides>({});
  const showSubtitleAdjustmentDialog = ref(false);
  const editingSubtitleRatio = ref<string>('16:9');
  
  // Local mutable copy of subtitle settings (can be updated from ManualPOIEditor)
  const localSubtitleSettings = ref<SubtitleSettings | null>(null);
  
  // Initialize and sync local subtitle settings from prop
  watch(() => props.subtitleSettings, (settings) => {
    if (settings) {
      // Always sync from prop to ensure we have latest data
      localSubtitleSettings.value = { ...settings };
      console.log('[ClipBuildSettingsDialog] Synced local subtitle settings from prop:', {
        animationStyle: localSubtitleSettings.value.animationStyle,
        border1Width: localSubtitleSettings.value.border1Width,
        border2Width: localSubtitleSettings.value.border2Width
      });
    }
  }, { immediate: true, deep: true });
  
  // Use local settings if available, otherwise fall back to prop
  const effectiveSubtitleSettings = computed(() => localSubtitleSettings.value || props.subtitleSettings);
  
  // Compute subtitle settings for POI editor, merging per-ratio overrides
  // This ensures the POI editor shows the correct settings for the current ratio
  const subtitleSettingsForPOIEditor = computed((): SubtitleSettings | null => {
    const base = effectiveSubtitleSettings.value;
    if (!base) return null;
    
    const ratio = editingAspectRatio.value;
    const ratioOverride = subtitleOverrides.value[ratio as keyof SubtitleOverrides];
    
    if (ratioOverride) {
      // Merge per-ratio override into base settings, excluding position (different types)
      const { position: _xyPos, ...overrideWithoutPosition } = ratioOverride;
      const merged: SubtitleSettings = { ...base, ...overrideWithoutPosition };
      console.log('[ClipBuildSettingsDialog] subtitleSettingsForPOIEditor merged for', ratio, ':', {
        baseAnimationStyle: base.animationStyle,
        overrideAnimationStyle: (ratioOverride as any).animationStyle,
        resultAnimationStyle: merged.animationStyle,
        overrideMultiColorEnabled: (ratioOverride as any).multiColorEnabled,
      });
      return merged;
    }
    
    return base;
  });

  // Clip timing for video preview.
  // For self-contained clips (auto/manual livestream), the playable file IS the
  // clip, so the preview timeline must run 0..duration. The stored
  // current_version_start_time/end_time are absolute stream timestamps and do
  // not exist inside the extracted file — using them would seek beyond EOF and
  // also break subtitle filtering.
  const clipStartTime = computed(() => {
    if (isSelfContainedClip.value) return 0;
    return props.clip?.current_version_start_time || 0;
  });
  const clipEndTime = computed(() => {
    if (isSelfContainedClip.value && props.clip) {
      return getSelfContainedClipDuration(props.clip);
    }
    return props.clip?.current_version_end_time || 0;
  });

  // Check if portrait ratios are selected (need framing options)
  const hasPortraitRatio = computed(() => {
    const portraitRatios = ['9:16', '4:5', '1:1'];
    return selectedRatios.value.some((r) => portraitRatios.includes(r));
  });

  // Check if subtitles need configuration
  const hasSubtitlesEnabled = computed(() => {
    return effectiveSubtitleSettings.value?.enabled && selectedRatios.value.length > 0;
  });

  const hasClipTextBoxEnabled = computed(() => {
    const s = parseClipTextOverlayJson(clipTextOverlayRaw.value);
    return Boolean(s?.enabled);
  });

  // Visible steps (framing step shown when portrait ratios selected OR subtitles OR clip text box)
  const visibleSteps = computed(() => {
    return allSteps.filter((step) => {
      if (step.id === 'framing') {
        return (
          hasPortraitRatio.value ||
          hasSubtitlesEnabled.value ||
          hasClipTextBoxEnabled.value
        );
      }
      return true;
    });
  });

  // Current step index
  const currentStepIndex = computed(() => {
    return visibleSteps.value.findIndex((s) => s.id === currentStep.value);
  });

  // Navigation helpers
  const isFirstStep = computed(() => currentStepIndex.value === 0);
  const isLastStep = computed(() => currentStepIndex.value === visibleSteps.value.length - 1);

  // Check if user can proceed to next step
  const canProceed = computed(() => {
    switch (currentStep.value) {
      case 'platforms':
        return selectedRatios.value.length > 0;
      case 'framing':
        // Always can proceed - auto mode doesn't require configuration
        return true;
      case 'export':
        return true;
      case 'addons':
        return selectedRatios.value.length > 0;
      default:
        return true;
    }
  });

  // Check if a step is completed
  function isStepCompleted(stepId: StepId): boolean {
    const stepIndex = visibleSteps.value.findIndex((s) => s.id === stepId);
    return stepIndex < currentStepIndex.value;
  }

  // Check if user can navigate to a specific step
  function canNavigateToStep(stepId: StepId): boolean {
    const stepIndex = visibleSteps.value.findIndex((s) => s.id === stepId);
    // Can navigate to current step or any completed step
    // Can also navigate to next step if current step is valid
    if (stepIndex <= currentStepIndex.value) return true;
    if (stepIndex === currentStepIndex.value + 1 && canProceed.value) return true;
    return false;
  }

  // Navigate to specific step
  function goToStep(stepId: StepId) {
    if (canNavigateToStep(stepId)) {
      currentStep.value = stepId;
    }
  }

  // Go to next step
  function nextStep() {
    if (!isLastStep.value && canProceed.value) {
      const nextIndex = currentStepIndex.value + 1;
      if (nextIndex < visibleSteps.value.length) {
        currentStep.value = visibleSteps.value[nextIndex].id;
      }
    }
  }

  // Go to previous step
  function previousStep() {
    if (!isFirstStep.value) {
      const prevIndex = currentStepIndex.value - 1;
      if (prevIndex >= 0) {
        currentStep.value = visibleSteps.value[prevIndex].id;
      }
    }
  }

  // Get selected portrait ratios that need configuration
  const selectedPortraitRatios = computed(() => {
    const portraitRatios = ['9:16', '4:5', '1:1'];
    return selectedRatios.value.filter((r) => portraitRatios.includes(r));
  });

  // Check if a specific ratio has been configured
  function isRatioConfigured(ratio: string): boolean {
    const config = manualFramingConfigs.value[ratio as keyof import('@/types').ManualFramingConfigs];
    return config !== undefined && config.regions.length > 0;
  }

  // Get config for editing
  function getConfigForRatio(ratio: string): import('@/types').ManualFramingConfig | null {
    return manualFramingConfigs.value[ratio as keyof import('@/types').ManualFramingConfigs] || null;
  }

  // Open POI editor for a specific ratio
  async function openPOIEditorForRatio(ratio: string) {
    editingAspectRatio.value = ratio;
    const config = getConfigForRatio(ratio);
    console.log('[ClipBuildSettingsDialog] Opening POI editor for ratio:', ratio);
    console.log('[ClipBuildSettingsDialog] Config for ratio:', config);
    console.log('[ClipBuildSettingsDialog] All manualFramingConfigs:', manualFramingConfigs.value);
    
    // Always reload so a prior clip's cached path cannot leak into POI editor.
    await loadVideoFrame();

    // Self-contained clips load transcript async; wait so B-roll/subtitles have words in POI.
    if (isSelfContainedClip.value && !selfContainedTranscriptData.value) {
      await loadSelfContainedTranscriptForClip();
    }

    showManualPOIEditor.value = true;
  }

  const DEFAULT_POI_SUBTITLE_POSITION = { x: 50, y: 85, width: 80 } as const;

  function ensureSubtitlePositionOverrideForRatio(ratio: string) {
    if (!effectiveSubtitleSettings.value?.enabled) return;

    const existingOverride = subtitleOverrides.value[ratio as keyof SubtitleOverrides];
    if (existingOverride?.position) return;

    subtitleOverrides.value = {
      ...subtitleOverrides.value,
      [ratio]: {
        ...(existingOverride ?? {}),
        position: {
          x: DEFAULT_POI_SUBTITLE_POSITION.x,
          y: DEFAULT_POI_SUBTITLE_POSITION.y,
        },
        positionPercentage: DEFAULT_POI_SUBTITLE_POSITION.y,
        maxWidth: existingOverride?.maxWidth ?? DEFAULT_POI_SUBTITLE_POSITION.width,
        fontSize:
          existingOverride?.fontSize ??
          effectiveSubtitleSettings.value.fontSize ??
          32,
      },
    };
  }
  const introButtonRef = ref<HTMLElement | null>(null);
  const outroButtonRef = ref<HTMLElement | null>(null);
  const introDropdownRef = ref<HTMLElement | null>(null);
  const outroDropdownRef = ref<HTMLElement | null>(null);
  const introDropdownPosition = ref<{ top: string; left: string; width: string; maxHeight: string }>({
    top: '0px',
    left: '0px',
    width: '0px',
    maxHeight: '192px',
  });
  const outroDropdownPosition = ref<{ top: string; left: string; width: string; maxHeight: string }>({
    top: '0px',
    left: '0px',
    width: '0px',
    maxHeight: '192px',
  });

  // Computed
  const clipDuration = computed(() => {
    if (!props.clip?.current_version_end_time || !props.clip?.current_version_start_time) {
      return 0;
    }
    return props.clip.current_version_end_time - props.clip.current_version_start_time;
  });

  const totalDuration = computed(() => {
    let total = clipDuration.value;
    if (selectedIntro.value?.duration) total += selectedIntro.value.duration;
    if (selectedOutro.value?.duration) total += selectedOutro.value.duration;
    return total;
  });

  // Load intros and outros when dialog opens, reset framing state
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen) {
        // Reset to first step when dialog opens
        currentStep.value = 'platforms';

        // An active VOD pre-edit is the project-level export snapshot and should win over
        // creator/profile defaults or older clip-editor aspect settings.
        if (props.vodPresetConfig?.targetAspectRatio) {
          selectedRatios.value = [props.vodPresetConfig.targetAspectRatio];
          console.log('[ClipBuildSettingsDialog] Initialized aspect ratio from VOD preset:', selectedRatios.value);
        } else if (props.initialAspectRatios && props.initialAspectRatios.length > 0) {
          selectedRatios.value = [...props.initialAspectRatios];
          console.log('[ClipBuildSettingsDialog] Initialized aspect ratios from saved settings:', selectedRatios.value);
        } else {
          selectedRatios.value = ['16:9'];
        }

        if (props.vodPresetConfig?.framingConfig) {
          framingMode.value = 'manual';
          console.log('[ClipBuildSettingsDialog] Initialized framing mode from VOD preset: manual');
        } else if (props.initialFramingMode) {
          framingMode.value = props.initialFramingMode;
          console.log('[ClipBuildSettingsDialog] Initialized framing mode from saved settings:', framingMode.value);
        } else {
          framingMode.value = 'manual';
        }

        if (props.vodPresetConfig?.framingConfig) {
          // Apply VOD preset framing config for the target aspect ratio
          const ratio = props.vodPresetConfig.targetAspectRatio;
          manualFramingConfigs.value = { [ratio]: props.vodPresetConfig.framingConfig };
          console.log('[ClipBuildSettingsDialog] Initialized framing configs from VOD preset for ratio:', ratio);
          console.log('[ClipBuildSettingsDialog] VOD preset framing config:', props.vodPresetConfig.framingConfig);
          console.log('[ClipBuildSettingsDialog] manualFramingConfigs after init:', manualFramingConfigs.value);
        } else if (props.initialFramingConfigs && Object.keys(props.initialFramingConfigs).length > 0) {
          manualFramingConfigs.value = { ...props.initialFramingConfigs };
          console.log(
            '[ClipBuildSettingsDialog] Initialized framing configs from saved settings:',
            Object.keys(manualFramingConfigs.value)
          );
        } else {
          manualFramingConfigs.value = {};
        }

        videoFrameUrl.value = null;

        // Reset subtitle overrides
        subtitleOverrides.value = {};
        showSubtitleAdjustmentDialog.value = false;

        clipTextOverlayRaw.value = null;
        if (props.clip?.id) {
          try {
            const { getClip } = await import('@/services/database/clips');
            const row = await getClip(props.clip.id);
            clipTextOverlayRaw.value = row?.clip_text_overlay ?? null;
          } catch (e) {
            console.warn('[ClipBuildSettingsDialog] Failed to load clip_text_overlay:', e);
          }
        }

        if (intros.value.length === 0 && outros.value.length === 0) {
          await loadIntroOutros();
        }

        // Reset campaign selection state
        isForCampaign.value = false;
        selectedCampaign.value = null;
        showCampaignDropdown.value = false;

        // Load available orgs and campaigns for the streamer
        await loadOrgsAndCampaigns();

        // Personal / free-tier defaults: props are only set when workspace branding is personal (not org/campaign).
        // Pre-select so personal builds use creator defaults without an extra click.
        if (props.defaultIntro) {
          selectedIntro.value = props.defaultIntro as IntroOutroItem;
        }
        if (props.defaultOutro) {
          selectedOutro.value = props.defaultOutro as IntroOutroItem;
        }

        // Load overlay previews for POI editor
        const loadedPreviews: Record<string, string> = {};
        if (props.vodPresetConfig?.layoutOverlays?.length) {
          const { invoke } = await import('@tauri-apps/api/core');
          for (const overlay of props.vodPresetConfig.layoutOverlays) {
            try {
              // Resolve the overlay image path (handles both local files and org-asset- prefixed IDs)
              const resolvedPath = await resolveOverlayImagePath(overlay.imagePath, overlay.assetId);
              if (resolvedPath) {
                const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: resolvedPath });
                loadedPreviews[overlay.id] = dataUrl;
              }
            } catch (err) {
              console.warn('[ClipBuildSettingsDialog] Failed to load overlay preview:', overlay.id, err);
            }
          }
        }
        // Replace the entire ref to trigger prop reactivity in ManualPOIEditor
        overlayPreviewUrls.value = loadedPreviews;

        // Load video frame for POI editor preview
        await loadVideoFrame();
      } else {
        // Reset selections when dialog closes
        selectedIntro.value = null;
        selectedOutro.value = null;
        videoPath.value = null;
        isForCampaign.value = false;
        selectedCampaign.value = null;
        availableCampaigns.value = [];
      }
    }
  );

  // Handle case where framing step becomes hidden while user is on it
  watch(
    () =>
      hasPortraitRatio.value || hasSubtitlesEnabled.value || hasClipTextBoxEnabled.value,
    (showFramingStep) => {
      if (!showFramingStep && currentStep.value === 'framing') {
        // Skip to export step if framing step is no longer needed
        currentStep.value = 'export';
      }
    }
  );

  function onClipTextOverlayChange(json: string | null) {
    clipTextOverlayRaw.value = json;
  }

  // Get subtitle override for a specific ratio, falling back to project defaults
  function getSubtitleOverrideForRatio(ratio: string): SubtitleOverride {
    const override = subtitleOverrides.value[ratio as keyof SubtitleOverrides];
    if (override) {
      return override;
    }
    // Return defaults from project subtitle settings
    return {
      fontSize: effectiveSubtitleSettings.value?.fontSize ?? 32,
      positionPercentage: effectiveSubtitleSettings.value?.positionPercentage ?? 85,
    };
  }

  // Check if a ratio has custom subtitle overrides
  function hasSubtitleOverride(ratio: string): boolean {
    return !!subtitleOverrides.value[ratio as keyof SubtitleOverrides];
  }

  // Get subtitle position for POI editor (returns position object)
  function getSubtitlePositionForRatio(ratio: string): { x: number; y: number; width?: number } {
    const override = subtitleOverrides.value[ratio as keyof SubtitleOverrides];
    if (override?.position) {
      return {
        x: override.position.x,
        y: override.position.y,
        width: override.maxWidth,
      };
    }
    
    return { ...DEFAULT_POI_SUBTITLE_POSITION };
  }

  // Open subtitle adjustment dialog for a specific ratio
  function openSubtitleEditorForRatio(ratio: string) {
    editingSubtitleRatio.value = ratio;
    showSubtitleAdjustmentDialog.value = true;
  }

  // Handle subtitle override confirmation from dialog
  function onSubtitleOverrideConfirm(override: SubtitleOverride) {
    const ratio = editingSubtitleRatio.value;
    subtitleOverrides.value = {
      ...subtitleOverrides.value,
      [ratio]: override,
    };
  }

  // Handle subtitle position change from POI editor (also carries optional presetId for per-ratio style)
  async function onSubtitlePositionChange(position: { x: number; y: number; width?: number; presetId?: string }) {
    const ratio = editingAspectRatio.value;
    const existingOverride = subtitleOverrides.value[ratio as keyof SubtitleOverrides] || {
      fontSize: effectiveSubtitleSettings.value?.fontSize ?? 32,
      positionPercentage: 85,
      position: { x: 50, y: 85 },
      maxWidth: 80,
    };

    const newOverride = {
      ...existingOverride,
      position: { x: position.x, y: position.y },
      maxWidth: position.width ?? existingOverride.maxWidth,
      positionPercentage: position.y,
      ...(position.presetId ? { presetId: position.presetId } : {}),
    };

    subtitleOverrides.value = {
      ...subtitleOverrides.value,
      [ratio]: newOverride,
    };
    
    // Save position to database so it persists
    if (props.clip?.id) {
      try {
        const { getClip, saveSubtitleSettings } = await import('@/services/database/clips');
        const dbClip = await getClip(props.clip.id);
        let currentSettings: any = null;
        
        if (dbClip?.subtitle_settings) {
          currentSettings = typeof dbClip.subtitle_settings === 'string' 
            ? JSON.parse(dbClip.subtitle_settings)
            : dbClip.subtitle_settings;
        }
        
        // Merge position into perRatioConfigs
        const perRatioConfigs: Record<string, any> = {
          ...(currentSettings?.perRatioConfigs || {}),
        };
        perRatioConfigs[ratio] = {
          ...(perRatioConfigs[ratio] || {}),
          position: newOverride.position,
          positionPercentage: newOverride.positionPercentage,
          maxWidth: newOverride.maxWidth,
        };
        
        const settingsToSave = {
          ...(currentSettings || effectiveSubtitleSettings.value || {}),
          perRatioConfigs,
        };
        
        await saveSubtitleSettings(props.clip.id, settingsToSave);
        console.log('[ClipBuildSettingsDialog] Saved subtitle position to database:', {
          clipId: props.clip.id,
          ratio,
          position: newOverride.position,
        });
      } catch (error) {
        console.error('[ClipBuildSettingsDialog] Failed to save subtitle position:', error);
      }
    }
  }

  // Handle subtitle settings change from POI editor (animation style, colors, borders, etc.)
  async function onSubtitleSettingsChange(settings: SubtitleSettings) {
    const ratio = editingAspectRatio.value;
    console.log('[ClipBuildSettingsDialog] onSubtitleSettingsChange called:', {
      animationStyle: settings.animationStyle,
      border1Width: settings.border1Width,
      border2Width: settings.border2Width,
      highlightColor: settings.highlightColor,
      fontSize: settings.fontSize,
      multiColorEnabled: settings.multiColorEnabled,
      selectedPresetId: settings.selectedPresetId,
      ratio,
    });
    
    // IMPORTANT: Only update localSubtitleSettings (base settings) if editing 16:9
    // For other ratios, we only update the per-ratio override to preserve base settings
    if (ratio === '16:9') {
      localSubtitleSettings.value = { ...settings };
    }
    
    // Update the override for this specific ratio
    const existingOverride: Partial<SubtitleOverride> = subtitleOverrides.value[ratio as keyof SubtitleOverrides] || {};
    
    // Store ALL visual properties that changed so Rust can apply them via per_ratio_override JSON
    // The Rust code reads these fields from the JSON even though TypeScript SubtitleOverride doesn't define them
    // IMPORTANT: Preserve position/maxWidth from existing override if user dragged the subtitle
    // (settings object has default values for position, which would overwrite user's dragged position)
    subtitleOverrides.value = {
      ...subtitleOverrides.value,
      [ratio]: {
        ...existingOverride,
        // Standard SubtitleOverride fields
        fontSize: settings.fontSize,
        // Only update position fields if NOT already set by user dragging
        // (existingOverride.position indicates user has dragged the subtitle)
        positionPercentage: existingOverride.position ? existingOverride.positionPercentage : settings.positionPercentage,
        maxWidth: existingOverride.maxWidth ?? settings.maxWidth,
        position: existingOverride.position, // Preserve user's dragged position
        presetId: settings.selectedPresetId || undefined,
        // Extended fields for visual styling (read by Rust generate_ass_file)
        animationStyle: settings.animationStyle,
        textColor: settings.textColor,
        fontFamily: settings.fontFamily,
        fontWeight: settings.fontWeight,
        border1Width: settings.border1Width,
        border1Color: settings.border1Color,
        border2Width: settings.border2Width,
        border2Color: settings.border2Color,
        highlightColor: settings.highlightColor,
        multiColorEnabled: settings.multiColorEnabled,
        colorPalette: settings.colorPalette,
        multiColorMode: settings.multiColorMode,
        shadowOffsetX: settings.shadowOffsetX,
        shadowOffsetY: settings.shadowOffsetY,
        shadowBlur: settings.shadowBlur,
        shadowColor: settings.shadowColor,
        backgroundColor: settings.backgroundColor,
        backgroundEnabled: settings.backgroundEnabled,
      } as any, // Cast to any since we're extending SubtitleOverride with extra fields
    };
    
    // Save per-ratio override to database (don't overwrite base settings!)
    if (props.clip?.id) {
      try {
        const { getClip, saveSubtitleSettings } = await import('@/services/database/clips');
        
        // Load current clip data from database to get existing subtitle_settings
        const dbClip = await getClip(props.clip.id);
        let currentSettings: any = null;
        
        if (dbClip?.subtitle_settings) {
          currentSettings = typeof dbClip.subtitle_settings === 'string' 
            ? JSON.parse(dbClip.subtitle_settings)
            : dbClip.subtitle_settings;
        }
        
        console.log('[ClipBuildSettingsDialog] Current settings from DB:', {
          hasSettings: !!currentSettings,
          baseAnimationStyle: currentSettings?.animationStyle,
          hasPerRatioConfigs: !!currentSettings?.perRatioConfigs,
          existingRatios: currentSettings?.perRatioConfigs ? Object.keys(currentSettings.perRatioConfigs) : []
        });
        
        // Build perRatioConfigs by merging existing with new overrides
        const perRatioConfigs: Record<string, any> = {
          ...(currentSettings?.perRatioConfigs || {}),
          ...subtitleOverrides.value,
        };
        
        // If we have current settings, use them as base; otherwise use the incoming settings
        const baseSettings = currentSettings || settings;
        
        const settingsToSave = {
          ...baseSettings,
          perRatioConfigs: Object.keys(perRatioConfigs).length > 0 ? perRatioConfigs : undefined,
        };
        
        await saveSubtitleSettings(props.clip.id, settingsToSave);
        console.log('[ClipBuildSettingsDialog] Saved per-ratio subtitle override to database:', {
          clipId: props.clip.id,
          ratio,
          presetId: settings.selectedPresetId,
          animationStyle: settings.animationStyle,
          perRatioConfigKeys: Object.keys(perRatioConfigs),
        });
      } catch (error) {
        console.error('[ClipBuildSettingsDialog] Failed to save subtitle settings:', error);
      }
    }
  }

  // Load a frame from the video for the POI editor preview
  async function loadVideoFrame() {
    if (!props.clip) return;

    const clipId = props.clip.id;
    const generation = ++loadVideoFrameGeneration;
    loadingVideoFrame.value = true;

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      const source = await resolveClipVideoSourceForPreview(props.clip, props.clip.project_id);
      if (generation !== loadVideoFrameGeneration || props.clip?.id !== clipId || !source) {
        return;
      }

      const { filePath: rawVideoPath, frameTimestamp } = source;

      console.log('[BuildSettings] POI preview source:', {
        clipId,
        file: rawVideoPath.split(/[\\/]/).pop(),
        frameTimestamp,
        selfContained: source.isSelfContained,
      });

      videoPath.value = rawVideoPath;

      const thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
        videoPath: rawVideoPath,
        timestampSeconds: frameTimestamp,
        outputFilename: `poi_preview_${clipId}`,
      });

      if (generation !== loadVideoFrameGeneration || props.clip?.id !== clipId) {
        return;
      }

      const dataUrl = await invoke<string>('read_file_as_data_url', {
        filePath: thumbnailPath,
      });

      videoFrameUrl.value = dataUrl;
    } catch (error) {
      console.warn('[BuildSettings] Failed to load video frame:', error);
      videoFrameUrl.value = props.thumbnailUrl || null;
    } finally {
      if (generation === loadVideoFrameGeneration) {
        loadingVideoFrame.value = false;
      }
    }
  }

  onMounted(async () => {
    if (props.modelValue) {
      await loadIntroOutros();
    }
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  // Handle click outside to close dropdowns
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Node;

    if (
      showIntroDropdown.value &&
      introButtonRef.value &&
      !introButtonRef.value.contains(target) &&
      introDropdownRef.value &&
      !introDropdownRef.value.contains(target)
    ) {
      showIntroDropdown.value = false;
    }

    if (
      showOutroDropdown.value &&
      outroButtonRef.value &&
      !outroButtonRef.value.contains(target) &&
      outroDropdownRef.value &&
      !outroDropdownRef.value.contains(target)
    ) {
      showOutroDropdown.value = false;
    }

    if (
      showCampaignDropdown.value &&
      campaignButtonRef.value &&
      !campaignButtonRef.value.contains(target) &&
      campaignDropdownRef.value &&
      !campaignDropdownRef.value.contains(target)
    ) {
      showCampaignDropdown.value = false;
    }
  }

  function calculateDropdownPosition(buttonRef: HTMLElement) {
    const rect = buttonRef.getBoundingClientRect();
    const maxDropdownHeight = 192; // max-h-48 = 192px
    const minDropdownHeight = 80; // minimum usable height
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spacing = 8;

    // Calculate available space
    const spaceBelow = viewportHeight - rect.bottom - spacing;
    const spaceAbove = rect.top - spacing;

    let top: string;
    let maxHeight: string;

    // Show above if there's not enough space below for at least 150px (enough for ~3 items)
    // OR if there's more space above than below
    const showAbove = spaceBelow < 150 || (spaceBelow < maxDropdownHeight && spaceAbove > spaceBelow);

    if (showAbove) {
      // Show above the button
      const availableHeight = Math.min(maxDropdownHeight, spaceAbove);
      maxHeight = `${Math.max(availableHeight, minDropdownHeight)}px`;
      top = `${rect.top - availableHeight - spacing}px`;
    } else {
      // Show below the button
      const availableHeight = Math.min(maxDropdownHeight, spaceBelow);
      maxHeight = `${Math.max(availableHeight, minDropdownHeight)}px`;
      top = `${rect.bottom + spacing}px`;
    }

    // Handle horizontal positioning
    let left = `${rect.left}px`;
    const width = `${rect.width}px`;

    // Check if it would go off the right edge
    if (rect.left + rect.width > viewportWidth) {
      left = `${viewportWidth - rect.width - spacing}px`;
    }

    // Check if it would go off the left edge
    if (rect.left < spacing) {
      left = `${spacing}px`;
    }

    return {
      top,
      left,
      width,
      maxHeight,
    };
  }

  async function toggleIntroDropdown() {
    console.log('[ClipBuildSettingsDialog] toggleIntroDropdown called');
    console.log('[ClipBuildSettingsDialog] hasOrgOrCampaignSelected:', hasOrgOrCampaignSelected.value);
    console.log('[ClipBuildSettingsDialog] intros.value.length:', intros.value.length);
    
    // Wait for next tick to ensure button ref is available after template renders
    await nextTick();
    
    if (!introButtonRef.value) {
      console.warn('[ClipBuildSettingsDialog] Intro button ref not available');
      return;
    }
    
    console.log('[ClipBuildSettingsDialog] Calculating intro dropdown position...');
    introDropdownPosition.value = calculateDropdownPosition(introButtonRef.value);
    console.log('[ClipBuildSettingsDialog] Intro dropdown position:', {
      top: introDropdownPosition.value.top,
      left: introDropdownPosition.value.left,
      width: introDropdownPosition.value.width,
      maxHeight: introDropdownPosition.value.maxHeight
    });
    
    showIntroDropdown.value = !showIntroDropdown.value;
    console.log('[ClipBuildSettingsDialog] showIntroDropdown.value:', showIntroDropdown.value);
    showOutroDropdown.value = false;
  }

  async function toggleOutroDropdown() {
    console.log('[ClipBuildSettingsDialog] toggleOutroDropdown called');
    console.log('[ClipBuildSettingsDialog] hasOrgOrCampaignSelected:', hasOrgOrCampaignSelected.value);
    console.log('[ClipBuildSettingsDialog] outros.value.length:', outros.value.length);
    
    // Wait for next tick to ensure button ref is available after template renders
    await nextTick();
    
    if (!outroButtonRef.value) {
      console.warn('[ClipBuildSettingsDialog] Outro button ref not available');
      return;
    }
    
    console.log('[ClipBuildSettingsDialog] Calculating outro dropdown position...');
    outroDropdownPosition.value = calculateDropdownPosition(outroButtonRef.value);
    console.log('[ClipBuildSettingsDialog] Outro dropdown position:', {
      top: outroDropdownPosition.value.top,
      left: outroDropdownPosition.value.left,
      width: outroDropdownPosition.value.width,
      maxHeight: outroDropdownPosition.value.maxHeight
    });
    
    showOutroDropdown.value = !showOutroDropdown.value;
    console.log('[ClipBuildSettingsDialog] showOutroDropdown.value:', showOutroDropdown.value);
    showIntroDropdown.value = false;
  }

  async function loadIntroOutros() {
    loadingAssets.value = true;
    try {
      // Load local assets from database
      const localAssets = await getAllIntroOutros();
      const localIntros: IntroOutroItem[] = localAssets
        .filter((a) => a.type === 'intro' && !a.organization_id) // Personal intros only
        .map((a) => ({ ...a, isOrgAsset: false }));
      const localOutros: IntroOutroItem[] = localAssets
        .filter((a) => a.type === 'outro' && !a.organization_id) // Personal outros only
        .map((a) => ({ ...a, isOrgAsset: false }));

      // Load organization assets from server API (streaming, not downloaded)
      let orgIntros: IntroOutroItem[] = [];
      let orgOutros: IntroOutroItem[] = [];

      // User belongs to an organization if they own one or were created by one
      const user = authStore.user;
      const hasOrganizations = user && (user.owned_organization_id || user.created_by_organization_id);
      if (hasOrganizations) {
        try {
          const serverResponse = await getUserOrganizationAssets();
          if (serverResponse.success) {
            // Convert server assets to IntroOutroItem format
            orgIntros = serverResponse.assets
              .filter((a: ServerOrganizationAsset) => a.asset_type === 'intro')
              .map((a: ServerOrganizationAsset) => ({
                id: `org_${a.id}`,
                name: a.name,
                file_path: a.url, // Use server URL for streaming
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
                file_path: a.url, // Use server URL for streaming
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

      // Combine local and org assets (org assets shown first)
      intros.value = [...orgIntros, ...localIntros];
      outros.value = [...orgOutros, ...localOutros];

      console.log(
        '[ClipBuildSettingsDialog] Loaded intros:',
        intros.value.length,
        '(org:',
        orgIntros.length,
        ', local:',
        localIntros.length,
        ')'
      );
      console.log(
        '[ClipBuildSettingsDialog] Loaded outros:',
        outros.value.length,
        '(org:',
        orgOutros.length,
        ', local:',
        localOutros.length,
        ')'
      );
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      loadingAssets.value = false;
    }
  }

  function selectIntro(intro: IntroOutroItem | null) {
    selectedIntro.value = intro;
    showIntroDropdown.value = false;
  }

  function selectOutro(outro: IntroOutroItem | null) {
    selectedOutro.value = outro;
    showOutroDropdown.value = false;
  }

  // Manual framing config handler - saves to the specific aspect ratio
  function onManualConfigConfirm(config: ManualFramingConfig) {
    const ratio = config.targetAspectRatio as keyof import('@/types').ManualFramingConfigs;
    ensureSubtitlePositionOverrideForRatio(config.targetAspectRatio);
    manualFramingConfigs.value = {
      ...manualFramingConfigs.value,
      [ratio]: config,
    };
    console.log('[BuildSettings] Manual framing config updated for', ratio, ':', config);
  }

  // Methods
  function toggleRatio(ratio: string) {
    if (props.singleRatioMode) {
      // In single ratio mode, replace the selection instead of toggling
      selectedRatios.value = [ratio];
      return;
    }
    const index = selectedRatios.value.indexOf(ratio);
    if (index > -1) {
      selectedRatios.value.splice(index, 1);
    } else {
      selectedRatios.value.push(ratio);
    }
  }


  function formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function close() {
    emit('update:modelValue', false);
  }

  // Guard to prevent double submissions (e.g., from double-clicks)
  const isSubmitting = ref(false);

  // Load available orgs and campaigns for the streamer
  async function loadOrgsAndCampaigns() {
    loadingOrgsAndCampaigns.value = true;
    try {
      const projectId = clipProjectId.value;
      if (projectId) {
        const { getEligibleOrgsForBuild } = await import('@/composables/useBrandingProfileSelection');
        const eligible = await getEligibleOrgsForBuild(projectId);
        availableOrgs.value = eligible.map((org) => ({
          organizationId: org.organizationId,
          organizationName: org.organizationName,
          resolvedProfile: org.resolvedProfile,
          serverProfile: org.serverProfile,
          selected: false,
          aspectRatios: [],
        }));
        console.log(
          '[ClipBuildSettingsDialog] Eligible orgs for build:',
          eligible.length,
          'project:',
          projectId
        );
      } else {
        availableOrgs.value = [];
      }

      // Fetch campaigns (global branding + creator-profile-specific)
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
      
      // Convert to CampaignSelection format
      availableCampaignSelections.value = campaignResults.map(campaign => ({
        campaign,
        selected: false,
        aspectRatios: [],
      }));
      
      // Also set legacy availableCampaigns for backward compatibility
      availableCampaigns.value = campaignResults;
      
      console.log('[ClipBuildSettingsDialog] Found', campaignResults.length, 'campaigns');
    } catch (e) {
      console.warn('[ClipBuildSettingsDialog] Failed to load orgs/campaigns:', e);
      availableOrgs.value = [];
      availableCampaignSelections.value = [];
      availableCampaigns.value = [];
    } finally {
      loadingOrgsAndCampaigns.value = false;
    }
  }
  
  async function syncBrandingPreviewFromSelection() {
    if (!hasOrgOrCampaignSelected.value) {
      selectedIntro.value = props.defaultIntro ? (props.defaultIntro as IntroOutroItem) : null;
      selectedOutro.value = props.defaultOutro ? (props.defaultOutro as IntroOutroItem) : null;
      return;
    }

    const selectedCampaign =
      availableCampaignSelections.value.find((c) => c.selected)?.campaign ?? null;
    const selectedOrg = selectedCampaign
      ? null
      : availableOrgs.value.find((o) => o.selected)?.serverProfile ?? null;

    try {
      const branding = await resolveSelectionBrandingPreview(selectedOrg, selectedCampaign);
      selectedIntro.value = branding.intro;
      selectedOutro.value = branding.outro;
    } catch (e) {
      console.warn('[ClipBuildSettingsDialog] Failed to sync branding preview:', e);
    }
  }

  // Toggle org selection
  function toggleOrgSelection(index: number) {
    const org = availableOrgs.value[index];
    org.selected = !org.selected;
    if (!org.selected) {
      org.aspectRatios = [];
    }
    void syncBrandingPreviewFromSelection();
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
  function toggleCampaignSelection(index: number) {
    const campaign = availableCampaignSelections.value[index];
    campaign.selected = !campaign.selected;
    if (!campaign.selected) {
      campaign.aspectRatios = [];
    }
    void syncBrandingPreviewFromSelection();
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
  
  // Check if we have multiple aspect ratios selected (show nested selectors)
  const hasMultipleAspectRatios = computed(() => selectedRatios.value.length > 1);
  
  // Check if any org or campaign is selected (for disabling intro/outro)
  const hasOrgOrCampaignSelected = computed(() => {
    const hasSelectedOrg = availableOrgs.value.some(org => org.selected);
    const hasSelectedCampaign = availableCampaignSelections.value.some(c => c.selected);
    const result = hasSelectedOrg || hasSelectedCampaign;
    console.log('[ClipBuildSettingsDialog] hasOrgOrCampaignSelected computed:', {
      hasSelectedOrg,
      hasSelectedCampaign,
      result,
      availableOrgs: availableOrgs.value.map(o => ({ name: o.organizationName, selected: o.selected })),
      availableCampaigns: availableCampaignSelections.value.map(c => ({ title: c.campaign.title, selected: c.selected }))
    });
    return result;
  });
  
  // Get total number of builds that will be created
  // Must match the logic in confirmBuild() - when nested aspectRatios is empty, use selectedRatios
  const totalBuildsCount = computed(() => {
    let count = 0;
    
    console.log('[BuildDialog] Calculating totalBuildsCount...');
    console.log('[BuildDialog] hasMultipleAspectRatios:', hasMultipleAspectRatios.value);
    console.log('[BuildDialog] selectedRatios:', selectedRatios.value);
    console.log('[BuildDialog] availableOrgs:', availableOrgs.value.map(o => ({ name: o.organizationName, selected: o.selected, aspectRatios: o.aspectRatios })));
    console.log('[BuildDialog] availableCampaignSelections:', availableCampaignSelections.value.map(c => ({ name: c.campaign.title, selected: c.selected, aspectRatios: c.aspectRatios })));
    
    // Count org builds (each org × each aspect ratio = 1 build)
    for (const org of availableOrgs.value) {
      if (org.selected) {
        // If multiple aspect ratios mode and user selected specific ratios, use those
        // Otherwise fall back to all selected ratios (same as confirmBuild)
        const ratios = hasMultipleAspectRatios.value && org.aspectRatios.length > 0 
          ? org.aspectRatios 
          : selectedRatios.value;
        console.log(`[BuildDialog] Org "${org.organizationName}" selected, ratios:`, ratios, 'adding', ratios.length);
        count += ratios.length;
      }
    }
    
    // Count campaign builds
    for (const campaign of availableCampaignSelections.value) {
      if (campaign.selected) {
        const ratios = hasMultipleAspectRatios.value && campaign.aspectRatios.length > 0 
          ? campaign.aspectRatios 
          : selectedRatios.value;
        console.log(`[BuildDialog] Campaign "${campaign.campaign.title}" selected, ratios:`, ratios, 'adding', ratios.length);
        count += ratios.length;
      }
    }
    
    // If no org/campaign selected, it's a personal build (one per selected ratio)
    if (count === 0) {
      count = selectedRatios.value.length;
    }
    
    console.log('[BuildDialog] Total build count:', count);
    return count;
  });

  // Legacy: Load available campaigns for campaign selection
  async function loadAvailableCampaigns() {
    loadingCampaigns.value = true;
    try {
      const results: Campaign[] = [];

      // 1. Fetch global branding campaigns (work with ANY VOD)
      const globalRes = await getMyGlobalBrandingCampaigns();
      if (globalRes.success && globalRes.campaigns) {
        results.push(...globalRes.campaigns);
      }

      // 2. If this clip has a creator profile, also fetch campaigns for that profile
      if (props.creatorProfileServerId) {
        const profileRes = await getCampaignsByCreatorProfile(props.creatorProfileServerId);
        if (profileRes.success && profileRes.campaigns) {
          // Add campaigns not already in list (no duplicates)
          for (const c of profileRes.campaigns) {
            if (!results.find((r) => r.id === c.id)) {
              results.push(c);
            }
          }
        }
      }

      availableCampaigns.value = results;
    } catch (e) {
      console.warn('[ClipBuildSettingsDialog] Failed to load campaigns:', e);
      availableCampaigns.value = [];
    } finally {
      loadingCampaigns.value = false;
    }
  }

  // Toggle campaign checkbox
  function toggleIsForCampaign() {
    isForCampaign.value = !isForCampaign.value;
    if (!isForCampaign.value) {
      selectedCampaign.value = null;
    }
  }

  function toggleCampaignDropdown() {
    if (!campaignButtonRef.value) return;
    const pos = calculateDropdownPosition(campaignButtonRef.value);
    campaignDropdownPosition.value = pos;
    showCampaignDropdown.value = !showCampaignDropdown.value;
  }

  async function selectCampaign(campaign: Campaign) {
    selectedCampaign.value = campaign;
    showCampaignDropdown.value = false;
    await syncBrandingPreviewFromSelection();
  }

  // Reset isSubmitting when dialog opens so subsequent builds work
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        isSubmitting.value = false;
      }
    }
  );

  function confirmBuild() {
    // Prevent double submissions
    if (isSubmitting.value) return;
    if (selectedRatios.value.length === 0) return;

    isSubmitting.value = true;

    // Use watermark settings from props (configured in WatermarkTab)
    const watermarkSettings: WatermarkSettings | null = props.watermarkSettings?.enabled
      ? props.watermarkSettings
      : null;

    // Determine framing mode and configs
    const finalFramingMode = hasPortraitRatio.value ? framingMode.value : undefined;
    const finalManualConfigs =
      hasPortraitRatio.value && framingMode.value === 'manual' ? manualFramingConfigs.value : undefined;

    // For backward compatibility, also set the primary config
    const finalManualConfig =
      finalManualConfigs && Object.keys(finalManualConfigs).length > 0
        ? Object.values(finalManualConfigs)[0]
        : undefined;

    // Include subtitle overrides only if user has customized any
    const finalSubtitleOverrides =
      Object.keys(subtitleOverrides.value).length > 0 ? subtitleOverrides.value : undefined;

    // Build targets from multi-select (orgs and campaigns with their aspect ratios)
    const buildTargets: BuildTarget[] = [];
    
    // Add org build targets
    for (const org of availableOrgs.value) {
      if (org.selected) {
        const ratios = hasMultipleAspectRatios.value && org.aspectRatios.length > 0 
          ? org.aspectRatios 
          : [...selectedRatios.value];
        
        for (const ratio of ratios) {
          buildTargets.push({
            type: 'org',
            id: org.organizationId,
            name: org.organizationName,
            brandingProfileId: Number(org.resolvedProfile.id) || null,
            aspectRatios: [ratio],
            organizationId: org.organizationId,
            organizationName: org.organizationName,
          });
        }
      }
    }
    
    // Add campaign build targets
    for (const campaignSel of availableCampaignSelections.value) {
      if (campaignSel.selected) {
        // If multiple aspect ratios, use selected ones; otherwise use all selected ratios
        const ratios = hasMultipleAspectRatios.value && campaignSel.aspectRatios.length > 0 
          ? campaignSel.aspectRatios 
          : [...selectedRatios.value];
        
        // Create one build target per aspect ratio
        for (const ratio of ratios) {
          buildTargets.push({
            type: 'campaign',
            id: campaignSel.campaign.id,
            name: campaignSel.campaign.title,
            brandingProfileId: campaignSel.campaign.branding_profile_id,
            aspectRatios: [ratio],
            organizationId: campaignSel.campaign.organization?.id,
            organizationName: campaignSel.campaign.organization?.name,
          });
        }
      }
    }

    // If no orgs/campaigns selected, create personal build targets (one per aspect ratio)
    if (buildTargets.length === 0) {
      for (const ratio of selectedRatios.value) {
        buildTargets.push({
          type: 'personal',
          id: null,
          name: 'Personal',
          aspectRatios: [ratio],
          selectedPlatforms: new Map(),
        });
      }
      console.log('[ClipBuildSettingsDialog] No orgs/campaigns selected, created', buildTargets.length, 'personal build targets');
    }

    const selectedCampaignTargets = availableCampaignSelections.value.filter((campaignSel) => campaignSel.selected);
    const singleSelectedCampaign = selectedCampaignTargets.length === 1 ? selectedCampaignTargets[0].campaign : null;

    const settings: BuildSettings = {
      aspectRatios: [...selectedRatios.value], // Create a copy to avoid mutation issues
      quality: quality.value,
      frameRate: frameRate.value,
      format: outputFormat.value,
      intro: selectedIntro.value,
      outro: selectedOutro.value,
      watermark: watermarkSettings,
      framingMode: finalFramingMode,
      manualFramingConfig: finalManualConfig ?? undefined,
      manualFramingConfigs: finalManualConfigs,
      subtitleOverrides: finalSubtitleOverrides,
      layoutOverlays: props.vodPresetConfig?.layoutOverlays?.length
        ? props.vodPresetConfig.layoutOverlays
        : undefined,
      // Multi-build targets (always populated — personal targets as fallback)
      buildTargets: buildTargets,
      // Legacy single campaign fields (kept for backward compatibility)
      campaignId: singleSelectedCampaign?.id ?? (isForCampaign.value && selectedCampaign.value ? selectedCampaign.value.id : null),
      selectedCampaign: singleSelectedCampaign ?? (isForCampaign.value ? selectedCampaign.value : null),
      campaignBrandingProfileId: singleSelectedCampaign?.branding_profile_id
        ?? (isForCampaign.value && selectedCampaign.value ? selectedCampaign.value.branding_profile_id : null),
      brandingType: singleSelectedCampaign ? 'campaign' : (isForCampaign.value && selectedCampaign.value ? 'campaign' : 'personal'),
    };

    console.log('[ClipBuildSettingsDialog] Emitting confirm with buildTargets:', buildTargets.length, 'targets');
    console.log('[ClipBuildSettingsDialog] Build targets:', buildTargets);
    emit('confirm', settings);
    
    // In publish mode, keep dialog open and wait for build completion
    // The parent component will handle the build and emit build-complete event
    if (!props.publishMode) {
      close();
    }
  }
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
    z-index: 10;
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

  /* Hide labels on small screens */
  @media (max-width: 640px) {
    .build-dialog__step-label {
      display: none;
    }
  }

  /* ===== Content Area ===== */
  .build-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }

  .build-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .build-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .build-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .build-dialog__content-inner {
    padding: 1.5rem;
  }

  /* ===== Step Content ===== */
  .build-dialog__step-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
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

  .build-dialog__platform-card--original {
    border-color: var(--sidebar-accent);
    background-color: rgba(6, 182, 212, 0.1);
    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2);
    cursor: default;
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

  .build-dialog__platform-box--16-9 {
    width: 80px;
    height: 45px;
  }

  .build-dialog__platform-box--9-16 {
    width: 24px;
    height: 44px;
  }

  .build-dialog__platform-box--1-1 {
    width: 44px;
    height: 44px;
  }

  .build-dialog__platform-box--4-5 {
    width: 35px;
    height: 44px;
  }

  .build-dialog__platform-card--original .build-dialog__platform-box {
    border-color: var(--sidebar-accent);
  }

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

  .build-dialog__framing-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .build-dialog__framing-mode {
    position: relative;
    padding: 1rem;
    border-radius: 10px;
    border: 2px solid var(--sidebar-border);
    background-color: rgba(255, 255, 255, 0.03);
    transition: all 150ms ease;
    text-align: left;
    cursor: pointer;
  }

  .build-dialog__framing-mode:hover {
    border-color: rgba(6, 182, 212, 0.3);
  }

  .build-dialog__framing-mode--active {
    border-color: var(--sidebar-accent);
    background-color: rgba(6, 182, 212, 0.1);
  }

  .build-dialog__framing-mode--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .build-dialog__framing-mode-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .build-dialog__framing-mode-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.05);
  }

  .build-dialog__framing-mode-icon--active {
    background-color: rgba(6, 182, 212, 0.2);
  }

  .build-dialog__framing-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
  }

  .build-dialog__framing-mode--active .build-dialog__framing-icon {
    color: var(--sidebar-accent);
  }

  .build-dialog__framing-mode-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .build-dialog__framing-mode-desc {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.4;
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

  .build-dialog__ratio-config--configured:hover {
    background-color: rgba(6, 182, 212, 0.15);
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

  .build-dialog__loading-hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    text-align: center;
    padding: 0.5rem 0;
  }

  /* ===== Subtitle Section ===== */
  .build-dialog__subtitle-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .build-dialog__subtitle-section--with-border {
    padding-top: 1rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .build-dialog__subtitle-hint {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  .build-dialog__subtitle-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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

  .build-dialog__badge--default {
    background-color: rgba(139, 92, 246, 0.2);
    color: rgb(196, 181, 253);
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .build-dialog__badge--global {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    border: 1px solid rgba(6, 182, 212, 0.25);
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
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
    truncate: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .build-dialog__campaign-selected-org {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .build-dialog__dropdown-text--placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.7;
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

  .build-dialog__dropdown-trigger--disabled,
  .build-dialog__dropdown-trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .build-dialog__intro-outro-section--disabled {
    opacity: 0.6;
  }

  .build-dialog__disabled-notice {
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

  .build-dialog__dropdown-menu {
    position: fixed;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    padding: 0.25rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    z-index: 10001;
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
    margin-left: 0.5rem;
    flex-shrink: 0;
  }

  .build-dialog__dropdown-loading,
  .build-dialog__dropdown-empty {
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    text-align: center;
    color: var(--sidebar-text-muted);
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

  /* ===== Multi-Select Section ===== */
  .build-dialog__multi-select-section {
    margin-bottom: 1rem;
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
  }

  .build-dialog__section-hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-bottom: 0.75rem;
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
    background: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.2);
    border-radius: 8px;
    margin-top: 0.5rem;
  }

  .build-dialog__builds-count {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-accent);
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

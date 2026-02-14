<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="org-dialog__overlay" @click.self="closeDialog">
        <Transition name="dialog" appear>
          <div class="org-dialog org-dialog--cyan org-dialog--lg">
            <!-- Accent Bar -->
            <div class="org-dialog__accent org-dialog__accent--cyan" />

            <!-- Header -->
            <div class="org-dialog__header">
              <button class="org-dialog__close" @click="closeDialog" title="Close">
                <X :size="18" />
              </button>
              <div class="org-dialog__icon org-dialog__icon--cyan">
                <Paintbrush v-if="formData.scope === 'global'" :size="24" />
                <UserCircle v-else :size="24" />
              </div>
              <h2 class="org-dialog__title">
                {{ formData.scope === 'global'
                  ? (isEditing ? 'Edit Global Branding' : 'Create Global Branding')
                  : (isEditing ? 'Edit Creator Profile' : 'Create Creator Profile')
                }}
              </h2>
              <p class="org-dialog__subtitle">
                {{ formData.scope === 'global'
                  ? (isEditing
                    ? 'Update default branding applied to content without a creator profile'
                    : 'Set default intro, outro, and watermark for content without a specific creator profile')
                  : (isEditing
                    ? 'Update profile details and platform links'
                    : 'Add a new creator with platform connections')
                }}
              </p>
            </div>

            <!-- Content -->
            <div
              class="org-dialog__content"
              @click="
                openPlatformDropdown = null;
                openAssetDropdown = null;
                showOverlayDropdown = false;
              "
            >
              <!-- Basic Info Section -->
              <div class="org-dialog__section">
                <h3 class="org-dialog__section-title">Basic Info</h3>
                <div class="org-dialog__section-items">
                  <div class="org-dialog__field">
                    <label class="org-dialog__label">Name *</label>
                    <input
                      v-model="formData.name"
                      type="text"
                      required
                      :placeholder="formData.scope === 'global' ? 'Branding profile name' : 'Creator name'"
                      class="org-dialog__input"
                    />
                  </div>

                  <div class="org-dialog__field">
                    <label class="org-dialog__label">
                      Description
                      <span class="org-dialog__label-hint">(optional)</span>
                    </label>
                    <textarea
                      v-model="formData.description"
                      rows="2"
                      :placeholder="formData.scope === 'global' ? 'e.g. Default branding for all content' : 'Brief description of this creator...'"
                      class="org-dialog__input org-dialog__textarea"
                    />
                  </div>
                </div>
              </div>

              <!-- Auto DVR Toggle (hidden for org mode and global branding profiles) -->
              <div v-if="mode === 'local' && formData.scope !== 'global'" class="org-dialog__feature-card">
                <div class="org-dialog__feature-icon">
                  <Sparkles :size="16" />
                </div>
                <div class="org-dialog__feature-content">
                  <div class="org-dialog__feature-header">
                    <div class="org-dialog__feature-text">
                      <span class="org-dialog__feature-title">Auto DVR</span>
                      <span class="org-dialog__feature-desc">Automatically start DVR when this creator goes live</span>
                    </div>
                    <Switch v-model="formData.auto_dvr_enabled" />
                  </div>
                </div>
              </div>

              <!-- Platform Links Section (hidden for global branding profiles) -->
              <div v-if="formData.scope !== 'global'" class="org-dialog__section">
                <div class="org-dialog__section-header">
                  <h3 class="org-dialog__section-title">Platform Links</h3>
                  <button type="button" @click="addPlatformLink" class="org-dialog__add-btn">
                    <Plus :size="14" />
                    <span>Add Platform</span>
                  </button>
                </div>

                <!-- Empty State -->
                <div v-if="formData.platformLinks.length === 0" class="org-dialog__empty-state">
                  <p class="org-dialog__empty-text">No platforms added yet</p>
                  <button @click="addPlatformLink" class="org-dialog__empty-link">Add your first platform</button>
                </div>

                <!-- Platform Links List -->
                <div v-else class="org-dialog__section-items">
                  <div v-for="(link, index) in formData.platformLinks" :key="index" class="org-dialog__platform-card">
                    <div class="org-dialog__platform-header">
                      <div class="org-dialog__platform-left">
                        <!-- Profile Image Preview -->
                        <div class="org-dialog__platform-avatar">
                          <img
                            v-if="link.profile_image_url"
                            :src="link.profile_image_url"
                            class="org-dialog__platform-avatar-img"
                            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                          />
                          <component
                            v-else
                            :is="
                              link.platform === 'pumpfun' && link.platform_id && fetchingProfileImage ? Loader2 : Users
                            "
                            :class="[
                              'org-dialog__platform-avatar-icon',
                              link.platform === 'pumpfun' && link.platform_id && fetchingProfileImage
                                ? 'org-dialog__spin'
                                : '',
                            ]"
                          />
                        </div>

                        <!-- Platform Dropdown -->
                        <div class="org-dialog__dropdown-wrapper">
                          <button
                            type="button"
                            @click.stop="togglePlatformDropdown(index)"
                            class="org-dialog__platform-select"
                          >
                            <div
                              class="org-dialog__platform-select-icon"
                              :style="{ backgroundColor: getPlatformColor(link.platform) }"
                            >
                              <img
                                :src="getPlatformIcon(link.platform)"
                                class="org-dialog__platform-select-icon-img"
                                :class="getPlatformIconClass(link.platform)"
                              />
                            </div>
                            <span class="org-dialog__platform-select-label">{{ getPlatformName(link.platform) }}</span>
                            <ChevronDown
                              class="org-dialog__chevron"
                              :class="{ 'org-dialog__chevron--open': openPlatformDropdown === index }"
                            />
                          </button>

                          <!-- Platform Dropdown Menu -->
                          <div v-if="openPlatformDropdown === index" class="org-dialog__dropdown" @click.stop>
                            <div class="org-dialog__dropdown-list">
                              <button
                                v-for="platform in availablePlatforms"
                                :key="platform.id"
                                type="button"
                                @click="selectPlatform(index, platform.id)"
                                class="org-dialog__dropdown-item"
                                :class="{
                                  'org-dialog__dropdown-item--disabled': platform.disabled,
                                  'org-dialog__dropdown-item--active': link.platform === platform.id,
                                }"
                                :disabled="platform.disabled"
                              >
                                <div
                                  class="org-dialog__platform-select-icon"
                                  :style="{ backgroundColor: getPlatformColor(platform.id) }"
                                >
                                  <img
                                    :src="getPlatformIcon(platform.id)"
                                    class="org-dialog__platform-select-icon-img"
                                    :class="getPlatformIconClass(platform.id)"
                                  />
                                </div>
                                <span :class="platform.disabled ? 'org-dialog__text-muted' : ''">
                                  {{ platform.name }}
                                </span>
                                <span v-if="platform.disabled" class="org-dialog__dropdown-badge">Soon</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="org-dialog__platform-actions">
                        <label class="org-dialog__platform-primary">
                          <input
                            type="radio"
                            :name="'primary-' + index"
                            :checked="link.is_primary"
                            @change="setPrimaryLink(index)"
                          />
                          Primary
                        </label>
                        <button type="button" @click="removePlatformLink(index)" class="org-dialog__platform-delete">
                          <Trash2 :size="16" />
                        </button>
                      </div>
                    </div>

                    <div class="org-dialog__platform-fields">
                      <div class="org-dialog__field">
                        <label class="org-dialog__label org-dialog__label--sm">
                          {{ link.platform === 'pumpfun' ? 'Mint ID or URL' : 'Channel Slug or URL' }} *
                        </label>
                        <input
                          v-model="link.platform_id"
                          :placeholder="
                            link.platform === 'pumpfun'
                              ? 'Enter mint ID or paste PumpFun URL'
                              : 'Enter channel slug or paste URL'
                          "
                          class="org-dialog__input org-dialog__input--sm"
                          @blur="extractPlatformId(link)"
                        />
                      </div>
                      <div class="org-dialog__field">
                        <label class="org-dialog__label org-dialog__label--sm">Display Name</label>
                        <input
                          v-model="link.display_name"
                          placeholder="Optional display name"
                          class="org-dialog__input org-dialog__input--sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Asset Selection Section -->
              <div class="org-dialog__section" :class="{ 'org-dialog__section--locked': isFreeTierUser }" @click.stop="openAssetDropdown = null; showOverlayDropdown = false">
                <h3 class="org-dialog__section-title">Default Assets</h3>
                <p class="org-dialog__section-desc">
                  {{ formData.scope === 'global'
                    ? 'Configure the intro, outro, and watermark applied to all content without a specific creator profile.'
                    : "Configure default intro, outro, and watermark for this creator's content."
                  }}
                </p>

                <!-- Free tier lock overlay -->
                <div v-if="isFreeTierUser" class="org-dialog__premium-lock">
                  <Lock :size="16" />
                  <span>Custom assets require a paid plan</span>
                </div>

                <div class="org-dialog__section-items">
                  <!-- Intro Selection -->
                  <div class="org-dialog__asset-row">
                    <label class="org-dialog__asset-label">Intro</label>
                    <div class="org-dialog__asset-controls">
                      <div class="org-dialog__dropdown-wrapper org-dialog__flex-1">
                        <button
                          type="button"
                          @click.stop="toggleAssetDropdown('intro')"
                          :disabled="uploadingIntro"
                          class="org-dialog__asset-select"
                        >
                          <div class="org-dialog__asset-select-icon org-dialog__asset-select-icon--intro">
                            <Play :size="14" />
                          </div>
                          <span class="org-dialog__asset-select-label">
                            {{ getSelectedIntroName() }}
                          </span>
                          <ChevronDown
                            class="org-dialog__chevron"
                            :class="{ 'org-dialog__chevron--open': openAssetDropdown === 'intro' }"
                          />
                        </button>

                        <!-- Intro Dropdown -->
                        <div
                          v-if="openAssetDropdown === 'intro'"
                          class="org-dialog__dropdown org-dialog__dropdown--full"
                          @click.stop
                        >
                          <div class="org-dialog__dropdown-list org-dialog__dropdown-list--scrollable">
                            <button
                              type="button"
                              @click="selectIntro(null)"
                              class="org-dialog__dropdown-item"
                              :class="{ 'org-dialog__dropdown-item--active': formData.intro_id === null }"
                            >
                              <div class="org-dialog__asset-select-icon org-dialog__asset-select-icon--none">
                                <X :size="14" />
                              </div>
                              <span class="org-dialog__text-muted">No intro</span>
                            </button>
                            <button
                              v-for="asset in introAssets"
                              :key="asset.id"
                              type="button"
                              @click="selectIntro(asset.id)"
                              class="org-dialog__dropdown-item"
                              :class="{ 'org-dialog__dropdown-item--active': formData.intro_id === asset.id }"
                            >
                              <div class="org-dialog__asset-select-icon org-dialog__asset-select-icon--intro">
                                <Play :size="14" />
                              </div>
                              <span class="org-dialog__truncate">{{ asset.name }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      <!-- Configure intro per aspect ratio -->
                      <button
                        type="button"
                        @click="openRatioPicker('intro')"
                        class="org-dialog__asset-upload"
                        :class="{ 'org-dialog__asset-upload--active': hasIntroRatioConfig }"
                        title="Configure intro per aspect ratio"
                      >
                        <Settings2 :size="16" />
                      </button>
                      <button
                        type="button"
                        @click="handleIntroUploadClick"
                        :disabled="uploadingIntro"
                        class="org-dialog__asset-upload"
                        title="Upload new intro"
                      >
                        <Loader2 v-if="uploadingIntro" :size="16" class="org-dialog__spin" />
                        <Upload v-else :size="16" />
                      </button>
                    </div>
                    <p class="org-dialog__asset-ratio-hint">16:9 aspect ratio</p>
                    <p v-if="hasIntroRatioConfig" class="org-dialog__asset-hint">
                      <Settings2 :size="12" />
                      Per-ratio intros configured
                    </p>
                  </div>

                  <!-- Outro Selection -->
                  <div class="org-dialog__asset-row">
                    <label class="org-dialog__asset-label">Outro</label>
                    <div class="org-dialog__asset-controls">
                      <div class="org-dialog__dropdown-wrapper org-dialog__flex-1">
                        <button
                          type="button"
                          @click.stop="toggleAssetDropdown('outro')"
                          :disabled="uploadingOutro"
                          class="org-dialog__asset-select"
                        >
                          <div class="org-dialog__asset-select-icon org-dialog__asset-select-icon--outro">
                            <SkipForward :size="14" />
                          </div>
                          <span class="org-dialog__asset-select-label">
                            {{ getSelectedOutroName() }}
                          </span>
                          <ChevronDown
                            class="org-dialog__chevron"
                            :class="{ 'org-dialog__chevron--open': openAssetDropdown === 'outro' }"
                          />
                        </button>

                        <!-- Outro Dropdown -->
                        <div
                          v-if="openAssetDropdown === 'outro'"
                          class="org-dialog__dropdown org-dialog__dropdown--full"
                          @click.stop
                        >
                          <div class="org-dialog__dropdown-list org-dialog__dropdown-list--scrollable">
                            <button
                              type="button"
                              @click="selectOutro(null)"
                              class="org-dialog__dropdown-item"
                              :class="{ 'org-dialog__dropdown-item--active': formData.outro_id === null }"
                            >
                              <div class="org-dialog__asset-select-icon org-dialog__asset-select-icon--none">
                                <X :size="14" />
                              </div>
                              <span class="org-dialog__text-muted">No outro</span>
                            </button>
                            <button
                              v-for="asset in outroAssets"
                              :key="asset.id"
                              type="button"
                              @click="selectOutro(asset.id)"
                              class="org-dialog__dropdown-item"
                              :class="{ 'org-dialog__dropdown-item--active': formData.outro_id === asset.id }"
                            >
                              <div class="org-dialog__asset-select-icon org-dialog__asset-select-icon--outro">
                                <SkipForward :size="14" />
                              </div>
                              <span class="org-dialog__truncate">{{ asset.name }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      <!-- Configure outro per aspect ratio -->
                      <button
                        type="button"
                        @click="openRatioPicker('outro')"
                        class="org-dialog__asset-upload"
                        :class="{ 'org-dialog__asset-upload--active': hasOutroRatioConfig }"
                        title="Configure outro per aspect ratio"
                      >
                        <Settings2 :size="16" />
                      </button>
                      <button
                        type="button"
                        @click="handleOutroUploadClick"
                        :disabled="uploadingOutro"
                        class="org-dialog__asset-upload"
                        title="Upload new outro"
                      >
                        <Loader2 v-if="uploadingOutro" :size="16" class="org-dialog__spin" />
                        <Upload v-else :size="16" />
                      </button>
                    </div>
                    <p class="org-dialog__asset-ratio-hint">16:9 aspect ratio</p>
                    <p v-if="hasOutroRatioConfig" class="org-dialog__asset-hint">
                      <Settings2 :size="12" />
                      Per-ratio outros configured
                    </p>
                  </div>

                  <!-- Watermark Selection -->
                  <div class="org-dialog__asset-row">
                    <label class="org-dialog__asset-label">Watermark</label>
                    <div class="org-dialog__asset-controls">
                      <div class="org-dialog__dropdown-wrapper org-dialog__flex-1">
                        <button
                          type="button"
                          @click.stop="toggleAssetDropdown('watermark')"
                          :disabled="uploadingWatermark"
                          class="org-dialog__asset-select"
                        >
                          <div class="org-dialog__asset-select-icon org-dialog__asset-select-icon--watermark">
                            <Image :size="14" />
                          </div>
                          <span class="org-dialog__asset-select-label">
                            {{ getSelectedWatermarkName() }}
                          </span>
                          <ChevronDown
                            class="org-dialog__chevron"
                            :class="{ 'org-dialog__chevron--open': openAssetDropdown === 'watermark' }"
                          />
                        </button>

                        <!-- Watermark Dropdown -->
                        <div
                          v-if="openAssetDropdown === 'watermark'"
                          class="org-dialog__dropdown org-dialog__dropdown--full"
                          @click.stop
                        >
                          <div class="org-dialog__dropdown-list org-dialog__dropdown-list--scrollable">
                            <button
                              type="button"
                              @click="selectWatermark(null)"
                              class="org-dialog__dropdown-item"
                              :class="{ 'org-dialog__dropdown-item--active': formData.watermark_id === null }"
                            >
                              <div class="org-dialog__asset-select-icon org-dialog__asset-select-icon--none">
                                <X :size="14" />
                              </div>
                              <span class="org-dialog__text-muted">No watermark</span>
                            </button>
                            <button
                              v-for="asset in watermarkAssets"
                              :key="asset.id"
                              type="button"
                              @click="selectWatermark(asset.id)"
                              class="org-dialog__dropdown-item"
                              :class="{ 'org-dialog__dropdown-item--active': formData.watermark_id === asset.id }"
                            >
                              <div class="org-dialog__asset-select-icon org-dialog__asset-select-icon--watermark">
                                <Image :size="14" />
                              </div>
                              <span class="org-dialog__truncate">{{ asset.name }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      <!-- Configure position button -->
                      <button
                        type="button"
                        @click="openWatermarkPositionPicker"
                        :disabled="!formData.watermark_id"
                        class="org-dialog__asset-upload"
                        :class="{ 'org-dialog__asset-upload--active': formData.watermark_settings }"
                        title="Configure watermark position"
                      >
                        <Settings2 :size="16" />
                      </button>
                      <input
                        ref="watermarkFileInput"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        class="org-dialog__hidden"
                        @change="handleWatermarkUpload"
                      />
                      <button
                        type="button"
                        @click="watermarkFileInput?.click()"
                        :disabled="uploadingWatermark"
                        class="org-dialog__asset-upload"
                        title="Upload new watermark"
                      >
                        <Loader2 v-if="uploadingWatermark" :size="16" class="org-dialog__spin" />
                        <Upload v-else :size="16" />
                      </button>
                    </div>
                    <!-- Configured indicator -->
                    <p v-if="formData.watermark_settings" class="org-dialog__asset-hint">
                      <Settings2 :size="12" />
                      Position configured for {{ getConfiguredRatiosCount() }} aspect ratio(s)
                    </p>
                  </div>

                  <!-- Layout Overlays Section -->
                  <div class="org-dialog__asset-row">
                    <label class="org-dialog__asset-label">Layout Overlays</label>
                    <div class="org-dialog__asset-controls">
                      <div class="org-dialog__dropdown-wrapper org-dialog__flex-1">
                        <button
                          type="button"
                          class="org-dialog__asset-select"
                          :disabled="uploadingOverlay"
                          @click.stop="showOverlayDropdown = !showOverlayDropdown"
                        >
                          <div class="org-dialog__asset-select-icon org-dialog__asset-select-icon--overlay">
                            <Layers :size="14" />
                          </div>
                          <span class="org-dialog__asset-select-label">
                            {{ formData.layout_overlays.length > 0
                              ? `${formData.layout_overlays.length} overlay${formData.layout_overlays.length > 1 ? 's' : ''}`
                              : 'No overlays' }}
                          </span>
                          <ChevronDown
                            class="org-dialog__chevron"
                            :class="{ 'org-dialog__chevron--open': showOverlayDropdown }"
                          />
                        </button>

                        <!-- Overlay Dropdown -->
                        <div
                          v-if="showOverlayDropdown"
                          class="org-dialog__dropdown org-dialog__dropdown--full"
                          @click.stop
                        >
                          <div class="org-dialog__dropdown-list org-dialog__dropdown-list--scrollable">
                            <button
                              v-if="formData.layout_overlays.length === 0"
                              type="button"
                              class="org-dialog__dropdown-item org-dialog__dropdown-item--active"
                              disabled
                            >
                              <div class="org-dialog__asset-select-icon org-dialog__asset-select-icon--none">
                                <X :size="14" />
                              </div>
                              <span class="org-dialog__text-muted">No overlays added</span>
                            </button>
                            <div
                              v-for="(overlay, idx) in formData.layout_overlays"
                              :key="overlay.id"
                              class="org-dialog__dropdown-item org-dialog__dropdown-item--overlay"
                            >
                              <div class="org-dialog__overlay-thumb">
                                <img
                                  v-if="overlayPreviews[overlay.id]"
                                  :src="overlayPreviews[overlay.id]"
                                  class="org-dialog__overlay-thumb-img"
                                  alt=""
                                />
                                <Layers v-else :size="12" style="color: var(--sidebar-text-muted)" />
                              </div>
                              <div class="org-dialog__overlay-info">
                                <input
                                  v-model="overlay.label"
                                  class="org-dialog__overlay-name"
                                  :placeholder="`Overlay ${idx + 1}`"
                                  @click.stop
                                />
                                <span class="org-dialog__overlay-meta">
                                  {{ overlay.opacity }}% opacity
                                  <template v-if="overlayConfiguredRatioCount(overlay) > 0">
                                    · {{ overlayConfiguredRatioCount(overlay) }}/4 ratios
                                  </template>
                                </span>
                              </div>
                              <button
                                type="button"
                                @click.stop="openOverlayPositionPicker(idx)"
                                class="org-dialog__overlay-action"
                                :class="{ 'org-dialog__overlay-action--active': overlayConfiguredRatioCount(overlay) > 0 }"
                                title="Configure position per aspect ratio"
                              >
                                <Settings2 :size="14" />
                              </button>
                              <button
                                type="button"
                                @click.stop="removeLayoutOverlay(idx)"
                                class="org-dialog__overlay-action org-dialog__overlay-action--danger"
                                title="Remove overlay"
                              >
                                <Trash2 :size="14" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <!-- Configure position button -->
                      <button
                        type="button"
                        @click="openOverlayPositionPicker(0)"
                        :disabled="formData.layout_overlays.length === 0"
                        class="org-dialog__asset-upload"
                        :class="{ 'org-dialog__asset-upload--active': totalOverlayRatios > 0 }"
                        title="Configure overlay position"
                      >
                        <Settings2 :size="16" />
                      </button>
                      <button
                        type="button"
                        @click="addLayoutOverlay"
                        :disabled="uploadingOverlay"
                        class="org-dialog__asset-upload"
                        title="Upload new overlay"
                      >
                        <Loader2 v-if="uploadingOverlay" :size="16" class="org-dialog__spin" />
                        <Upload v-else :size="16" />
                      </button>
                    </div>
                    <p v-if="formData.layout_overlays.length > 0" class="org-dialog__asset-hint">
                      <Layers :size="12" />
                      {{ totalOverlayRatios }} aspect ratio(s) configured across {{ formData.layout_overlays.length }} overlay(s)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="org-dialog__footer">
              <button
                type="button"
                @click="closeDialog"
                :disabled="saving"
                class="org-dialog__btn org-dialog__btn--secondary"
              >
                Cancel
              </button>
              <button
                @click="handleSubmit"
                :disabled="!isValid || saving || fetchingProfileImage"
                class="org-dialog__btn org-dialog__btn--primary"
              >
                <Loader2 v-if="saving || fetchingProfileImage" :size="16" class="org-dialog__btn-spinner" />
                {{
                  saving
                    ? 'Saving...'
                    : fetchingProfileImage
                      ? 'Fetching Info...'
                      : formData.scope === 'global'
                        ? (isEditing ? 'Update Branding' : 'Create Branding')
                        : (isEditing ? 'Update Profile' : 'Create Profile')
                }}
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
    :watermark-url="mode === 'organization' ? selectedWatermarkAsset?.url : undefined"
    :watermark-file-path="mode === 'local' ? selectedWatermarkFilePath : undefined"
    :watermark-id="selectedWatermarkId"
    :watermark-width="selectedWatermarkDimensions.width"
    :watermark-height="selectedWatermarkDimensions.height"
    :settings="formData.watermark_settings || undefined"
    @close="showWatermarkPositionPicker = false"
    @save="handleWatermarkSettingsSave"
  />

  <!-- Overlay Position Picker -->
  <OverlayPositionPicker
    :show="showOverlayPositionPicker"
    :overlay-image-path="activeOverlayForPosition?.imagePath || ''"
    :overlay-label="activeOverlayForPosition?.label || ''"
    :settings="activeOverlayForPosition?.perRatioSettings || undefined"
    @close="showOverlayPositionPicker = false"
    @save="handleOverlayPositionSave"
  />

  <!-- Intro/Outro Ratio Picker -->
  <IntroOutroRatioPicker
    :show="showIntroOutroRatioPicker"
    :mode="ratioPickerMode"
    :initial-settings="getInitialRatioSettings(ratioPickerMode)"
    @update:show="showIntroOutroRatioPicker = $event"
    @save="handleRatioSettingsSave"
    @close="showIntroOutroRatioPicker = false"
  />
</template>

<script setup lang="ts">
  import { ref, computed, watch, onUnmounted } from 'vue';
  import {
    UserCircle,
    Plus,
    X,
    Play,
    SkipForward,
    Image,
    Loader2,
    Upload,
    ChevronDown,
    Trash2,
    Users,
    Settings2,
    Sparkles,
    Paintbrush,
    Layers,
    Lock,
  } from 'lucide-vue-next';
  import { Switch } from '@/components/ui/switch';
  import {
    createOrganizationCreatorProfile,
    updateOrganizationCreatorProfile,
    addPlatformLink as apiAddPlatformLink,
    deletePlatformLink as apiDeletePlatformLink,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import {
    listOrganizationAssets,
    uploadOrganizationAsset,
    type ServerOrganizationAsset,
  } from '@/services/organizationAssetsApi';
  import {
    createCreatorProfile,
    updateCreatorProfile,
    addPlatformLink as dbAddPlatformLink,
    deletePlatformLink as dbDeletePlatformLink,
    updatePlatformLink as dbUpdatePlatformLink,
    getAllIntroOutros,
    createMonitoredStreamer,
    getMonitoredStreamerByMint,
    type CreatorProfileWithLinks,
    type IntroOutro,
  } from '@/services/database';
  import { getAllWatermarkImages, type WatermarkImage } from '@/services/database/watermarks';
  import { extractMintId, searchPumpFunTokens, fetchTokenMetadataFromServer } from '@/services/pumpfun';
  import { extractChannelSlug, checkKickLivestream } from '@/services/kick';
  import { extractChannelName, checkTwitchLivestream } from '@/services/twitch';
  import { readFile } from '@tauri-apps/plugin-fs';
  import { useToast } from '@/composables/useToast';
  import { useAssetOperations } from '@/composables/useAssetOperations';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import WatermarkPositionPicker, { type CreatorWatermarkSettings } from './WatermarkPositionPicker.vue';
  import OverlayPositionPicker from './OverlayPositionPicker.vue';
  import IntroOutroRatioPicker from './IntroOutroRatioPicker.vue';
  import type { RatioAssetMap } from '@/services/database/types';
  import type { LayoutOverlay, PerRatioOverlaySettings } from '@/types';
  import { invoke } from '@tauri-apps/api/core';
  import { useAuthStore } from '@/stores/auth';

  type PlatformId = 'pumpfun' | 'kick' | 'twitch' | 'youtube';

  interface PlatformLinkInput {
    platform: PlatformId;
    platform_id: string;
    display_name: string;
    profile_image_url?: string;
    is_primary: boolean;
    id?: number | string; // Present if existing link
    isNew?: boolean;
    monitored_streamer_id?: string | null;
  }

  // Unified asset type for both modes
  interface AssetItem {
    id: number | string;
    name: string;
    url?: string;
    file_path?: string;
    width?: number | null;
    height?: number | null;
  }

  interface Props {
    show: boolean;
    mode: 'organization' | 'local';
    // Organization mode props
    organizationId?: string | number;
    profile?: ServerOrganizationCreatorProfile | null;
    // Local mode props
    creator?: CreatorProfileWithLinks | null;
    // Scope for new profiles ('streamer' or 'global')
    scope?: 'streamer' | 'global';
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'saved', profile?: ServerOrganizationCreatorProfile): void;
  }>();

  const { success: showSuccess, error: showError } = useToast();

  // Free tier detection
  const authStoreForTier = useAuthStore();
  const isFreeTierUser = computed(() => {
    if (props.mode === 'organization') return false; // org mode doesn't apply
    const user = authStoreForTier.user;
    if (!user) return false;
    if (user.is_admin) return false;
    if (user.created_by_organization_id) return false;
    const status = (user as any).subscription_status;
    return !status || status === 'none' || status === 'expired';
  });

  // Asset operations for local mode
  const { uploadAsset: uploadVideoAsset, onUploadComplete } = useAssetOperations();
  const { uploadWatermark } = useWatermarkOperations();
  const pendingUploadType = ref<'intro' | 'outro' | null>(null);

  const saving = ref(false);
  const fetchingProfileImage = ref(false);

  // Assets storage
  const orgAssets = ref<ServerOrganizationAsset[]>([]);
  const localIntros = ref<IntroOutro[]>([]);
  const localOutros = ref<IntroOutro[]>([]);
  const localWatermarks = ref<WatermarkImage[]>([]);

  // Dropdown state
  const openPlatformDropdown = ref<number | null>(null);
  const openAssetDropdown = ref<'intro' | 'outro' | 'watermark' | null>(null);

  // Upload state
  const watermarkFileInput = ref<HTMLInputElement | null>(null);
  const uploadingIntro = ref(false);
  const uploadingOutro = ref(false);
  const uploadingWatermark = ref(false);

  // Available platforms
  const availablePlatforms = [
    { id: 'pumpfun' as PlatformId, name: 'PumpFun', disabled: false },
    { id: 'kick' as PlatformId, name: 'Kick', disabled: false },
    { id: 'twitch' as PlatformId, name: 'Twitch', disabled: false },
    { id: 'youtube' as PlatformId, name: 'YouTube', disabled: true },
  ];

  const formData = ref<{
    name: string;
    description: string;
    intro_id: number | string | null;
    outro_id: number | string | null;
    watermark_id: number | string | null;
    watermark_settings: CreatorWatermarkSettings | null;
    intro_outro_settings: string | null;
    intro_ratio_settings: string | null;
    outro_ratio_settings: string | null;
    layout_overlays: LayoutOverlay[];
    platformLinks: PlatformLinkInput[];
    auto_dvr_enabled: boolean;
    scope: 'streamer' | 'global';
  }>({
    name: '',
    description: '',
    intro_id: null,
    outro_id: null,
    watermark_id: null,
    watermark_settings: null,
    intro_outro_settings: null,
    intro_ratio_settings: null,
    outro_ratio_settings: null,
    layout_overlays: [],
    platformLinks: [],
    auto_dvr_enabled: false,
    scope: 'streamer',
  });

  // Watermark position picker state
  const showWatermarkPositionPicker = ref(false);

  // Overlay state
  const overlayPreviews = ref<Record<string, string>>({});
  const showOverlayDropdown = ref(false);
  const showOverlayPositionPicker = ref(false);
  const activeOverlayIndex = ref(-1);
  const uploadingOverlay = ref(false);

  const activeOverlayForPosition = computed(() => {
    if (activeOverlayIndex.value < 0 || activeOverlayIndex.value >= formData.value.layout_overlays.length) return null;
    return formData.value.layout_overlays[activeOverlayIndex.value];
  });

  function overlayConfiguredRatioCount(overlay: LayoutOverlay): number {
    if (!overlay.perRatioSettings) return 0;
    const s = overlay.perRatioSettings;
    return [s['16:9'], s['9:16'], s['1:1'], s['4:5']].filter((v) => v !== null && v !== undefined).length;
  }

  const totalOverlayRatios = computed(() => {
    return formData.value.layout_overlays.reduce((sum, o) => sum + overlayConfiguredRatioCount(o), 0);
  });

  // Intro/Outro ratio picker state
  const showIntroOutroRatioPicker = ref(false);
  const ratioPickerMode = ref<'intro' | 'outro'>('intro');

  // Computed assets based on mode
  const introAssets = computed<AssetItem[]>(() => {
    if (props.mode === 'organization') {
      return orgAssets.value
        .filter((a) => a.asset_type === 'intro')
        .map((a) => ({ id: a.id, name: a.name, url: a.url, width: a.width, height: a.height }));
    }
    return localIntros.value.map((a) => ({ id: a.id, name: a.name, file_path: a.file_path }));
  });

  const outroAssets = computed<AssetItem[]>(() => {
    if (props.mode === 'organization') {
      return orgAssets.value
        .filter((a) => a.asset_type === 'outro')
        .map((a) => ({ id: a.id, name: a.name, url: a.url, width: a.width, height: a.height }));
    }
    return localOutros.value.map((a) => ({ id: a.id, name: a.name, file_path: a.file_path }));
  });

  const watermarkAssets = computed<AssetItem[]>(() => {
    if (props.mode === 'organization') {
      return orgAssets.value
        .filter((a) => a.asset_type === 'watermark')
        .map((a) => ({ id: a.id, name: a.name, url: a.url, width: a.width, height: a.height }));
    }
    return localWatermarks.value.map((a) => ({
      id: a.id,
      name: a.name,
      file_path: a.file_path,
      width: a.width,
      height: a.height,
    }));
  });

  // Get selected watermark asset for position picker
  const selectedWatermarkAsset = computed(() => {
    if (!formData.value.watermark_id) return null;
    if (props.mode === 'organization') {
      return orgAssets.value.find((a) => a.id === formData.value.watermark_id) || null;
    }
    return null;
  });

  const selectedWatermarkFilePath = computed(() => {
    if (!formData.value.watermark_id || props.mode !== 'local') return undefined;
    const wm = localWatermarks.value.find((w) => w.id === formData.value.watermark_id);
    return wm?.file_path;
  });

  const selectedWatermarkId = computed(() => {
    if (!formData.value.watermark_id) return undefined;
    return String(formData.value.watermark_id);
  });

  const selectedWatermarkDimensions = computed(() => {
    if (!formData.value.watermark_id) return { width: null, height: null };
    if (props.mode === 'organization') {
      const asset = orgAssets.value.find((a) => a.id === formData.value.watermark_id);
      return { width: asset?.width ?? null, height: asset?.height ?? null };
    }
    const wm = localWatermarks.value.find((w) => w.id === formData.value.watermark_id);
    return { width: wm?.width ?? null, height: wm?.height ?? null };
  });

  const isEditing = computed(() => {
    return props.mode === 'organization' ? !!props.profile : !!props.creator;
  });

  const isValid = computed(() => {
    if (!formData.value.name.trim()) return false;
    // Platform links are now optional for local mode
    // Users can create profiles with just assets (intro/outro/watermark) for local video projects
    return true;
  });

  watch(
    () => props.show,
    async (newVal) => {
      if (newVal) {
        openPlatformDropdown.value = null;
        openAssetDropdown.value = null;
        showWatermarkPositionPicker.value = false;

        // Load assets based on mode
        if (props.mode === 'organization' && props.organizationId) {
          const response = await listOrganizationAssets(props.organizationId);
          if (response.success) {
            orgAssets.value = response.assets;
          }
        } else if (props.mode === 'local') {
          await loadLocalAssets();
        }

        // Reset or populate form
        if (props.mode === 'organization' && props.profile) {
          formData.value = {
            name: props.profile.name,
            description: props.profile.description || '',
            intro_id: props.profile.intro_id,
            outro_id: props.profile.outro_id,
            watermark_id: props.profile.watermark_id,
            watermark_settings: (props.profile.watermark_settings as unknown as CreatorWatermarkSettings) || null,
            intro_outro_settings: (props.profile as any).intro_outro_settings || null,
            intro_ratio_settings: (props.profile as any).intro_ratio_settings || null,
            outro_ratio_settings: (props.profile as any).outro_ratio_settings || null,
            layout_overlays: (props.profile.layout_overlays as unknown as LayoutOverlay[]) || [],
            auto_dvr_enabled: Boolean((props.profile as any).auto_dvr_enabled),
            scope: ((props.profile as any).scope as 'streamer' | 'global') || props.scope || 'streamer',
            platformLinks: props.profile.platform_links.map((link) => ({
              id: link.id,
              platform: link.platform as PlatformId,
              platform_id: link.platform_id,
              display_name: link.display_name || '',
              profile_image_url: link.profile_image_url || '',
              is_primary: link.is_primary,
              isNew: false,
              monitored_streamer_id: null,
            })),
          };
        } else if (props.mode === 'local' && props.creator) {
          formData.value = {
            name: props.creator.name,
            description: props.creator.description || '',
            intro_id: props.creator.intro_id,
            outro_id: props.creator.outro_id,
            watermark_id: props.creator.watermark_id,
            watermark_settings: props.creator.watermark_settings ? JSON.parse(props.creator.watermark_settings) : null,
            intro_outro_settings: props.creator.intro_outro_settings || null,
            intro_ratio_settings: props.creator.intro_ratio_settings || null,
            outro_ratio_settings: props.creator.outro_ratio_settings || null,
            layout_overlays: props.creator.layout_overlays ? JSON.parse(props.creator.layout_overlays) : [],
            auto_dvr_enabled: Boolean((props.creator as any).auto_dvr_enabled),
            scope: props.creator.scope || props.scope || 'streamer',
            platformLinks: props.creator.platform_links.map((link) => ({
              id: link.id,
              platform: link.platform as PlatformId,
              platform_id: link.platform_id,
              display_name: link.display_name || '',
              profile_image_url: link.profile_image_url || '',
              is_primary: Boolean(link.is_primary),
              isNew: false,
              monitored_streamer_id: link.monitored_streamer_id,
            })),
          };
        } else {
          formData.value = {
            name: '',
            description: '',
            intro_id: null,
            outro_id: null,
            watermark_id: null,
            watermark_settings: null,
            intro_outro_settings: null,
            intro_ratio_settings: null,
            outro_ratio_settings: null,
            layout_overlays: [],
            platformLinks: [],
            auto_dvr_enabled: false,
            scope: props.scope || 'streamer',
          };
        }

        // Load overlay previews
        await loadAllOverlayPreviews();
      }
    }
  );

  async function loadLocalAssets() {
    try {
      const allAssets = await getAllIntroOutros();
      localIntros.value = allAssets.filter((a) => a.type === 'intro');
      localOutros.value = allAssets.filter((a) => a.type === 'outro');
      localWatermarks.value = await getAllWatermarkImages();
    } catch (err) {
      console.error('Failed to load local assets:', err);
    }
  }

  function closeDialog() {
    if (!saving.value) {
      emit('close');
    }
  }

  // ============================================
  // Platform Link Functions
  // ============================================

  function addPlatformLink() {
    formData.value.platformLinks.push({
      platform: 'pumpfun',
      platform_id: '',
      display_name: '',
      is_primary: formData.value.platformLinks.length === 0,
      isNew: true,
    });
  }

  function removePlatformLink(index: number) {
    const removed = formData.value.platformLinks.splice(index, 1)[0];
    // If we removed the primary, set first remaining as primary
    if (removed.is_primary && formData.value.platformLinks.length > 0) {
      formData.value.platformLinks[0].is_primary = true;
    }
  }

  function setPrimaryLink(index: number) {
    formData.value.platformLinks.forEach((link, i) => {
      link.is_primary = i === index;
    });
  }

  function togglePlatformDropdown(index: number) {
    openPlatformDropdown.value = openPlatformDropdown.value === index ? null : index;
  }

  async function selectPlatform(index: number, platformId: PlatformId) {
    const link = formData.value.platformLinks[index];
    link.platform = platformId;
    openPlatformDropdown.value = null;

    // If switching to PumpFun, Kick, or Twitch and we have a platform ID, extract metadata
    if ((platformId === 'pumpfun' || platformId === 'kick' || platformId === 'twitch') && link.platform_id.trim()) {
      await extractPlatformId(link);
    }
  }

  async function extractPlatformId(link: PlatformLinkInput) {
    const input = link.platform_id.trim();
    if (!input) return;

    if (link.platform === 'pumpfun') {
      const mintId = extractMintId(input);
      if (mintId) {
        link.platform_id = mintId;

        // Check if we already have a profile image from another link
        const existingProfileImage = formData.value.platformLinks.find(
          (l) => l !== link && l.profile_image_url
        )?.profile_image_url;

        if (existingProfileImage) {
          link.profile_image_url = existingProfileImage;
          return;
        }

        // Fetch profile image from DexScreener/Metaplex
        fetchingProfileImage.value = true;
        try {
          let match = null;

          // 1. Try DexScreener search first
          const results = await searchPumpFunTokens(mintId);
          if (results && results.length > 0) {
            match = results.find((r) => r.mint === mintId) || results[0];
          }

          // 2. Fallback to server (Metaplex) if no match or missing image
          if (!match || !match.image) {
            const serverMeta = await fetchTokenMetadataFromServer(mintId);
            if (serverMeta) {
              match = serverMeta;
            }
          }

          if (match) {
            // Update display name if not already set
            if (!link.display_name) {
              link.display_name = match.symbol || match.name || '';
            }
            // Store the profile image URL
            link.profile_image_url = match.image || '';
          }
        } catch (e) {
          console.warn('Failed to fetch PumpFun metadata:', e);
        } finally {
          fetchingProfileImage.value = false;
        }
      }
    } else if (link.platform === 'kick') {
      const slug = extractChannelSlug(input);
      if (slug) {
        link.platform_id = slug;

        // Check if we already have a profile image from another link
        const existingProfileImage = formData.value.platformLinks.find(
          (l) => l !== link && l.profile_image_url
        )?.profile_image_url;

        if (existingProfileImage) {
          link.profile_image_url = existingProfileImage;
          return;
        }

        // Fetch profile image from Kick API
        fetchingProfileImage.value = true;
        try {
          const status = await checkKickLivestream(slug);
          if (status) {
            // Update display name if not already set
            if (!link.display_name && status.username) {
              link.display_name = status.username;
            }
            // Store the profile image URL
            if (status.profileImageUrl) {
              link.profile_image_url = status.profileImageUrl;
            }
          }
        } catch (e) {
          console.warn('Failed to fetch Kick channel metadata:', e);
        } finally {
          fetchingProfileImage.value = false;
        }
      }
    } else if (link.platform === 'twitch') {
      const channelName = extractChannelName(input);
      if (channelName) {
        link.platform_id = channelName;

        // Check if we already have a profile image from another link
        const existingProfileImage = formData.value.platformLinks.find(
          (l) => l !== link && l.profile_image_url
        )?.profile_image_url;

        if (existingProfileImage) {
          link.profile_image_url = existingProfileImage;
          return;
        }

        // Fetch profile image from Twitch API
        fetchingProfileImage.value = true;
        try {
          const status = await checkTwitchLivestream(channelName);
          if (status) {
            // Update display name if not already set
            if (!link.display_name && status.displayName) {
              link.display_name = status.displayName;
            }
            // Store the profile image URL
            if (status.profileImageUrl) {
              link.profile_image_url = status.profileImageUrl;
            }
          }
        } catch (e) {
          console.warn('Failed to fetch Twitch channel metadata:', e);
        } finally {
          fetchingProfileImage.value = false;
        }
      }
    }
  }

  // ============================================
  // Platform Helpers
  // ============================================

  function getPlatformIcon(platform: string): string {
    const icons: Record<string, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      youtube: '/youtube.svg',
    };
    return icons[platform] || '/capsule.svg';
  }

  function getPlatformColor(platform: string): string {
    const colors: Record<string, string> = {
      pumpfun: '#10b981',
      kick: '#53FC18',
      twitch: '#9146FF',
      youtube: '#dc2626',
    };
    return colors[platform] || '#6b7280';
  }

  function getPlatformIconClass(platform: string): string {
    if (platform === 'kick') return '';
    return 'org-dialog__brightness';
  }

  function getPlatformName(platform: string): string {
    const names: Record<string, string> = {
      pumpfun: 'PumpFun',
      kick: 'Kick',
      twitch: 'Twitch',
      youtube: 'YouTube',
    };
    return names[platform] || platform;
  }

  // ============================================
  // Asset Dropdown Functions
  // ============================================

  function toggleAssetDropdown(type: 'intro' | 'outro' | 'watermark') {
    openAssetDropdown.value = openAssetDropdown.value === type ? null : type;
  }

  function getSelectedIntroName(): string {
    if (!formData.value.intro_id) return 'No intro';
    const asset = introAssets.value.find((a) => a.id === formData.value.intro_id);
    return asset?.name || 'No intro';
  }

  function getSelectedOutroName(): string {
    if (!formData.value.outro_id) return 'No outro';
    const asset = outroAssets.value.find((a) => a.id === formData.value.outro_id);
    return asset?.name || 'No outro';
  }

  function getSelectedWatermarkName(): string {
    if (!formData.value.watermark_id) return 'No watermark';
    const asset = watermarkAssets.value.find((a) => a.id === formData.value.watermark_id);
    return asset?.name || 'No watermark';
  }

  function selectIntro(id: number | string | null) {
    formData.value.intro_id = id;
    openAssetDropdown.value = null;
  }

  function selectOutro(id: number | string | null) {
    formData.value.outro_id = id;
    openAssetDropdown.value = null;
  }

  function selectWatermark(id: number | string | null) {
    formData.value.watermark_id = id;
    openAssetDropdown.value = null;
    // Clear watermark settings if watermark is removed
    if (!id) {
      formData.value.watermark_settings = null;
    }
  }

  // Open watermark position picker
  function openWatermarkPositionPicker() {
    if (!formData.value.watermark_id) return;
    showWatermarkPositionPicker.value = true;
  }

  // Handle save from watermark position picker
  function handleWatermarkSettingsSave(settings: CreatorWatermarkSettings) {
    formData.value.watermark_settings = settings;
    showWatermarkPositionPicker.value = false;
  }

  // Count how many aspect ratios have watermark configured
  function getConfiguredRatiosCount(): number {
    if (!formData.value.watermark_settings) return 0;
    const settings = formData.value.watermark_settings;
    let count = 0;
    if (settings['16:9']) count++;
    if (settings['9:16']) count++;
    if (settings['1:1']) count++;
    if (settings['4:5']) count++;
    return count;
  }

  // ============================================
  // Overlay Management Functions
  // ============================================

  async function loadOverlayPreview(overlay: LayoutOverlay) {
    // For org overlays with assetId, find the server URL from orgAssets
    if (overlay.assetId && props.mode === 'organization') {
      const asset = orgAssets.value.find(a => a.id === overlay.assetId);
      if (asset?.url) {
        overlayPreviews.value[overlay.id] = asset.url;
        return;
      }
    }
    // For local overlays, read from disk
    if (!overlay.imagePath) return;
    try {
      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: overlay.imagePath });
      overlayPreviews.value[overlay.id] = dataUrl;
    } catch (err) {
      console.warn('[ProfileDialog] Failed to load overlay preview:', overlay.id, err);
    }
  }

  async function loadAllOverlayPreviews() {
    overlayPreviews.value = {};
    for (const overlay of formData.value.layout_overlays) {
      await loadOverlayPreview(overlay);
    }
  }

  async function addLayoutOverlay() {
    if (uploadingOverlay.value) return;
    uploadingOverlay.value = true;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'svg', 'webp', 'jpg', 'jpeg'] }],
      });
      if (!result) return;
      const filePath = result as string;
      const fileName = filePath.split(/[\\\/]/).pop() || 'overlay';
      const assetName = fileName.replace(/\.[^/.]+$/, '');

      if (props.mode === 'organization' && props.organizationId) {
        // Org mode: upload as org asset, store assetId + server URL
        const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
        const mimeMap: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
          webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif',
        };
        const bytes = await readFile(filePath);
        const file = new File([bytes], fileName, { type: mimeMap[ext] || 'image/png' });
        const dimensions = await extractImageDimensions(file);
        const response = await uploadOrganizationAsset(props.organizationId, file, 'overlay', {
          name: assetName,
          width: dimensions.width ?? undefined,
          height: dimensions.height ?? undefined,
        });

        if (response.success && response.asset) {
          orgAssets.value.push(response.asset);
          const newOverlay: LayoutOverlay = {
            id: crypto.randomUUID(),
            imagePath: '',
            assetId: response.asset.id,
            x: 50,
            y: 50,
            width: 100,
            height: 10,
            opacity: 100,
            rotation: 0,
            label: assetName,
          };
          formData.value.layout_overlays.push(newOverlay);
          // Use server URL for preview
          overlayPreviews.value[newOverlay.id] = response.asset.url;
          showSuccess('Overlay Uploaded', `"${assetName}" has been uploaded`);
        } else {
          showError('Upload Failed', response.error || 'Failed to upload overlay');
        }
      } else {
        // Local mode: store local file path directly
        const newOverlay: LayoutOverlay = {
          id: crypto.randomUUID(),
          imagePath: filePath,
          x: 50,
          y: 50,
          width: 100,
          height: 10,
          opacity: 100,
          rotation: 0,
          label: assetName,
        };
        formData.value.layout_overlays.push(newOverlay);
        await loadOverlayPreview(newOverlay);
      }
    } catch (err: any) {
      console.error('[ProfileDialog] Failed to add overlay:', err);
      showError('Upload Failed', err.message || 'Failed to add overlay');
    } finally {
      uploadingOverlay.value = false;
    }
  }

  function removeLayoutOverlay(index: number) {
    const overlay = formData.value.layout_overlays[index];
    if (overlay) {
      delete overlayPreviews.value[overlay.id];
    }
    formData.value.layout_overlays.splice(index, 1);
  }

  function openOverlayPositionPicker(idx: number) {
    activeOverlayIndex.value = idx;
    showOverlayPositionPicker.value = true;
  }

  function handleOverlayPositionSave(settings: PerRatioOverlaySettings) {
    if (activeOverlayIndex.value < 0 || activeOverlayIndex.value >= formData.value.layout_overlays.length) return;

    const overlay = formData.value.layout_overlays[activeOverlayIndex.value];
    overlay.perRatioSettings = settings;

    const firstEnabled = settings['16:9'] || settings['9:16'] || settings['1:1'] || settings['4:5'];
    if (firstEnabled) {
      overlay.x = firstEnabled.x;
      overlay.y = firstEnabled.y;
      overlay.width = firstEnabled.width;
      overlay.height = firstEnabled.height;
      overlay.opacity = firstEnabled.opacity;
      overlay.rotation = firstEnabled.rotation;
    }

    showOverlayPositionPicker.value = false;
  }

  // Check if intro ratio settings are configured
  const hasIntroRatioConfig = computed((): boolean => {
    if (!formData.value.intro_ratio_settings) return false;
    try {
      const settings = JSON.parse(formData.value.intro_ratio_settings);
      return Object.values(settings).some(config => config !== null);
    } catch { return false; }
  });

  // Check if outro ratio settings are configured
  const hasOutroRatioConfig = computed((): boolean => {
    if (!formData.value.outro_ratio_settings) return false;
    try {
      const settings = JSON.parse(formData.value.outro_ratio_settings);
      return Object.values(settings).some(config => config !== null);
    } catch { return false; }
  });

  // Open ratio picker for intro or outro
  function openRatioPicker(mode: 'intro' | 'outro') {
    ratioPickerMode.value = mode;
    showIntroOutroRatioPicker.value = true;
  }

  // Get initial settings for the ratio picker based on mode
  function getInitialRatioSettings(mode: 'intro' | 'outro'): RatioAssetMap | null {
    const raw = mode === 'intro' ? formData.value.intro_ratio_settings : formData.value.outro_ratio_settings;
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  // Handle save from ratio picker
  function handleRatioSettingsSave(settings: RatioAssetMap) {
    if (ratioPickerMode.value === 'intro') {
      formData.value.intro_ratio_settings = JSON.stringify(settings);
    } else {
      formData.value.outro_ratio_settings = JSON.stringify(settings);
    }
    showIntroOutroRatioPicker.value = false;
  }

  // ============================================
  // Asset Upload Functions
  // ============================================

  async function extractVideoMetadata(videoBlob: Blob): Promise<{
    duration: number | null;
    width: number | null;
    height: number | null;
    thumbnail: File | null;
  }> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const result = {
        duration: null as number | null,
        width: null as number | null,
        height: null as number | null,
        thumbnail: null as File | null,
      };

      const cleanup = () => {
        URL.revokeObjectURL(video.src);
      };

      video.onloadedmetadata = () => {
        result.duration = video.duration;
        result.width = video.videoWidth;
        result.height = video.videoHeight;
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  result.thumbnail = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
                }
                cleanup();
                resolve(result);
              },
              'image/jpeg',
              0.8
            );
          } else {
            cleanup();
            resolve(result);
          }
        } catch {
          cleanup();
          resolve(result);
        }
      };

      video.onerror = () => {
        cleanup();
        resolve(result);
      };

      setTimeout(() => {
        if (!result.duration) {
          cleanup();
          resolve(result);
        }
      }, 10000);

      video.src = URL.createObjectURL(videoBlob);
    });
  }

  async function extractImageDimensions(imageBlob: Blob): Promise<{ width: number | null; height: number | null }> {
    return new Promise((resolve) => {
      const img = new window.Image();

      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        resolve({ width: null, height: null });
        URL.revokeObjectURL(img.src);
      };

      img.src = URL.createObjectURL(imageBlob);
    });
  }

  async function selectVideoFileNative(): Promise<File | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Video Files',
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'],
        },
      ],
    });
    if (!selected || typeof selected !== 'string') return null;

    const fileName = selected.split(/[\\\/]/).pop() || 'file';
    const ext = fileName.split('.').pop()?.toLowerCase() || 'mp4';
    const mimeMap: Record<string, string> = {
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
      mkv: 'video/x-matroska', webm: 'video/webm', flv: 'video/x-flv',
      wmv: 'video/x-ms-wmv', m4v: 'video/x-m4v',
    };
    const bytes = await readFile(selected);
    return new File([bytes], fileName, { type: mimeMap[ext] || 'video/mp4' });
  }

  async function handleIntroUploadClick() {
    uploadingIntro.value = true;
    try {
      if (props.mode === 'organization' && props.organizationId) {
        const file = await selectVideoFileNative();
        if (!file) { uploadingIntro.value = false; return; }
        const metadata = await extractVideoMetadata(file);
        const response = await uploadOrganizationAsset(props.organizationId, file, 'intro', {
          name: file.name.replace(/\.[^/.]+$/, ''),
          thumbnail: metadata.thumbnail ?? undefined,
          duration: metadata.duration ?? undefined,
          width: metadata.width ?? undefined,
          height: metadata.height ?? undefined,
        });
        if (response.success && response.asset) {
          orgAssets.value.push(response.asset);
          formData.value.intro_id = response.asset.id;
          showSuccess('Intro Uploaded', `"${response.asset.name}" has been uploaded`);
        } else {
          showError('Upload Failed', response.error || 'Failed to upload intro');
        }
      } else {
        pendingUploadType.value = 'intro';
        await uploadVideoAsset('intro');
      }
    } catch (err: any) {
      console.error('Intro upload error:', err);
      showError('Upload Failed', err.message || 'Failed to upload intro');
      pendingUploadType.value = null;
    } finally {
      uploadingIntro.value = false;
    }
  }

  async function handleOutroUploadClick() {
    uploadingOutro.value = true;
    try {
      if (props.mode === 'organization' && props.organizationId) {
        const file = await selectVideoFileNative();
        if (!file) { uploadingOutro.value = false; return; }
        const metadata = await extractVideoMetadata(file);
        const response = await uploadOrganizationAsset(props.organizationId, file, 'outro', {
          name: file.name.replace(/\.[^/.]+$/, ''),
          thumbnail: metadata.thumbnail ?? undefined,
          duration: metadata.duration ?? undefined,
          width: metadata.width ?? undefined,
          height: metadata.height ?? undefined,
        });
        if (response.success && response.asset) {
          orgAssets.value.push(response.asset);
          formData.value.outro_id = response.asset.id;
          showSuccess('Outro Uploaded', `"${response.asset.name}" has been uploaded`);
        } else {
          showError('Upload Failed', response.error || 'Failed to upload outro');
        }
      } else {
        pendingUploadType.value = 'outro';
        await uploadVideoAsset('outro');
      }
    } catch (err: any) {
      console.error('Outro upload error:', err);
      showError('Upload Failed', err.message || 'Failed to upload outro');
      pendingUploadType.value = null;
    } finally {
      uploadingOutro.value = false;
    }
  }

  async function handleWatermarkUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploadingWatermark.value = true;
    try {
      if (props.mode === 'organization' && props.organizationId) {
        const dimensions = await extractImageDimensions(file);
        const response = await uploadOrganizationAsset(props.organizationId, file, 'watermark', {
          name: file.name.replace(/\.[^/.]+$/, ''),
          width: dimensions.width ?? undefined,
          height: dimensions.height ?? undefined,
        });

        if (response.success && response.asset) {
          orgAssets.value.push(response.asset);
          formData.value.watermark_id = response.asset.id;
          showSuccess('Watermark Uploaded', `"${response.asset.name}" has been uploaded`);
        } else {
          showError('Upload Failed', response.error || 'Failed to upload watermark');
        }
      } else {
        // Local mode
        const result = await uploadWatermark();
        if (result.success && result.watermarkId) {
          await loadLocalAssets();
          formData.value.watermark_id = result.watermarkId;
        }
      }
    } catch (err: any) {
      console.error('Watermark upload error:', err);
      showError('Upload Failed', err.message || 'Failed to upload watermark');
    } finally {
      uploadingWatermark.value = false;
      input.value = '';
    }
  }

  // Register callback for async intro/outro upload completion (local mode)
  const unregisterUploadComplete = onUploadComplete(async () => {
    if (pendingUploadType.value && props.mode === 'local') {
      const uploadType = pendingUploadType.value;
      pendingUploadType.value = null;

      // Reload assets to get the newly uploaded one
      await loadLocalAssets();

      // Find the most recently created asset of the uploaded type
      const assetList = uploadType === 'intro' ? localIntros.value : localOutros.value;
      if (assetList.length > 0) {
        // Sort by created_at descending to get the newest
        const newest = assetList.reduce((a, b) => (a.created_at > b.created_at ? a : b));

        // Auto-select the newest asset
        if (uploadType === 'intro') {
          formData.value.intro_id = newest.id;
        } else {
          formData.value.outro_id = newest.id;
        }
      }
    }
  });

  // Clean up callback registration when component is unmounted
  onUnmounted(() => {
    unregisterUploadComplete();
  });

  // ============================================
  // Form Submit
  // ============================================

  /**
   * Get profile image URL from platform links
   * Prefers the primary link, then falls back to any link with an image
   */
  function getProfileImageFromLinks(): string | undefined {
    const links = formData.value.platformLinks;
    // First try to get from primary link
    const primaryLink = links.find((l) => l.is_primary && l.profile_image_url);
    if (primaryLink?.profile_image_url) {
      return primaryLink.profile_image_url;
    }
    // Fallback to any link with a profile image
    const linkWithImage = links.find((l) => l.profile_image_url);
    return linkWithImage?.profile_image_url || undefined;
  }

  async function handleSubmit() {
    if (!formData.value.name) return;

    saving.value = true;

    try {
      if (props.mode === 'organization') {
        await handleOrganizationSubmit();
      } else {
        await handleLocalSubmit();
      }
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      showError('Save Failed', err.message || 'An error occurred');
    } finally {
      saving.value = false;
    }
  }

  async function handleOrganizationSubmit() {
    if (!props.organizationId) return;

    let profile: ServerOrganizationCreatorProfile | undefined;
    const profileImageUrl = getProfileImageFromLinks();

    if (isEditing.value && props.profile) {
      // Update existing profile
      const response = await updateOrganizationCreatorProfile(props.organizationId, props.profile.id, {
        name: formData.value.name,
        description: formData.value.description || null,
        profile_image_url: profileImageUrl || null,
        intro_id: formData.value.intro_id as number | null,
        outro_id: formData.value.outro_id as number | null,
        watermark_id: formData.value.watermark_id as number | null,
        watermark_settings: formData.value.watermark_settings,
        intro_outro_settings: formData.value.intro_outro_settings ? JSON.parse(formData.value.intro_outro_settings) : null,
        layout_overlays: formData.value.layout_overlays.length > 0
          ? (formData.value.layout_overlays as unknown as Record<string, unknown>[])
          : null,
        scope: formData.value.scope,
      });

      if (!response.success || !response.profile) {
        throw new Error(response.error || 'Failed to update profile');
      }

      profile = response.profile;

      // Handle platform link changes
      const existingLinks = props.profile.platform_links;
      const newLinks = formData.value.platformLinks;

      // Delete removed links
      for (const existing of existingLinks) {
        const stillExists = newLinks.some((l) => l.id === existing.id);
        if (!stillExists) {
          await apiDeletePlatformLink(props.organizationId, props.profile.id, existing.id);
        }
      }

      // Add new links
      for (const link of newLinks) {
        if (link.isNew && link.platform_id.trim()) {
          await apiAddPlatformLink(props.organizationId, props.profile.id, {
            platform: link.platform,
            platform_id: link.platform_id,
            display_name: link.display_name || undefined,
            profile_image_url: link.profile_image_url || undefined,
            is_primary: link.is_primary,
          });
        }
      }

      showSuccess('Profile Updated', `"${profile.name}" has been updated`);
    } else {
      // Create new profile
      const response = await createOrganizationCreatorProfile(props.organizationId, {
        name: formData.value.name,
        description: formData.value.description || undefined,
        profile_image_url: profileImageUrl,
        intro_id: formData.value.intro_id as number | null,
        outro_id: formData.value.outro_id as number | null,
        watermark_id: formData.value.watermark_id as number | null,
        watermark_settings: formData.value.watermark_settings || undefined,
        layout_overlays: formData.value.layout_overlays.length > 0
          ? (formData.value.layout_overlays as unknown as Record<string, unknown>[])
          : null,
        scope: formData.value.scope,
      });

      if (!response.success || !response.profile) {
        throw new Error(response.error || 'Failed to create profile');
      }

      profile = response.profile;

      // Add platform links
      for (const link of formData.value.platformLinks) {
        if (link.platform_id.trim()) {
          await apiAddPlatformLink(props.organizationId, profile.id, {
            platform: link.platform,
            platform_id: link.platform_id,
            display_name: link.display_name || undefined,
            profile_image_url: link.profile_image_url || undefined,
            is_primary: link.is_primary,
          });
        }
      }

      showSuccess('Profile Created', `"${profile.name}" has been created`);
    }

    emit('saved', profile);
    emit('close');
  }

  async function handleLocalSubmit() {
    const validLinks = formData.value.platformLinks.filter((l) => l.platform_id.trim());

    // Find the first existing profile image to reuse for all links
    const firstProfileImage = validLinks.find((l) => l.profile_image_url)?.profile_image_url;

    // Normalize platform IDs and handle profile images
    for (const link of validLinks) {
      if (link.platform === 'pumpfun') {
        const mintId = extractMintId(link.platform_id.trim());
        if (mintId) {
          link.platform_id = mintId;
        }
        if (!link.profile_image_url && firstProfileImage) {
          link.profile_image_url = firstProfileImage;
        }
      } else if (link.platform === 'kick') {
        const slug = extractChannelSlug(link.platform_id.trim());
        if (slug) {
          link.platform_id = slug;
        }
      }
    }

    // Helper to process a single link (create or update)
    const processLink = async (creatorId: string, link: PlatformLinkInput) => {
      let monitoredStreamerId: string | null = null;

      // Resolve monitored streamer for supported platforms
      if (link.platform === 'pumpfun' || link.platform === 'kick' || link.platform === 'twitch') {
        try {
          const existing = await getMonitoredStreamerByMint(link.platform_id.trim());
          if (existing) {
            monitoredStreamerId = existing.id;
          } else {
            monitoredStreamerId = await createMonitoredStreamer(
              link.platform_id.trim(),
              link.display_name.trim() || formData.value.name.trim(),
              link.profile_image_url || undefined,
              5, // segment duration
              formData.value.auto_dvr_enabled,
              link.platform
            );
          }
        } catch (err) {
          console.warn('[ProfileDialog] Failed to resolve monitored_streamer:', err);
        }
      }

      if (link.id && !link.isNew) {
        // Update existing link
        await dbUpdatePlatformLink(String(link.id), {
          platform: link.platform,
          platform_id: link.platform_id.trim(),
          display_name: link.display_name.trim() || null,
          profile_image_url: link.profile_image_url || null,
          monitored_streamer_id: monitoredStreamerId,
          is_primary: link.is_primary,
        });
      } else {
        // Create new link
        await dbAddPlatformLink(
          creatorId,
          link.platform,
          link.platform_id.trim(),
          link.display_name.trim() || null,
          link.profile_image_url || null,
          monitoredStreamerId,
          link.is_primary
        );
      }
    };

    if (isEditing.value && props.creator) {
      // Update existing creator
      await updateCreatorProfile(props.creator.id, {
        name: formData.value.name.trim(),
        description: formData.value.description.trim() || null,
        intro_id: formData.value.intro_id as string | null,
        outro_id: formData.value.outro_id as string | null,
        watermark_id: formData.value.watermark_id as string | null,
        watermark_settings: formData.value.watermark_settings
          ? JSON.stringify(formData.value.watermark_settings)
          : null,
        intro_outro_settings: formData.value.intro_outro_settings,
        intro_ratio_settings: formData.value.intro_ratio_settings,
        outro_ratio_settings: formData.value.outro_ratio_settings,
        auto_dvr_enabled: formData.value.auto_dvr_enabled ? 1 : 0,
        layout_overlays: formData.value.layout_overlays.length > 0
          ? JSON.stringify(formData.value.layout_overlays)
          : null,
      });

      // Delete removed links
      const formIds = new Set(validLinks.filter((l) => l.id && !l.isNew).map((l) => String(l.id)));
      for (const link of props.creator.platform_links) {
        if (!formIds.has(link.id)) {
          await dbDeletePlatformLink(link.id);
        }
      }

      // Process all links (add or update)
      for (const link of validLinks) {
        await processLink(props.creator.id, link);
      }

      showSuccess(
        formData.value.scope === 'global' ? 'Branding Updated' : 'Creator Updated',
        `"${formData.value.name}" has been updated`
      );
    } else {
      // Create new creator
      const creatorId = await createCreatorProfile(
        formData.value.name.trim(),
        formData.value.description.trim() || null,
        null, // profile_image_path
        formData.value.intro_id as string | null,
        formData.value.outro_id as string | null,
        formData.value.watermark_id as string | null,
        formData.value.watermark_settings ? JSON.stringify(formData.value.watermark_settings) : null,
        formData.value.intro_outro_settings,
        formData.value.auto_dvr_enabled,
        formData.value.intro_ratio_settings,
        formData.value.outro_ratio_settings,
        formData.value.scope,
        formData.value.layout_overlays.length > 0
          ? JSON.stringify(formData.value.layout_overlays)
          : null
      );

      // Add platform links
      for (const link of validLinks) {
        await processLink(creatorId, link);
      }

      showSuccess(
        formData.value.scope === 'global' ? 'Branding Created' : 'Creator Created',
        `"${formData.value.name}" has been added`
      );
    }

    // Notify other components (like LiveClip.vue) about the new/updated monitoring data
    window.dispatchEvent(new CustomEvent('monitored-streamers-updated'));

    emit('saved');
    emit('close');
  }
</script>

<style scoped>
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

  .org-dialog--lg {
    max-width: 560px;
  }

  /* ===== Accent Bar ===== */
  .org-dialog__accent {
    height: 3px;
    flex-shrink: 0;
  }

  .org-dialog__accent--cyan {
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  }

  /* ===== Header ===== */
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

  .org-dialog__icon--cyan {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
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

  /* ===== Content ===== */
  .org-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .org-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .org-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .org-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Sections ===== */
  .org-dialog__section {
    margin-bottom: 1.25rem;
  }

  .org-dialog__section:last-child {
    margin-bottom: 0;
  }

  .org-dialog__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.625rem;
  }

  .org-dialog__section-title {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.625rem;
  }

  .org-dialog__section-header .org-dialog__section-title {
    margin: 0;
  }

  .org-dialog__section--locked {
    position: relative;
  }

  .org-dialog__section--locked .org-dialog__section-items {
    opacity: 0.35;
    pointer-events: none;
    filter: blur(1px);
  }

  .org-dialog__premium-lock {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(168, 85, 247, 0.08);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 8px;
    color: #a855f7;
    font-size: 0.75rem;
    font-weight: 500;
    margin-bottom: 0.75rem;
  }

  .org-dialog__section-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: -0.375rem 0 0.75rem;
    opacity: 0.8;
  }

  .org-dialog__section-items {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  /* ===== Form Fields ===== */
  .org-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .org-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .org-dialog__label--sm {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .org-dialog__label-hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
    font-size: 0.8125rem;
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
    opacity: 0.6;
  }

  .org-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .org-dialog__input--sm {
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
  }

  .org-dialog__textarea {
    resize: none;
    min-height: 60px;
  }

  /* ===== Feature Card (Auto DVR) ===== */
  .org-dialog__feature-card {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 1rem;
    background-color: rgba(6, 182, 212, 0.05);
    border: 1px solid rgba(6, 182, 212, 0.15);
    border-radius: 10px;
    margin-bottom: 1.25rem;
  }

  .org-dialog__feature-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    flex-shrink: 0;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .org-dialog__feature-content {
    flex: 1;
    min-width: 0;
  }

  .org-dialog__feature-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .org-dialog__feature-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .org-dialog__feature-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .org-dialog__feature-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Add Button ===== */
  .org-dialog__add-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    color: var(--sidebar-accent);
  }

  .org-dialog__add-btn:hover {
    background-color: rgba(6, 182, 212, 0.1);
  }

  /* ===== Empty State ===== */
  .org-dialog__empty-state {
    padding: 1.25rem;
    border: 1px dashed var(--sidebar-border);
    border-radius: 8px;
    text-align: center;
  }

  .org-dialog__empty-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.5rem;
  }

  .org-dialog__empty-link {
    font-size: 0.8125rem;
    font-weight: 500;
    background: none;
    border: none;
    cursor: pointer;
    transition: opacity 150ms ease;
    color: var(--sidebar-accent);
  }

  .org-dialog__empty-link:hover {
    opacity: 0.8;
  }

  /* ===== Platform Card ===== */
  .org-dialog__platform-card {
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .org-dialog__platform-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.875rem;
  }

  .org-dialog__platform-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .org-dialog__platform-avatar {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    overflow: hidden;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .org-dialog__platform-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-dialog__platform-avatar-icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
  }

  .org-dialog__platform-actions {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .org-dialog__platform-primary {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    cursor: pointer;
  }

  .org-dialog__platform-primary input {
    width: 12px;
    height: 12px;
  }

  .org-dialog__platform-delete {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-dialog__platform-delete:hover {
    background-color: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .org-dialog__platform-fields {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  /* ===== Platform Select Button ===== */
  .org-dialog__platform-select {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.625rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-dialog__platform-select:hover {
    background-color: var(--sidebar-hover);
  }

  .org-dialog__platform-select-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .org-dialog__platform-select-icon-img {
    width: 14px;
    height: 14px;
  }

  .org-dialog__platform-select-label {
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .org-dialog__chevron {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    transition: transform 150ms ease;
  }

  .org-dialog__chevron--open {
    transform: rotate(180deg);
  }

  /* ===== Dropdown ===== */
  .org-dialog__dropdown-wrapper {
    position: relative;
  }

  .org-dialog__dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 0.25rem;
    min-width: 180px;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 50;
    overflow: hidden;
  }

  .org-dialog__dropdown--full {
    right: 0;
  }

  .org-dialog__dropdown-list {
    padding: 0.25rem;
  }

  .org-dialog__dropdown-list--scrollable {
    max-height: 200px;
    overflow-y: auto;
  }

  .org-dialog__dropdown-list--scrollable::-webkit-scrollbar {
    width: 6px;
  }

  .org-dialog__dropdown-list--scrollable::-webkit-scrollbar-track {
    background: transparent;
  }

  .org-dialog__dropdown-list--scrollable::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .org-dialog__dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .org-dialog__dropdown-item:hover:not(.org-dialog__dropdown-item--disabled) {
    background-color: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
  }

  .org-dialog__dropdown-item--active {
    background-color: var(--sidebar-active);
  }

  .org-dialog__dropdown-item--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__dropdown-badge {
    margin-left: auto;
    padding: 0.125rem 0.375rem;
    background-color: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
    font-size: 0.625rem;
    font-weight: 600;
    border-radius: 9999px;
  }

  /* ===== Asset Row ===== */
  .org-dialog__asset-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-dialog__asset-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .org-dialog__asset-controls {
    display: flex;
    gap: 0.5rem;
  }

  .org-dialog__asset-hint {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.6875rem;
    color: #f59e0b;
    opacity: 0.9;
    margin: 0;
  }

  .org-dialog__asset-ratio-hint {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    margin: -0.25rem 0 0;
  }

  /* ===== Asset Select Button ===== */
  .org-dialog__asset-select {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-dialog__asset-select:hover:not(:disabled) {
    background-color: var(--sidebar-active);
  }

  .org-dialog__asset-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__asset-select-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: white;
  }

  .org-dialog__asset-select-icon--intro {
    background-color: #3b82f6;
  }

  .org-dialog__asset-select-icon--outro {
    background-color: #a855f7;
  }

  .org-dialog__asset-select-icon--watermark {
    background-color: #f59e0b;
  }

  .org-dialog__asset-select-icon--none {
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text-muted);
  }

  .org-dialog__asset-select-label {
    flex: 1;
    font-size: 0.8125rem;
    font-weight: 500;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ===== Asset Upload Button ===== */
  .org-dialog__asset-upload {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .org-dialog__asset-upload:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .org-dialog__asset-upload:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__asset-upload--active {
    border-color: rgba(245, 158, 11, 0.5);
    color: #f59e0b;
  }

  .org-dialog__asset-upload--danger:hover:not(:disabled) {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .org-dialog__asset-select-icon--overlay {
    background-color: #f59e0b;
  }

  /* ===== Overlay Dropdown Items ===== */
  .org-dialog__dropdown-item--overlay {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    cursor: default;
  }

  .org-dialog__overlay-thumb {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
  }

  .org-dialog__overlay-thumb-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .org-dialog__overlay-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .org-dialog__overlay-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 150ms ease;
  }

  .org-dialog__overlay-action:hover {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .org-dialog__overlay-action--active {
    color: #f59e0b;
  }

  .org-dialog__overlay-action--danger:hover {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .org-dialog__overlay-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
    background: transparent;
    border: none;
    outline: none;
    width: 100%;
    padding: 0;
  }

  .org-dialog__overlay-name::placeholder {
    color: var(--sidebar-text-muted);
  }

  .org-dialog__overlay-meta {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    font-variant-numeric: tabular-nums;
  }

  /* ===== Footer ===== */
  .org-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    margin-top: 1rem;
  }

  /* ===== Buttons ===== */
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

  .org-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #000;
  }

  .org-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-dialog__btn-spinner {
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

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== Utility Classes ===== */
  .org-dialog__flex-1 {
    flex: 1;
  }

  .org-dialog__hidden {
    display: none;
  }

  .org-dialog__truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .org-dialog__spin {
    animation: spin 1s linear infinite;
  }

  .org-dialog__brightness {
    filter: brightness(2);
  }

  .org-dialog__text-muted {
    color: var(--sidebar-text-muted);
  }
</style>

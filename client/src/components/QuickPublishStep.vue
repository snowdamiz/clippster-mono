<template>
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
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { X, Rocket, CheckIcon, ChevronRightIcon, ChevronDown, CropIcon, ArrowLeftIcon, ArrowRightIcon, LayoutGridIcon, SettingsIcon, SparkleIcon, Share2, Megaphone, Loader2, AlertCircle, Instagram, Youtube, FileVideo, Building2, Globe, CaptionsIcon } from 'lucide-vue-next';
import XLogo from '@/components/icons/XLogo.vue';
import TiktokLogo from '@/components/icons/TiktokLogo.vue';
import TokendLogo from '@/components/icons/TokendLogo.vue';
import SubtitlePropertiesPanel from './SubtitlePropertiesPanel.vue';
import SubtitlePreviewCanvas from './SubtitlePreviewCanvas.vue';

export default defineComponent({ components: { X, Rocket, CheckIcon, ChevronRightIcon, ChevronDown, CropIcon, ArrowLeftIcon, ArrowRightIcon, LayoutGridIcon, SettingsIcon, SparkleIcon, Share2, Megaphone, Loader2, AlertCircle, Instagram, Youtube, FileVideo, Building2, Globe, CaptionsIcon, XLogo, TiktokLogo, TokendLogo, SubtitlePropertiesPanel, SubtitlePreviewCanvas }, props: { model: { type: Object, required: true } }, setup(props): Record<string, any> { return props.model; } });
</script>

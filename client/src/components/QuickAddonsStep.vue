<template>
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
                          <span>Branding from organization or campaign (applied per build target)</span>
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
                                class="build-dialog__dropdown-menu quick-publish-scope"
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
                                class="build-dialog__dropdown-menu quick-publish-scope"
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

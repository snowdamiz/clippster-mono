<template>
<div v-if="!isFreeTier" class="build-dialog__intro-outro-section" :class="{ 'build-dialog__intro-outro-section--disabled': hasOrgOrCampaignSelected }">
                      <div v-if="hasOrgOrCampaignSelected" class="build-dialog__disabled-notice">
                        <span>Branding from organization or campaign (applied per build target)</span>
                      </div>
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
                      <div v-if="selectedIntro || selectedOutro" class="build-dialog__duration-summary">
                        <span class="build-dialog__duration-label">Total Duration</span>
                        <span class="build-dialog__duration-value">{{ formatDuration(totalDuration) }}</span>
                      </div>
                      </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { X, Wrench as WrenchIcon, Check as CheckIcon, Crop as CropIcon, Sparkles as SparklesIcon, PencilRuler as PencilRulerIcon, ChevronRight as ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon } from 'lucide-vue-next';

export default defineComponent({ components: { X, WrenchIcon, CheckIcon, CropIcon, SparklesIcon, PencilRulerIcon, ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeftIcon, ArrowRightIcon }, props: { model: { type: Object, required: true } }, setup(props): Record<string, any> { return props.model; } });
</script>

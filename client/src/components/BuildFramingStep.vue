<template>
<div v-if="currentStep === 'framing'" key="framing" class="build-dialog__step-content">
                    <div class="build-dialog__step-header">
                      <h3 class="build-dialog__step-title">Framing & Layout</h3>
                      <p class="build-dialog__step-subtitle">Configure cropping and subtitle positioning</p>
                    </div>
                    <div v-if="hasPortraitRatio" class="build-dialog__framing-section">
                      <div class="build-dialog__section-header">
                        <CropIcon class="build-dialog__section-icon" />
                        <h4 class="build-dialog__section-title">Portrait Cropping</h4>
                      </div>
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
                    <div
                      v-if="!hasPortraitRatio"
                      class="build-dialog__empty-state"
                    >
                      <p class="build-dialog__empty-text">No framing options needed for your selected formats.</p>
                    </div>
                  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { X, Wrench as WrenchIcon, Check as CheckIcon, Crop as CropIcon, Sparkles as SparklesIcon, PencilRuler as PencilRulerIcon, ChevronRight as ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon } from 'lucide-vue-next';
export default defineComponent({ components: { X, WrenchIcon, CheckIcon, CropIcon, SparklesIcon, PencilRulerIcon, ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeftIcon, ArrowRightIcon }, props: { model: { type: Object, required: true } }, setup(props): Record<string, any> { return props.model; } });
</script>

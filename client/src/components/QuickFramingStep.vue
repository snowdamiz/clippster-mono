<template>
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

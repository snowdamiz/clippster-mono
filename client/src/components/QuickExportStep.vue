<template>
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

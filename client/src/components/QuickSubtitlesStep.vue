<template>
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
                          <div class="poi-dialog__sub-header">
                            <span class="poi-dialog__sub-title">Subtitles</span>
                            <span class="text-[10px] shrink-0 font-mono poi-dialog__faint">16:9</span>
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

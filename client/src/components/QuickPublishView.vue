<template>

  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show && !showManualPOIEditor" class="build-dialog__overlay quick-publish-scope">
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
                  <QuickPlatformsStep :model="model" />
                </Transition>

                <!-- Step 2: Framing -->
                <Transition name="step-slide" mode="out-in">
                  <QuickFramingStep :model="model" />
                </Transition>

                <!-- Step 3: Export Settings -->
                <Transition name="step-slide" mode="out-in">
                  <QuickExportStep :model="model" />
                </Transition>

                <!-- Step 4: Add-ons -->
                <Transition name="step-slide" mode="out-in">
                  <QuickAddonsStep :model="model" />
                </Transition>

                <!-- Step 1: Subtitles (choosing / transcribing / editing sub-states) -->
                <Transition name="step-slide" mode="out-in">
                  <QuickSubtitlesStep :model="model" />
                </Transition>

                <!-- Step 6: Publish -->
                <Transition name="step-slide" mode="out-in">
                  <QuickPublishStep :model="model" />
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
  </Teleport>

  <!-- Manual POI Editor — outside wizard teleport so poi-dialog styling is not affected by build-dialog -->
  <slot name="ManualPOIEditor" />

</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { X, Rocket, CheckIcon, ChevronRightIcon, ChevronDown, CropIcon, ArrowLeftIcon, ArrowRightIcon, LayoutGridIcon, SettingsIcon, SparkleIcon, Share2, Megaphone, Loader2, AlertCircle, Instagram, Youtube, FileVideo, Building2, Globe, CaptionsIcon } from 'lucide-vue-next';
import XLogo from '@/components/icons/XLogo.vue';
import TiktokLogo from '@/components/icons/TiktokLogo.vue';
import TokendLogo from '@/components/icons/TokendLogo.vue';
import SubtitlePropertiesPanel from './SubtitlePropertiesPanel.vue';
import SubtitlePreviewCanvas from './SubtitlePreviewCanvas.vue';
import QuickPlatformsStep from './QuickPlatformsStep.vue';
import QuickFramingStep from './QuickFramingStep.vue';
import QuickExportStep from './QuickExportStep.vue';
import QuickAddonsStep from './QuickAddonsStep.vue';
import QuickSubtitlesStep from './QuickSubtitlesStep.vue';
import QuickPublishStep from './QuickPublishStep.vue';
export default defineComponent({ components: { X, Rocket, CheckIcon, ChevronRightIcon, ChevronDown, CropIcon, ArrowLeftIcon, ArrowRightIcon, LayoutGridIcon, SettingsIcon, SparkleIcon, Share2, Megaphone, Loader2, AlertCircle, Instagram, Youtube, FileVideo, Building2, Globe, CaptionsIcon, XLogo, TiktokLogo, TokendLogo, SubtitlePropertiesPanel, SubtitlePreviewCanvas, QuickPlatformsStep, QuickFramingStep, QuickExportStep, QuickAddonsStep, QuickSubtitlesStep, QuickPublishStep }, props: { model: { type: Object, required: true } }, setup(props): Record<string, any> { return props.model; } });
</script>
<style src="@/styles/quickPublish.css"></style>

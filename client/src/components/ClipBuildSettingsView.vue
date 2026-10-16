<template>
<Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="build-dialog__overlay">
        <Transition name="dialog" appear>
          <div class="build-dialog">
            <div class="build-dialog__accent" />
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
                  <div
                    v-if="index < visibleSteps.length - 1"
                    class="build-dialog__step-connector"
                    :class="{ 'build-dialog__step-connector--completed': isStepCompleted(step.id) }"
                  />
                </div>
              </div>
            </div>
            <div class="build-dialog__content">
              <div class="build-dialog__content-inner">
                <Transition name="step-slide" mode="out-in">
                  <BuildPlatformsStep :model="model" />
                </Transition>
                <Transition name="step-slide" mode="out-in">
                  <BuildFramingStep :model="model" />
                </Transition>
                <Transition name="step-slide" mode="out-in">
                  <BuildExportStep :model="model" />
                </Transition>
                <Transition name="step-slide" mode="out-in">
                  <BuildAddonsStep :model="model" />
                </Transition>
              </div>
            </div>
            <div class="build-dialog__footer">
              <div class="build-dialog__footer-left">
                <button v-if="!isFirstStep" @click="previousStep" class="build-dialog__btn build-dialog__btn--back">
                  <ArrowLeftIcon class="build-dialog__btn-icon" />
                  Back
                </button>
              </div>
              <div class="build-dialog__step-info">Step {{ currentStepIndex + 1 }} of {{ visibleSteps.length }}</div>
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
    <slot name="ManualPOIEditor" />
    <slot name="SubtitleAdjustmentDialog" />
  </Teleport>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { X, Wrench as WrenchIcon, Check as CheckIcon, Crop as CropIcon, Sparkles as SparklesIcon, PencilRuler as PencilRulerIcon, ChevronRight as ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon } from 'lucide-vue-next';
import BuildPlatformsStep from './BuildPlatformsStep.vue';
import BuildFramingStep from './BuildFramingStep.vue';
import BuildExportStep from './BuildExportStep.vue';
import BuildAddonsStep from './BuildAddonsStep.vue';
export default defineComponent({ components: { X, WrenchIcon, CheckIcon, CropIcon, SparklesIcon, PencilRulerIcon, ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeftIcon, ArrowRightIcon, BuildPlatformsStep, BuildFramingStep, BuildExportStep, BuildAddonsStep }, props: { model: { type: Object, required: true } }, setup(props): Record<string, any> { return props.model; } });
</script>
<style src="@/styles/clipBuildSettings.css"></style>

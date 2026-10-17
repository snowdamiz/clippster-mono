import { computed, ref, markRaw, type Ref } from 'vue';
import { LayoutGrid, Crop, Settings, Sparkle } from 'lucide-vue-next';
export type ClipBuildStep = 'platforms' | 'framing' | 'export' | 'addons';
export function useClipBuildNavigation(ratios: Ref<string[]>, showFraming: () => boolean) {
  const currentStep = ref<ClipBuildStep>('platforms');
  const steps = [{ id: 'platforms' as const, label: 'Platforms', icon: markRaw(LayoutGrid) }, { id: 'framing' as const, label: 'Framing', icon: markRaw(Crop) }, { id: 'export' as const, label: 'Export', icon: markRaw(Settings) }, { id: 'addons' as const, label: 'Add-ons', icon: markRaw(Sparkle) }];
  const visibleSteps = computed(() => steps.filter(step => step.id !== 'framing' || showFraming()));
  const currentStepIndex = computed(() => visibleSteps.value.findIndex(step => step.id === currentStep.value));
  const isFirstStep = computed(() => currentStepIndex.value === 0), isLastStep = computed(() => currentStepIndex.value === visibleSteps.value.length - 1);
  const canProceed = computed(() => !['platforms', 'addons'].includes(currentStep.value) || ratios.value.length > 0);
  const isStepCompleted = (id: ClipBuildStep) => visibleSteps.value.findIndex(step => step.id === id) < currentStepIndex.value;
  const canNavigateToStep = (id: ClipBuildStep) => { const index = visibleSteps.value.findIndex(step => step.id === id); return index >= 0 && (index <= currentStepIndex.value || index === currentStepIndex.value + 1 && canProceed.value); };
  const goToStep = (id: ClipBuildStep) => { if (canNavigateToStep(id)) currentStep.value = id; };
  const nextStep = () => { if (!isLastStep.value && canProceed.value) currentStep.value = visibleSteps.value[currentStepIndex.value + 1].id; };
  const previousStep = () => { if (!isFirstStep.value) currentStep.value = visibleSteps.value[currentStepIndex.value - 1].id; };
  return { currentStep, visibleSteps, currentStepIndex, isFirstStep, isLastStep, canProceed, isStepCompleted, canNavigateToStep, goToStep, nextStep, previousStep };
}

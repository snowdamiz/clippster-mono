import { describe, expect, it } from 'vitest';
import { reactive, ref } from 'vue';
import { useClipBuildNavigation } from './useClipBuildNavigation';
import { buildViewPresentation, quickPublishPresentation } from '@/lib/sharedViewPresentation';

describe('framing review navigation', () => {
  it('requires applied previews before export and after changing a ratio', () => {
    const reviewed = ref(false);
    const navigation = useClipBuildNavigation(
      ref(['9:16']),
      () => true,
      () => reviewed.value
    );
    navigation.nextStep();
    expect(navigation.currentStep.value).toBe('framing');
    navigation.nextStep();
    expect(navigation.currentStep.value).toBe('framing');
    expect(navigation.canNavigateToStep('export')).toBe(false);
    reviewed.value = true;
    navigation.nextStep();
    expect(navigation.currentStep.value).toBe('export');
    reviewed.value = false;
    expect(navigation.canNavigateToStep('addons')).toBe(false);
    expect(navigation.canNavigateToStep('framing')).toBe(true);
  });
  it.each([buildViewPresentation, quickPublishPresentation])(
    'preserves desktop reactive progress and supplies disabled web defaults',
    (presentation) => {
      const busy = ref(false);
      const desktop = reactive({ framingPreviewBusy: busy, autoFramingAvailable: true });
      Object.assign(desktop, presentation(desktop));
      busy.value = true;
      expect(desktop.framingPreviewBusy).toBe(true);
      const web = reactive<Record<string, unknown>>({});
      Object.assign(web, presentation(web));
      expect(web.autoFramingAvailable).toBe(false);
      expect(web.framingMode).toBe('manual');
    }
  );
});

/**
 * useFramingSettings - Business logic for framing/aspect ratio configuration
 *
 * Extracts framing mode definitions, aspect ratio selection, and validation
 * logic from FramingPanel.vue.
 */

import { ref, computed, type Ref, type Component } from 'vue';
import { Scan, Users, Hand } from 'lucide-vue-next';

/**
 * Framing mode definition
 */
export interface FramingMode {
  id: string;
  name: string;
  description: string;
  icon: Component;
}

/**
 * Available aspect ratios for export
 */
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

/**
 * Available framing modes with descriptions
 */
export const FRAMING_MODES: FramingMode[] = [
  {
    id: 'auto',
    name: 'Auto (Face Detection)',
    description: 'AI tracks faces automatically',
    icon: Scan,
  },
  {
    id: 'speaker',
    name: 'Speaker Tracking',
    description: 'Follow active speaker',
    icon: Users,
  },
  {
    id: 'manual',
    name: 'Manual Framing',
    description: 'Custom crop regions',
    icon: Hand,
  },
];

export type FramingModeId = (typeof FRAMING_MODES)[number]['id'];

export interface FramingSettingsOptions {
  /** Initial selected ratios */
  initialRatios?: AspectRatio[];
  /** Initial framing mode */
  initialMode?: FramingModeId;
  /** Callback when ratios change */
  onRatiosChange?: (ratios: AspectRatio[]) => void;
  /** Callback when framing mode changes */
  onModeChange?: (mode: FramingModeId) => void;
}

export interface FramingSettingsReturn {
  /** Currently selected aspect ratios */
  selectedRatios: Ref<AspectRatio[]>;
  /** Current framing mode */
  framingMode: Ref<FramingModeId>;
  /** Available aspect ratios */
  aspectRatios: typeof ASPECT_RATIOS;
  /** Available framing modes */
  framingModes: typeof FRAMING_MODES;
  /** Check if a ratio is selected */
  isRatioSelected: (ratio: AspectRatio) => boolean;
  /** Toggle a ratio selection */
  toggleRatio: (ratio: AspectRatio) => void;
  /** Set framing mode */
  setFramingMode: (mode: FramingModeId) => void;
  /** Check if manual mode is active */
  isManualMode: Ref<boolean>;
  /** Validate that at least one ratio is selected */
  hasValidSelection: Ref<boolean>;
}

/**
 * Composable for framing settings management
 */
export function useFramingSettings(options: FramingSettingsOptions = {}): FramingSettingsReturn {
  const { initialRatios = ['16:9'], initialMode = 'auto', onRatiosChange, onModeChange } = options;

  // State
  const selectedRatios = ref<AspectRatio[]>([...initialRatios]);
  const framingMode = ref<FramingModeId>(initialMode);

  // Computed
  const isManualMode = computed(() => framingMode.value === 'manual');
  const hasValidSelection = computed(() => selectedRatios.value.length > 0);

  // Check if a ratio is selected
  function isRatioSelected(ratio: AspectRatio): boolean {
    return selectedRatios.value.includes(ratio);
  }

  // Toggle ratio selection with validation
  function toggleRatio(ratio: AspectRatio): void {
    const index = selectedRatios.value.indexOf(ratio);

    if (index > -1) {
      // Don't allow removing if it's the only one
      if (selectedRatios.value.length > 1) {
        selectedRatios.value.splice(index, 1);
        onRatiosChange?.([...selectedRatios.value]);
      }
    } else {
      selectedRatios.value.push(ratio);
      onRatiosChange?.([...selectedRatios.value]);
    }
  }

  // Set framing mode
  function setFramingMode(mode: FramingModeId): void {
    framingMode.value = mode;
    onModeChange?.(mode);
  }

  return {
    selectedRatios,
    framingMode,
    aspectRatios: ASPECT_RATIOS,
    framingModes: FRAMING_MODES,
    isRatioSelected,
    toggleRatio,
    setFramingMode,
    isManualMode,
    hasValidSelection,
  };
}

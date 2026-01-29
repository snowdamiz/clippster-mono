/**
 * usePanelDefinitions - Panel registry and configuration
 *
 * Extracts panel definitions, icons, and labels from ClipEditorSidebar.vue
 * into a centralized, maintainable registry.
 */

import { computed, type Component } from 'vue';
import {
  Film,
  Music,
  Type,
  Smile,
  Sparkles,
  ArrowLeftRight,
  Palette,
  Sliders,
  Crop,
  Image,
  Video,
} from 'lucide-vue-next';

/**
 * Panel definition
 */
export interface PanelDefinition {
  id: string;
  label: string;
  icon: Component;
  /** Whether the panel is fully implemented */
  implemented?: boolean;
}

/**
 * All available panels in the sidebar
 */
export const PANEL_DEFINITIONS: PanelDefinition[] = [
  { id: 'media', label: 'Media', icon: Film, implemented: true },
  { id: 'audio', label: 'Audio', icon: Music, implemented: true },
  { id: 'text', label: 'Text', icon: Type, implemented: true },
  { id: 'stickers', label: 'Stickers', icon: Smile, implemented: true },
  { id: 'effects', label: 'Effects', icon: Sparkles, implemented: false },
  { id: 'transitions', label: 'Transitions', icon: ArrowLeftRight, implemented: false },
  { id: 'filters', label: 'Filters', icon: Palette, implemented: false },
  { id: 'adjust', label: 'Adjust', icon: Sliders, implemented: false },
  { id: 'framing', label: 'Framing', icon: Crop, implemented: true },
  { id: 'watermark', label: 'Watermark', icon: Image, implemented: true },
  { id: 'intro', label: 'Intro/Outro', icon: Video, implemented: true },
];

export type PanelId = (typeof PANEL_DEFINITIONS)[number]['id'];

export interface PanelDefinitionsReturn {
  /** All panel definitions */
  panels: typeof PANEL_DEFINITIONS;
  /** Get panel by ID */
  getPanelById: (id: string) => PanelDefinition | undefined;
  /** Get panel label by ID */
  getPanelLabel: (id: string) => string;
  /** Get panel icon by ID */
  getPanelIcon: (id: string) => Component | undefined;
  /** Check if panel is implemented */
  isPanelImplemented: (id: string) => boolean;
  /** Get only implemented panels */
  implementedPanels: PanelDefinition[];
}

/**
 * Get panel by ID
 */
export function getPanelById(id: string): PanelDefinition | undefined {
  return PANEL_DEFINITIONS.find((p) => p.id === id);
}

/**
 * Get panel label by ID
 */
export function getPanelLabel(id: string): string {
  return getPanelById(id)?.label || 'Unknown';
}

/**
 * Get panel icon by ID
 */
export function getPanelIcon(id: string): Component | undefined {
  return getPanelById(id)?.icon;
}

/**
 * Check if panel is implemented
 */
export function isPanelImplemented(id: string): boolean {
  return getPanelById(id)?.implemented ?? false;
}

/**
 * Get only implemented panels
 */
export const IMPLEMENTED_PANELS = PANEL_DEFINITIONS.filter((p) => p.implemented);

/**
 * Composable for panel definitions
 */
export function usePanelDefinitions(): PanelDefinitionsReturn {
  return {
    panels: PANEL_DEFINITIONS,
    getPanelById,
    getPanelLabel,
    getPanelIcon,
    isPanelImplemented,
    implementedPanels: IMPLEMENTED_PANELS,
  };
}

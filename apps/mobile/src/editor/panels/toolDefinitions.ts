import type { SelectionKind } from '../model/schema';

export type EditorToolId =
  | 'edit'
  | 'text'
  | 'captions'
  | 'audio'
  | 'overlay'
  | 'effects'
  | 'filters'
  | 'adjust'
  | 'add'
  | 'split'
  | 'speed'
  | 'volume'
  | 'crop'
  | 'reframe'
  | 'rotate'
  | 'replace'
  | 'duplicate'
  | 'delete'
  | 'style'
  | 'font'
  | 'color'
  | 'animation'
  | 'duration'
  | 'opacity'
  | 'fade'
  | 'transition';

export interface EditorTool {
  id: EditorToolId;
  label: string;
  destructive?: boolean;
  /** Capability registry id when the tool maps to a graph-backed feature. */
  capabilityId?: string;
}

const tool = (
  id: EditorToolId,
  label: string,
  options: { destructive?: boolean; capabilityId?: string } = {},
): EditorTool => ({
  id,
  label,
  destructive: options.destructive,
  capabilityId: options.capabilityId,
});

/** Tools that must never appear without a complete capability record. */
export const CAPABILITY_GATED_TOOL_IDS = new Set<EditorToolId>([
  'effects',
  'filters',
  'adjust',
  'animation',
  'opacity',
  'fade',
  'transition',
  'crop',
  'reframe',
  'rotate',
  'speed',
  'volume',
  'split',
  'text',
  'captions',
  'overlay',
  'audio',
]);

export const TOOL_CAPABILITY_IDS: Partial<Record<EditorToolId, string>> = {
  split: 'split',
  speed: 'speed',
  volume: 'volume',
  crop: 'crop',
  reframe: 'reframe',
  rotate: 'rotate',
  opacity: 'opacity',
  fade: 'fade',
  text: 'text',
  captions: 'captions',
  overlay: 'overlay',
  audio: 'audio_mix',
  transition: 'dissolve',
  effects: 'blur',
  filters: 'color_matrix',
  adjust: 'brightness',
  animation: 'text',
};

const GLOBAL_EDITOR_TOOLS: EditorTool[] = [
  tool('edit', 'Edit'),
  tool('text', 'Text', { capabilityId: 'text' }),
  tool('captions', 'Captions', { capabilityId: 'captions' }),
  tool('audio', 'Audio', { capabilityId: 'audio_mix' }),
  tool('overlay', 'Overlay', { capabilityId: 'overlay' }),
  tool('effects', 'Effects', { capabilityId: 'blur' }),
  tool('filters', 'Filters', { capabilityId: 'color_matrix' }),
  tool('adjust', 'Adjust', { capabilityId: 'brightness' }),
  tool('add', 'Add'),
];

const CONTEXTUAL_TOOLS: Record<SelectionKind, EditorTool[]> = {
  video: [
    tool('split', 'Split', { capabilityId: 'split' }),
    tool('speed', 'Speed', { capabilityId: 'speed' }),
    tool('volume', 'Volume', { capabilityId: 'volume' }),
    tool('crop', 'Crop', { capabilityId: 'crop' }),
    tool('reframe', 'Reframe', { capabilityId: 'reframe' }),
    tool('rotate', 'Rotate', { capabilityId: 'rotate' }),
    tool('replace', 'Replace'),
    tool('duplicate', 'Duplicate'),
    tool('delete', 'Delete', { destructive: true }),
  ],
  text: [
    tool('edit', 'Edit'),
    tool('style', 'Style'),
    tool('font', 'Font'),
    tool('color', 'Color'),
    tool('animation', 'Animation', { capabilityId: 'text' }),
    tool('duration', 'Duration'),
    tool('duplicate', 'Duplicate'),
    tool('delete', 'Delete', { destructive: true }),
  ],
  caption: [
    tool('edit', 'Edit'),
    tool('style', 'Style'),
    tool('font', 'Font'),
    tool('color', 'Color'),
    tool('animation', 'Animation', { capabilityId: 'captions' }),
    tool('duration', 'Timing'),
  ],
  overlay: [
    tool('replace', 'Replace'),
    tool('crop', 'Crop', { capabilityId: 'crop' }),
    tool('reframe', 'Reframe', { capabilityId: 'reframe' }),
    tool('opacity', 'Opacity', { capabilityId: 'opacity' }),
    tool('animation', 'Animation', { capabilityId: 'glitch' }),
    tool('speed', 'Speed', { capabilityId: 'speed' }),
    tool('volume', 'Volume', { capabilityId: 'volume' }),
    tool('duplicate', 'Duplicate'),
    tool('delete', 'Delete', { destructive: true }),
  ],
  audio: [
    tool('volume', 'Volume', { capabilityId: 'volume' }),
    tool('fade', 'Fade', { capabilityId: 'fade' }),
    tool('split', 'Split', { capabilityId: 'split' }),
    tool('speed', 'Speed', { capabilityId: 'speed' }),
    tool('duplicate', 'Duplicate'),
    tool('delete', 'Delete', { destructive: true }),
  ],
  transition: [
    tool('transition', 'Transition', { capabilityId: 'dissolve' }),
    tool('duration', 'Duration'),
    tool('delete', 'Remove', { destructive: true }),
  ],
};

export function toolsForSelection(
  selection: SelectionKind | null,
  visibleCapabilityIds?: ReadonlySet<string> | string[],
): EditorTool[] {
  const tools = selection ? CONTEXTUAL_TOOLS[selection] : GLOBAL_EDITOR_TOOLS;
  if (!visibleCapabilityIds) return tools;
  const visible =
    visibleCapabilityIds instanceof Set
      ? visibleCapabilityIds
      : new Set(visibleCapabilityIds);
  return tools.filter((entry) => {
    const capabilityId = entry.capabilityId ?? TOOL_CAPABILITY_IDS[entry.id];
    if (!capabilityId) return true;
    return visible.has(capabilityId);
  });
}

/** Fail closed: a gated tool without complete platform coverage is hidden. */
export interface CapabilitySpecLike {
  id: string;
  hasGraphNode: boolean;
  hasAndroidRenderer: boolean;
  hasIosRenderer: boolean;
  hasExport: boolean;
  hasValidation: boolean;
  hasGoldenFixture: boolean;
}

export function isCapabilityFullySupported(spec: CapabilitySpecLike): boolean {
  return (
    spec.hasGraphNode &&
    spec.hasAndroidRenderer &&
    spec.hasIosRenderer &&
    spec.hasExport &&
    spec.hasValidation &&
    spec.hasGoldenFixture
  );
}

export function assertCapabilityInvariants(capabilities: CapabilitySpecLike[]): string[] {
  const failures: string[] = [];
  for (const spec of capabilities) {
    const flags = [
      spec.hasGraphNode,
      spec.hasAndroidRenderer,
      spec.hasIosRenderer,
      spec.hasExport,
      spec.hasValidation,
      spec.hasGoldenFixture,
    ];
    const any = flags.some(Boolean);
    const all = flags.every(Boolean);
    if (any && !all) {
      failures.push(
        `Capability "${spec.id}" is partially registered and must not be user-visible`,
      );
    }
    if (isCapabilityFullySupported(spec) !== all) {
      failures.push(`Capability "${spec.id}" visibility mismatch`);
    }
  }
  return failures;
}

import {
  EDITOR_MAX_TICKS,
  MOBILE_EDIT_SCHEMA_VERSION,
  type EditorTick,
  type EditorTrack,
  type MobileEditProjectV3,
  type RatioAwareTransform,
  type TimedItem,
  type Transform,
} from './schema';

export interface DocumentValidation {
  valid: boolean;
  errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateTick(value: unknown, path: string, errors: string[]): value is EditorTick {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    errors.push(`${path} must be a non-negative integer tick`);
    return false;
  }
  return true;
}

function validateTransform(value: unknown, path: string, errors: string[]): value is Transform {
  if (!isObject(value)) {
    errors.push(`${path} must be a transform`);
    return false;
  }
  for (const field of ['positionX', 'positionY', 'scaleX', 'scaleY', 'rotationDeg', 'anchorX', 'anchorY']) {
    if (!isFiniteNumber(value[field])) errors.push(`${path}.${field} must be finite`);
  }
  if (value.fit !== 'contain' && value.fit !== 'cover' && value.fit !== 'fill') {
    errors.push(`${path}.fit is invalid`);
  }
  if (isFiniteNumber(value.scaleX) && value.scaleX <= 0) errors.push(`${path}.scaleX must be positive`);
  if (isFiniteNumber(value.scaleY) && value.scaleY <= 0) errors.push(`${path}.scaleY must be positive`);
  return errors.length === 0;
}

function validateRatioTransform(
  value: unknown,
  path: string,
  errors: string[],
): value is RatioAwareTransform {
  if (!isObject(value)) {
    errors.push(`${path} must be ratio-aware`);
    return false;
  }
  validateTransform(value.base, `${path}.base`, errors);
  if (value.overrides != null) {
    if (!isObject(value.overrides)) {
      errors.push(`${path}.overrides must be an object`);
    } else {
      for (const ratio of ['9:16', '16:9'] as const) {
        if (value.overrides[ratio] != null) {
          validateTransform(value.overrides[ratio], `${path}.overrides.${ratio}`, errors);
        }
      }
    }
  }
  return errors.length === 0;
}

function validateTimedItem(item: TimedItem, path: string, errors: string[]): void {
  if (!item.id) errors.push(`${path}.id is required`);
  const hasStart = validateTick(item.timelineStart, `${path}.timelineStart`, errors);
  const hasEnd = validateTick(item.timelineEnd, `${path}.timelineEnd`, errors);
  if (hasStart && hasEnd && item.timelineEnd <= item.timelineStart) {
    errors.push(`${path}.timelineEnd must be after timelineStart`);
  }
  if (hasEnd && item.timelineEnd > EDITOR_MAX_TICKS) {
    errors.push(`${path}.timelineEnd exceeds the ${EDITOR_MAX_TICKS} tick policy`);
  }
}

function validateTrack(
  track: EditorTrack,
  index: number,
  assets: MobileEditProjectV3['assets'],
  ids: Set<string>,
  errors: string[],
): void {
  const path = `tracks[${index}]`;
  if (!track.id) errors.push(`${path}.id is required`);
  if (ids.has(track.id)) errors.push(`${path}.id is duplicated`);
  ids.add(track.id);
  if (!Array.isArray(track.items)) {
    errors.push(`${path}.items must be an array`);
    return;
  }

  track.items.forEach((item, itemIndex) => {
    const itemPath = `${path}.items[${itemIndex}]`;
    validateTimedItem(item, itemPath, errors);
    if (item.kind !== track.kind) errors.push(`${itemPath}.kind must match its track`);
    if (ids.has(item.id)) errors.push(`${itemPath}.id is duplicated`);
    ids.add(item.id);
    if ('assetId' in item && !assets[item.assetId]) {
      errors.push(`${itemPath}.assetId does not reference an asset`);
    }
    if ('sourceStart' in item) {
      const hasStart = validateTick(item.sourceStart, `${itemPath}.sourceStart`, errors);
      const hasEnd = validateTick(item.sourceEnd, `${itemPath}.sourceEnd`, errors);
      if (hasStart && hasEnd && item.sourceEnd <= item.sourceStart) {
        errors.push(`${itemPath}.sourceEnd must be after sourceStart`);
      }
    }
    if ('speed' in item && (!isFiniteNumber(item.speed) || item.speed <= 0)) {
      errors.push(`${itemPath}.speed must be positive`);
    }
    if ('volume' in item && (!isFiniteNumber(item.volume) || item.volume < 0 || item.volume > 1)) {
      errors.push(`${itemPath}.volume must be between 0 and 1`);
    }
    if ('transform' in item) validateRatioTransform(item.transform, `${itemPath}.transform`, errors);
    if (item.kind === 'overlay') {
      if (!isFiniteNumber(item.opacity) || item.opacity < 0 || item.opacity > 1) {
        errors.push(`${itemPath}.opacity must be between 0 and 1`);
      }
      for (const field of ['x', 'y', 'width', 'height'] as const) {
        if (!isFiniteNumber(item.crop[field]) || item.crop[field] < 0 || item.crop[field] > 1) {
          errors.push(`${itemPath}.crop.${field} must be between 0 and 1`);
        }
      }
    }
    if (item.kind === 'audio') {
      validateTick(item.fadeInTicks, `${itemPath}.fadeInTicks`, errors);
      validateTick(item.fadeOutTicks, `${itemPath}.fadeOutTicks`, errors);
      if (item.fadeInTicks + item.fadeOutTicks > item.timelineEnd - item.timelineStart) {
        errors.push(`${itemPath} fades exceed item duration`);
      }
    }
  });

  if (track.kind === 'video') {
    const videoIds = new Set(track.items.map((item) => item.id));
    track.transitions.forEach((transition, transitionIndex) => {
      const transitionPath = `${path}.transitions[${transitionIndex}]`;
      if (!transition.id) errors.push(`${transitionPath}.id is required`);
      if (ids.has(transition.id)) errors.push(`${transitionPath}.id is duplicated`);
      ids.add(transition.id);
      if (!videoIds.has(transition.fromItemId) || !videoIds.has(transition.toItemId)) {
        errors.push(`${transitionPath} must reference items on its video track`);
      }
      const toIndex = track.items.findIndex((item) => item.id === transition.toItemId);
      if (toIndex <= 0 || track.items[toIndex - 1]?.id !== transition.fromItemId) {
        errors.push(`${transitionPath} must connect adjacent video items`);
      }
      validateTick(transition.durationTicks, `${transitionPath}.durationTicks`, errors);
      if (transition.transition === 'cut' && transition.durationTicks !== 0) {
        errors.push(`${transitionPath} cut duration must be zero`);
      }
    });
  }
}

export function validateMobileEditProject(raw: unknown): DocumentValidation {
  const errors: string[] = [];
  if (!isObject(raw)) return { valid: false, errors: ['document must be an object'] };
  if (raw.schemaVersion !== MOBILE_EDIT_SCHEMA_VERSION) errors.push('schemaVersion must be 3');
  if (typeof raw.id !== 'string' || !raw.id) errors.push('id is required');
  if (raw.kind !== 'project' && raw.kind !== 'clip') errors.push('kind is invalid');
  if (typeof raw.targetId !== 'string' || !raw.targetId) errors.push('targetId is required');
  if (!Number.isFinite(raw.createdAt) || !Number.isFinite(raw.updatedAt)) {
    errors.push('createdAt and updatedAt must be finite timestamps');
  }

  if (!isObject(raw.canvas)) {
    errors.push('canvas is required');
  } else {
    if (raw.canvas.activeRatio !== '9:16' && raw.canvas.activeRatio !== '16:9') {
      errors.push('canvas.activeRatio is invalid');
    }
    const outputs = raw.canvas.outputByRatio;
    if (!isObject(outputs)) {
      errors.push('canvas.outputByRatio is required');
    } else {
      const portrait = outputs['9:16'];
      const landscape = outputs['16:9'];
      if (!isObject(portrait) || portrait.width !== 1080 || portrait.height !== 1920) {
        errors.push('9:16 output must be 1080x1920');
      }
      if (!isObject(landscape) || landscape.width !== 1920 || landscape.height !== 1080) {
        errors.push('16:9 output must be 1920x1080');
      }
      for (const [ratio, output] of Object.entries(outputs)) {
        if (!isObject(output) || (output.fps !== 30 && output.fps !== 60)) {
          errors.push(`${ratio} output fps must be 30 or 60`);
        }
      }
    }
  }

  const hasAssets = isObject(raw.assets);
  const hasTracks = Array.isArray(raw.tracks);
  if (!hasAssets) errors.push('assets must be an object');
  if (!hasTracks) errors.push('tracks must be an array');
  if (!hasAssets || !hasTracks) return { valid: false, errors };

  const document = raw as unknown as MobileEditProjectV3;
  const assetIds = new Set(Object.keys(document.assets));
  for (const [key, asset] of Object.entries(document.assets)) {
    if (asset.id !== key) errors.push(`assets.${key}.id must match its key`);
    if (!asset.sourceUri) errors.push(`assets.${key}.sourceUri is required`);
    if (!asset.sourceFingerprint) errors.push(`assets.${key}.sourceFingerprint is required`);
    validateTick(asset.durationTicks, `assets.${key}.durationTicks`, errors);
  }

  const ids = new Set<string>([document.id, ...assetIds]);
  document.tracks.forEach((track, index) => validateTrack(track, index, document.assets, ids, errors));
  if (document.captionDocument) {
    const captions = document.captionDocument;
    if (ids.has(captions.id)) errors.push('captionDocument.id is duplicated');
    ids.add(captions.id);
    validateRatioTransform(captions.transform, 'captionDocument.transform', errors);
    const wordIds = new Set<string>();
    captions.words.forEach((word, index) => {
      const path = `captionDocument.words[${index}]`;
      if (!word.id || ids.has(word.id)) errors.push(`${path}.id is duplicated or missing`);
      ids.add(word.id);
      wordIds.add(word.id);
      if (!word.word.trim()) errors.push(`${path}.word is required`);
      const hasStart = validateTick(word.start, `${path}.start`, errors);
      const hasEnd = validateTick(word.end, `${path}.end`, errors);
      if (hasStart && hasEnd && word.end <= word.start) errors.push(`${path}.end must be after start`);
    });
    captions.phrases.forEach((phrase, index) => {
      const path = `captionDocument.phrases[${index}]`;
      if (!phrase.id || ids.has(phrase.id)) errors.push(`${path}.id is duplicated or missing`);
      ids.add(phrase.id);
      if (phrase.wordIds.length === 0) errors.push(`${path}.wordIds cannot be empty`);
      if (phrase.wordIds.some((wordId) => !wordIds.has(wordId))) {
        errors.push(`${path}.wordIds contain a missing word`);
      }
      const hasStart = validateTick(phrase.start, `${path}.start`, errors);
      const hasEnd = validateTick(phrase.end, `${path}.end`, errors);
      if (hasStart && hasEnd && phrase.end <= phrase.start) {
        errors.push(`${path}.end must be after start`);
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

export function parseMobileEditProject(raw: unknown): MobileEditProjectV3 {
  const result = validateMobileEditProject(raw);
  if (!result.valid) throw new Error(`Invalid mobile edit project: ${result.errors.join('; ')}`);
  return raw as MobileEditProjectV3;
}

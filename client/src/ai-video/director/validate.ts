import {
  OVERLAY_LANES,
  SHOT_MOVES,
  SHOT_TRANSITIONS,
  type EditDocument,
  type EditFormat,
  type EditOverlay,
  type EditShot,
  type MediaItem,
  type ShotAlternate,
  type VariableValue,
} from '../types';

export const ALLOWED_FPS = [24, 25, 30, 50, 60] as const;
export const COMPOSITION_PATH = /^compositions\/[A-Za-z0-9_-]{1,64}\.html$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const MIN_SECONDS = 0.1;
const SOURCE_TOLERANCE = 0.05;
const MAX_ALTERNATES = 3;

export interface ValidationContext {
  media: MediaItem[];
  maxSeconds: number;
  /** Example shot count, for `refShot` bounds. */
  exampleShots: number;
  /** Composition files present in the workspace. */
  files: Iterable<string>;
  /** Missing composition files are errors (finishing) rather than warnings (mid-run). */
  requireFiles: boolean;
}

export interface ValidationResult {
  document: EditDocument;
  errors: string[];
  warnings: string[];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function documentDuration(document: Pick<EditDocument, 'shots'>): number {
  return round3(document.shots.reduce((sum, shot) => sum + shot.duration, 0));
}

/** Source seconds a shot consumes. Photos have no source time. */
export function sourceSpan(shot: Pick<EditShot, 'duration' | 'speed'>, media: MediaItem | undefined): number {
  return media?.kind === 'photo' ? 0 : shot.duration * shot.speed;
}

export function fitsSource(media: MediaItem | undefined, sourceIn: number, span: number): boolean {
  if (!media || media.kind === 'audio') return false;
  if (media.kind === 'photo') return true;
  return sourceIn >= 0 && sourceIn + span <= media.duration + SOURCE_TOLERANCE;
}

/**
 * Validate and normalise an edit document from the agent or the timeline. Times are snapped to the
 * frame grid, defaults filled in and text labels synced to their `text` variable.
 */
export function validateDocument(input: unknown, context: ValidationContext): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const raw = isObject(input) ? input : {};
  if (!isObject(input)) errors.push('The document must be an object.');

  const format = validateFormat(raw.format, errors);
  const snap = (seconds: number) => Math.round(seconds * format.fps) / format.fps;
  const media = new Map(context.media.map((item) => [item.id, item]));
  const ids = new Set<string>();

  const claimId = (id: unknown, where: string): string => {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
      errors.push(`${where}: id must be 1-40 letters, digits, - or _.`);
      return String(id ?? '');
    }
    if (ids.has(id)) errors.push(`${where}: id "${id}" is used more than once.`);
    ids.add(id);
    return id;
  };

  const rawShots = Array.isArray(raw.shots) ? raw.shots : [];
  if (rawShots.length === 0) errors.push('The document needs at least one shot.');

  const shots: EditShot[] = rawShots.map((value, index) => {
    const shot = isObject(value) ? value : {};
    const where = `shots[${index}]`;
    const id = claimId(shot.id, where);
    const label = `${where} (${id})`;
    const item = typeof shot.mediaId === 'string' ? media.get(shot.mediaId) : undefined;
    if (!item || item.kind === 'audio') errors.push(`${label}: mediaId must be one of the user's videos or photos.`);

    const isPhoto = item?.kind === 'photo';
    const speed = isPhoto ? 1 : isNumber(shot.speed) ? shot.speed : 1;
    if (speed < 0.25 || speed > 4) errors.push(`${label}: speed must be between 0.25 and 4.`);
    const duration = isNumber(shot.duration) ? snap(shot.duration) : 0;
    if (duration < MIN_SECONDS) errors.push(`${label}: duration must be at least ${MIN_SECONDS} s.`);
    const sourceIn = isPhoto ? 0 : isNumber(shot.sourceIn) ? round3(shot.sourceIn) : -1;
    if (item && !isPhoto && !fitsSource(item, sourceIn, duration * speed)) {
      errors.push(
        `${label}: needs ${round3(duration * speed)} s of source from ${sourceIn} s, but ${item.name} is ${round3(item.duration)} s long.`
      );
    }

    const move = SHOT_MOVES.includes(shot.move as never) ? (shot.move as EditShot['move']) : 'none';
    if (shot.move !== undefined && move !== shot.move) errors.push(`${label}: move must be one of ${SHOT_MOVES.join(', ')}.`);
    let transitionIn = SHOT_TRANSITIONS.includes(shot.transitionIn as never) ? (shot.transitionIn as EditShot['transitionIn']) : 'cut';
    if (shot.transitionIn !== undefined && transitionIn !== shot.transitionIn) {
      errors.push(`${label}: transitionIn must be one of ${SHOT_TRANSITIONS.join(', ')}.`);
    }
    if (index === 0) transitionIn = 'cut';

    let refShot: number | null = null;
    if (isNumber(shot.refShot)) {
      if (Number.isInteger(shot.refShot) && shot.refShot >= 0 && shot.refShot < context.exampleShots) refShot = shot.refShot;
      else errors.push(`${label}: refShot must be an example shot index from 0 to ${context.exampleShots - 1}, or null.`);
    }

    const alternates = validateAlternates(shot.alternates, duration, speed, media, label, warnings);

    return {
      id,
      mediaId: typeof shot.mediaId === 'string' ? shot.mediaId : '',
      sourceIn: Math.max(0, sourceIn),
      duration,
      speed,
      move,
      transitionIn,
      refShot,
      description: typeof shot.description === 'string' ? shot.description.slice(0, 200) : '',
      alternates,
    };
  });

  const total = documentDuration({ shots });
  if (total > context.maxSeconds + 0.5 / format.fps) {
    errors.push(`The video is ${total} s long; the limit is ${context.maxSeconds} s.`);
  }

  const music = validateMusic(raw.music, media, total, errors, warnings);
  const clipAudio = isNumber(raw.clipAudio) ? clamp(raw.clipAudio, 0, 1) : music ? 0 : 1;
  const files = new Set(context.files);
  const overlays = (Array.isArray(raw.overlays) ? raw.overlays : []).map((value, index) =>
    validateOverlay(value, index, { claimId, snap, epsilon: 0.5 / format.fps, total, files, requireFiles: context.requireFiles, errors, warnings })
  );
  checkLaneOverlaps(overlays, format.fps, errors);

  return {
    document: {
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 120) : 'Untitled video',
      format,
      music,
      clipAudio,
      shots,
      overlays,
    },
    errors,
    warnings,
  };
}

function validateFormat(value: unknown, errors: string[]): EditFormat {
  const format = isObject(value) ? value : {};
  const width = isNumber(format.width) ? Math.round(format.width) : 0;
  const height = isNumber(format.height) ? Math.round(format.height) : 0;
  const fps = isNumber(format.fps) ? Math.round(format.fps) : 0;
  const sizeOk = (size: number) => size >= 240 && size <= 3840 && size % 2 === 0;
  if (!sizeOk(width) || !sizeOk(height)) errors.push('format.width and format.height must be even numbers from 240 to 3840.');
  if (!ALLOWED_FPS.includes(fps as never)) errors.push(`format.fps must be one of ${ALLOWED_FPS.join(', ')}.`);
  return { width: sizeOk(width) ? width : 1920, height: sizeOk(height) ? height : 1080, fps: ALLOWED_FPS.includes(fps as never) ? fps : 30 };
}

function validateAlternates(
  value: unknown,
  duration: number,
  speed: number,
  media: Map<string, MediaItem>,
  label: string,
  warnings: string[]
): ShotAlternate[] {
  if (!Array.isArray(value)) return [];
  const alternates: ShotAlternate[] = [];
  for (const entry of value) {
    if (!isObject(entry) || typeof entry.mediaId !== 'string') continue;
    const item = media.get(entry.mediaId);
    const sourceIn = item?.kind === 'photo' ? 0 : isNumber(entry.sourceIn) ? round3(entry.sourceIn) : -1;
    if (!fitsSource(item, sourceIn, item?.kind === 'photo' ? 0 : duration * speed)) {
      warnings.push(`${label}: dropped an alternate that doesn't fit the shot's length.`);
      continue;
    }
    if (alternates.length < MAX_ALTERNATES) {
      alternates.push({ mediaId: entry.mediaId, sourceIn, description: typeof entry.description === 'string' ? entry.description.slice(0, 200) : '' });
    }
  }
  return alternates;
}

function validateMusic(
  value: unknown,
  media: Map<string, MediaItem>,
  total: number,
  errors: string[],
  warnings: string[]
): EditDocument['music'] {
  if (value === null || value === undefined) return null;
  if (!isObject(value)) {
    errors.push('music must be an object or null.');
    return null;
  }
  const item = typeof value.mediaId === 'string' ? media.get(value.mediaId) : undefined;
  if (!item || item.kind !== 'audio') {
    errors.push("music.mediaId must be one of the user's songs.");
    return null;
  }
  const start = isNumber(value.start) ? round3(value.start) : 0;
  if (start < 0 || start >= item.duration) errors.push(`music.start must be within the song (0-${round3(item.duration)} s).`);
  if (start + total > item.duration + SOURCE_TOLERANCE) {
    warnings.push(`The song ends at ${round3(item.duration - start)} s, before the video does.`);
  }
  return { mediaId: item.id, start: Math.max(0, start), volume: isNumber(value.volume) ? clamp(value.volume, 0, 1) : 1 };
}

interface OverlayContext {
  claimId: (id: unknown, where: string) => string;
  snap: (seconds: number) => number;
  /** Half a frame. */
  epsilon: number;
  total: number;
  files: Set<string>;
  requireFiles: boolean;
  errors: string[];
  warnings: string[];
}

function validateOverlay(value: unknown, index: number, context: OverlayContext): EditOverlay {
  const { errors, warnings } = context;
  const overlay = isObject(value) ? value : {};
  const where = `overlays[${index}]`;
  const id = context.claimId(overlay.id, where);
  const label = `${where} (${id})`;

  const lane = OVERLAY_LANES.includes(overlay.lane as never) ? (overlay.lane as EditOverlay['lane']) : 'graphics';
  if (lane !== overlay.lane) errors.push(`${label}: lane must be graphics or text.`);

  const start = isNumber(overlay.start) ? context.snap(overlay.start) : -1;
  let duration = isNumber(overlay.duration) ? context.snap(overlay.duration) : 0;
  if (start < 0) errors.push(`${label}: start must be 0 or later.`);
  if (duration < MIN_SECONDS) errors.push(`${label}: duration must be at least ${MIN_SECONDS} s.`);
  const overrun = start + duration - context.total;
  if (overrun > context.epsilon) errors.push(`${label}: ends at ${round3(start + duration)} s, after the video ends at ${context.total} s.`);
  else if (overrun > 0) duration = round3(context.total - start);

  const composition = typeof overlay.composition === 'string' ? overlay.composition : '';
  if (!COMPOSITION_PATH.test(composition)) {
    errors.push(`${label}: composition must be compositions/<name>.html.`);
  } else if (!context.files.has(composition)) {
    if (context.requireFiles) errors.push(`${label}: ${composition} doesn't exist.`);
    else warnings.push(`${label}: ${composition} hasn't been written yet.`);
  }

  const variables: Record<string, VariableValue> = {};
  if (isObject(overlay.variables)) {
    for (const [key, entry] of Object.entries(overlay.variables)) {
      if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') variables[key] = entry;
      else errors.push(`${label}: variable "${key}" must be a string, number or boolean.`);
    }
  }

  let overlayLabel = typeof overlay.label === 'string' ? overlay.label.trim().slice(0, 120) : '';
  if (lane === 'text') {
    if (typeof variables.text !== 'string' || !variables.text.trim()) errors.push(`${label}: text overlays need a non-empty "text" variable.`);
    else overlayLabel = variables.text;
  }
  if (!overlayLabel) warnings.push(`${label}: add a short label for the timeline.`);

  return { id, lane, start: Math.max(0, start), duration, label: overlayLabel, composition, variables };
}

function checkLaneOverlaps(overlays: EditOverlay[], fps: number, errors: string[]) {
  const epsilon = 0.5 / fps;
  for (const lane of OVERLAY_LANES) {
    const sorted = overlays.filter((overlay) => overlay.lane === lane).sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1];
      if (sorted[i].start < previous.start + previous.duration - epsilon) {
        errors.push(`Overlays ${previous.id} and ${sorted[i].id} overlap on the ${lane} lane.`);
      }
    }
  }
}

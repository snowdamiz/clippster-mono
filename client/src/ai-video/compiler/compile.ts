import { MEDIA_REF } from '../director/validate';
import type { EditDocument, EditShot, MediaKind, VariableValue } from '../types';

/** Linked media as the compiled project sees it. */
export interface CompileMedia {
  /** Project-relative `src` from `linkMedia`. */
  src: string;
  kind: MediaKind;
  duration: number;
  hasAudio: boolean;
}

export interface CompileContext {
  media: Record<string, CompileMedia>;
  /** Project-relative font files, `assets/fonts/Family_Sub-Style.ttf`. */
  fonts: string[];
  gsapSrc: string;
}

export interface PlacedShot {
  id: string;
  start: number;
  end: number;
}

const DISSOLVE_SECONDS = 0.4;
const DIP_HALF_SECONDS = 0.25;
const FLASH_SECONDS = 0.2;
const MUSIC_FADE_SECONDS = 1.5;
const SHAKE_OFFSETS: Array<[number, number]> = [
  [14, -9],
  [-11, 7],
  [9, 12],
  [-13, -6],
  [7, -11],
  [-6, 9],
  [4, -4],
  [0, 0],
];
const FONT_WEIGHTS: Record<string, number> = {
  Thin: 100,
  ExtraLight: 200,
  Light: 300,
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  Bold: 700,
  ExtraBold: 800,
  Black: 900,
};

const num = (value: number) => String(Math.round(value * 1000) / 1000);

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function attributes(values: Attributes): string {
  return Object.entries(values)
    .filter(
      (entry): entry is [string, string | number | true] =>
        entry[1] !== null && entry[1] !== undefined && entry[1] !== false
    )
    .map(([key, value]) =>
      value === true
        ? key
        : `${key}="${escapeHtml(typeof value === 'number' ? num(value) : value)}"`
    )
    .join(' ');
}

/** `@font-face` for a bundled file named `BaseFamily_Variant-WeightItalic.ttf` ("BebasNeue", "Roboto_SemiCondensed"). */
export function fontFace(path: string): string | null {
  const match = /([^/\\]+)-([A-Za-z]+)\.(ttf|otf|woff2?)$/.exec(path);
  if (!match) return null;
  const [base, ...variants] = match[1].split('_');
  const family = [base.replace(/([a-z])([A-Z])/g, '$1 $2'), ...variants].join(' ');
  const italic = match[2].endsWith('Italic');
  const weightName = match[2].replace(/Italic$/, '') || 'Regular';
  const weight = FONT_WEIGHTS[weightName];
  if (!weight) return null;
  const format = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' }[match[3]];
  return `@font-face { font-family: "${family}"; src: url("${path}") format("${format}"); font-weight: ${weight}; font-style: ${italic ? 'italic' : 'normal'}; }`;
}

export function placeShots(document: Pick<EditDocument, 'shots'>): PlacedShot[] {
  let cursor = 0;
  return document.shots.map((shot) => {
    const start = cursor;
    cursor = Math.round((cursor + shot.duration) * 1000) / 1000;
    return { id: shot.id, start, end: cursor };
  });
}

export function compositionId(path: string): string {
  return path.replace(/^compositions\//, '').replace(/\.html$/, '');
}

/** Seconds the incoming shot can fade in over the previous one, limited by both shots and its source pre-roll. */
function dissolveOverlap(
  previous: EditShot,
  shot: EditShot,
  media: CompileMedia | undefined,
  fps: number
): number {
  const preRoll =
    shot.scene || media?.kind === 'photo' ? Number.POSITIVE_INFINITY : shot.sourceIn / shot.speed;
  const overlap = Math.min(DISSOLVE_SECONDS, previous.duration / 2, shot.duration / 2, preRoll);
  const frames = Math.floor(overlap * fps);
  return frames >= 1 ? frames / fps : 0;
}

function moveTweens(
  target: string,
  move: EditShot['move'],
  start: number,
  duration: number
): string[] {
  const at = num(start);
  const span = num(Math.max(duration - 0.001, 0.001));
  switch (move) {
    case 'push-in':
      return [
        `tl.fromTo("${target}", { scale: 1 }, { scale: 1.12, duration: ${span}, ease: "none" }, ${at});`,
      ];
    case 'pull-out':
      return [
        `tl.fromTo("${target}", { scale: 1.12 }, { scale: 1, duration: ${span}, ease: "none" }, ${at});`,
      ];
    case 'pan-left':
      return [
        `tl.fromTo("${target}", { scale: 1.15, xPercent: 5 }, { scale: 1.15, xPercent: -5, duration: ${span}, ease: "none" }, ${at});`,
      ];
    case 'pan-right':
      return [
        `tl.fromTo("${target}", { scale: 1.15, xPercent: -5 }, { scale: 1.15, xPercent: 5, duration: ${span}, ease: "none" }, ${at});`,
      ];
    case 'punch':
      return [
        `tl.fromTo("${target}", { scale: 1.25 }, { scale: 1, duration: ${num(Math.min(0.3, duration))}, ease: "power3.out" }, ${at});`,
      ];
    case 'shake': {
      const step = Math.min(0.06, duration / SHAKE_OFFSETS.length);
      return [
        `tl.set("${target}", { scale: 1.06 }, ${at});`,
        ...SHAKE_OFFSETS.map(
          ([x, y], i) =>
            `tl.to("${target}", { x: ${x}, y: ${y}, duration: ${num(step)}, ease: "none" }, ${num(start + i * step)});`
        ),
      ];
    }
    default:
      return [];
  }
}

type Attributes = Record<string, string | number | boolean | null | undefined>;

/** Attributes that mount a composition, with `media:<id>` variables resolved to the linked file. */
function placementAttributes(
  composition: string,
  variables: Record<string, VariableValue>,
  timing: Attributes,
  format: EditDocument['format'],
  context: CompileContext
): Attributes {
  const resolved = Object.fromEntries(
    Object.entries(variables).map(([key, value]) => {
      const ref = typeof value === 'string' ? MEDIA_REF.exec(value) : null;
      return [key, ref ? (context.media[ref[1]]?.src ?? '') : value];
    })
  );
  return {
    'data-composition-id': compositionId(composition),
    'data-composition-src': composition,
    ...timing,
    'data-width': format.width,
    'data-height': format.height,
    'data-variable-values': Object.keys(resolved).length ? JSON.stringify(resolved) : null,
  };
}

/** Compile an edit document into the project's root `index.html`. */
export function compileDocument(document: EditDocument, context: CompileContext): string {
  const { width, height, fps } = document.format;
  const placed = placeShots(document);
  const total = placed.length ? placed[placed.length - 1].end : 0;
  const elements: string[] = [];
  const tweens: string[] = [
    'tl.set("#fx-flash", { opacity: 0 }, 0);',
    'tl.set("#fx-dip", { opacity: 0 }, 0);',
  ];

  document.shots.forEach((shot, index) => {
    const media = shot.mediaId ? context.media[shot.mediaId] : undefined;
    const { start } = placed[index];
    const frame = `#shot-${shot.id}-frame`;
    const previous = index > 0 ? document.shots[index - 1] : null;
    const overlap =
      previous && shot.transitionIn === 'dissolve'
        ? dissolveOverlap(previous, shot, media, fps)
        : 0;
    const clipStart = start - overlap;
    const clipDuration = shot.duration + overlap;
    const identity = {
      id: `shot-${shot.id}`,
      class: 'clip',
      'data-slot-id': shot.id,
      'data-ref-shot-id': shot.refShot,
    };
    const timing = {
      'data-start': clipStart,
      'data-duration': clipDuration,
      'data-track-index': 0,
    };
    const source = { ...identity, ...timing, src: media?.src ?? '' };
    const clip = shot.scene
      ? `<div ${attributes({ ...identity, ...placementAttributes(shot.scene.composition, { ...shot.scene.variables, __editorOwner: shot.id, __editorDuration: shot.duration }, timing, document.format, context) })}></div>`
      : media?.kind === 'photo'
        ? `<img ${attributes({ ...source, alt: '' })} />`
        : `<video ${attributes({
            ...source,
            'data-media-start': Math.max(0, shot.sourceIn - overlap * shot.speed),
            'data-playback-rate': shot.speed !== 1 ? shot.speed : null,
            ...(document.clipAudio > 0 && media?.hasAudio
              ? { 'data-has-audio': 'true', 'data-volume': document.clipAudio }
              : { muted: true }),
            playsinline: true,
          })}></video>`;
    elements.push(`<div id="shot-${shot.id}-frame" class="frame">${clip}</div>`);

    if (overlap > 0) {
      tweens.push(
        `tl.fromTo("${frame}", { opacity: 0 }, { opacity: 1, duration: ${num(overlap)}, ease: "none" }, ${num(clipStart)});`
      );
    }
    if (previous && shot.transitionIn === 'flash') {
      const span = Math.min(FLASH_SECONDS, shot.duration * 0.8);
      tweens.push(`tl.set("#fx-flash", { opacity: 1 }, ${num(start)});`);
      tweens.push(
        `tl.to("#fx-flash", { opacity: 0, duration: ${num(span)}, ease: "power2.out" }, ${num(start)});`
      );
    }
    if (previous && shot.transitionIn === 'dip') {
      const half = Math.min(DIP_HALF_SECONDS, previous.duration / 2, shot.duration / 2);
      tweens.push(
        `tl.to("#fx-dip", { opacity: 1, duration: ${num(half)}, ease: "power1.in" }, ${num(start - half)});`
      );
      tweens.push(
        `tl.to("#fx-dip", { opacity: 0, duration: ${num(half)}, ease: "power1.out" }, ${num(start)});`
      );
    }
    tweens.push(...moveTweens(frame, shot.move, start, shot.duration));
  });

  const sortedOverlays = [...document.overlays].sort(
    (a, b) => a.start - b.start || a.id.localeCompare(b.id)
  );
  const overlays = sortedOverlays.map(
    (overlay) =>
      `<div ${attributes({
        id: `ov-${overlay.id}`,
        class: `overlay overlay-${overlay.lane}`,
        ...placementAttributes(
          overlay.composition,
          { ...overlay.variables, __editorOwner: overlay.id, __editorDuration: overlay.duration },
          {
            'data-start': overlay.start,
            'data-duration': overlay.duration,
            'data-track-index': overlay.lane === 'graphics' ? 2 : 3,
          },
          document.format,
          context
        ),
      })}></div>`
  );

  let music = '';
  const song = document.music ? context.media[document.music.mediaId] : undefined;
  if (document.music && song) {
    const length = Math.min(total, Math.max(0, song.duration - document.music.start));
    const fade = Math.min(MUSIC_FADE_SECONDS, length / 2);
    const volume = document.music.volume;
    const lane = {
      version: 1,
      lanes: [
        {
          target: 'volume',
          points: [
            { t: 0, v: volume },
            { t: Number(num(length - fade)), v: volume },
            { t: Number(num(length)), v: 0 },
          ],
        },
      ],
    };
    music = `<audio ${attributes({
      id: 'music',
      'data-timeline-role': 'music',
      'data-start': 0,
      'data-duration': length,
      'data-media-start': document.music.start,
      'data-track-index': 10,
      'data-volume': 1,
      'data-automation': JSON.stringify(lane),
      src: song.src,
    })}></audio>`;
  }

  const fontFaces = context.fonts.map(fontFace).filter((rule): rule is string => !!rule);
  const indent = (lines: string[], spaces: number) =>
    lines.map((line) => ' '.repeat(spaces) + line).join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${escapeHtml(document.title)}</title>
    <script src="${escapeHtml(context.gsapSrc)}"></script>
    <style>
${indent(fontFaces, 6)}
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: #000; }
      .frame { position: absolute; inset: 0; z-index: 1; }
      .frame > .clip { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; }
      .fx { position: absolute; inset: 0; z-index: 10; pointer-events: none; opacity: 0; }
      #fx-flash { background: #fff; }
      #fx-dip { background: #000; }
      .overlay { position: absolute; inset: 0; }
      .overlay-graphics { z-index: 20; }
      .overlay-text { z-index: 30; }
    </style>
  </head>
  <body>
    <div ${attributes({ id: 'root', 'data-composition-id': 'main', 'data-start': 0, 'data-duration': total, 'data-width': width, 'data-height': height, 'data-fps': fps })}>
${indent(elements, 6)}
      <div id="fx-dip" class="fx"></div>
      <div id="fx-flash" class="fx"></div>
${indent(overlays, 6)}${music ? `\n      ${music}` : ''}
    </div>
    <script>
      window.__timelines ??= {};
      const tl = gsap.timeline({ paused: true });
${indent(tweens, 6)}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import type { EditDocument } from '../types';
import { compileDocument, fontFace, placeShots, type CompileContext } from './compile';

const context: CompileContext = {
  gsapSrc: 'assets/vendor/gsap.min.js',
  fonts: ['assets/fonts/BebasNeue-Regular.ttf', 'assets/fonts/Roboto_Condensed-BoldItalic.ttf'],
  media: {
    m1: { src: 'assets/media/m1.mp4', kind: 'video', duration: 30, hasAudio: true },
    p1: { src: 'assets/media/p1.jpg', kind: 'photo', duration: 0, hasAudio: false },
    a1: { src: 'assets/media/a1.mp3', kind: 'audio', duration: 4, hasAudio: true },
  },
};

const shot = (
  id: string,
  overrides: Partial<EditDocument['shots'][number]> = {}
): EditDocument['shots'][number] => ({
  id,
  mediaId: 'm1',
  scene: null,
  sourceIn: 5,
  duration: 2,
  speed: 1,
  move: 'none',
  transitionIn: 'cut',
  refShot: 0,
  description: '',
  alternates: [],
  ...overrides,
});

const document: EditDocument = {
  title: 'Night <drive>',
  format: { width: 1920, height: 1080, fps: 30 },
  music: { mediaId: 'a1', start: 1, volume: 0.8 },
  clipAudio: 0,
  shots: [
    shot('s1', { move: 'push-in' }),
    shot('s2', { transitionIn: 'flash', speed: 2, sourceIn: 10 }),
    shot('s3', { mediaId: 'p1', transitionIn: 'dissolve', move: 'pan-left', refShot: null }),
    shot('s4', { transitionIn: 'dip', sourceIn: 0.1 }),
  ],
  overlays: [
    {
      id: 't1',
      lane: 'text',
      start: 0.5,
      duration: 2,
      label: "IT'S ON",
      composition: 'compositions/title.html',
      variables: { text: "IT'S ON" },
    },
    {
      id: 'g1',
      lane: 'graphics',
      start: 1.9,
      duration: 0.3,
      label: 'Flash',
      composition: 'compositions/flash.html',
      variables: {},
    },
  ],
};

describe('fontFace', () => {
  it('derives family, weight and style from the file name', () => {
    expect(fontFace('assets/fonts/Roboto_Condensed-BoldItalic.ttf')).toBe(
      '@font-face { font-family: "Roboto Condensed"; src: url("assets/fonts/Roboto_Condensed-BoldItalic.ttf") format("truetype"); font-weight: 700; font-style: italic; }'
    );
    expect(fontFace('assets/fonts/Montserrat-Italic.ttf')).toContain(
      'font-weight: 400; font-style: italic;'
    );
    expect(fontFace('assets/fonts/BebasNeue-Regular.ttf')).toContain('font-family: "Bebas Neue";');
    expect(fontFace('assets/fonts/Roboto_SemiCondensed-Thin.ttf')).toContain(
      'font-family: "Roboto SemiCondensed"; '
    );
    expect(fontFace('assets/fonts/README.md')).toBeNull();
  });
});

describe('compileDocument', () => {
  const html = compileDocument(document, context);

  it('registers the root animation before the preview runtime has initialized', () => {
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();
    const timeline = { set() {}, to() {}, fromTo() {} };
    const existing = { child: {} };
    for (const registry of [undefined, existing]) {
      const window = { __timelines: registry };
      runInNewContext(script!, { window, gsap: { timeline: () => timeline } });
      expect(window.__timelines).toHaveProperty('main', timeline);
      if (registry) expect(window.__timelines).toHaveProperty('child', existing.child);
    }
  });

  it('places shots back to back', () => {
    expect(placeShots(document).map((s) => [s.start, s.end])).toEqual([
      [0, 2],
      [2, 4],
      [4, 6],
      [6, 8],
    ]);
    expect(html).toContain(
      '<div id="root" data-composition-id="main" data-start="0" data-duration="8" data-width="1920" data-height="1080" data-fps="30">'
    );
  });

  it('emits footage with trims, rates and muted clip audio', () => {
    expect(html).toContain(
      '<video id="shot-s2" class="clip" data-slot-id="s2" data-ref-shot-id="0" data-start="2" data-duration="2" data-track-index="0" src="assets/media/m1.mp4" data-media-start="10" data-playback-rate="2" muted playsinline></video>'
    );
    expect(html).toContain(
      '<img id="shot-s3" class="clip" data-slot-id="s3" data-start="3.6" data-duration="2.4" data-track-index="0" src="assets/media/p1.jpg" alt="" />'
    );
  });

  it('compiles transitions and moves into the root timeline', () => {
    expect(html).toContain(
      'tl.fromTo("#shot-s1-frame", { scale: 1 }, { scale: 1.12, duration: 1.999, ease: "none" }, 0);'
    );
    expect(html).toContain('tl.set("#fx-flash", { opacity: 1 }, 2);');
    expect(html).toContain(
      'tl.fromTo("#shot-s3-frame", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none" }, 3.6);'
    );
    expect(html).toContain(
      'tl.to("#fx-dip", { opacity: 1, duration: 0.25, ease: "power1.in" }, 5.75);'
    );
  });

  it('limits a dissolve to the available source pre-roll', () => {
    const limited = compileDocument(
      { ...document, shots: [shot('a'), shot('b', { transitionIn: 'dissolve', sourceIn: 0.1 })] },
      context
    );
    expect(limited).toContain(
      'data-start="1.9" data-duration="2.1" data-track-index="0" src="assets/media/m1.mp4" data-media-start="0"'
    );
  });

  it('places overlays with escaped variables and fades the song where it runs out', () => {
    expect(html).toContain(
      '<div id="ov-t1" class="overlay overlay-text" data-composition-id="title" data-composition-src="compositions/title.html" data-start="0.5" data-duration="2" data-track-index="3" data-width="1920" data-height="1080" data-variable-values="{&quot;text&quot;:&quot;IT&#39;S ON&quot;,&quot;__editorOwner&quot;:&quot;t1&quot;,&quot;__editorDuration&quot;:2}"></div>'
    );
    expect(html).toContain(
      'id="ov-g1" class="overlay overlay-graphics" data-composition-id="flash"'
    );
    expect(html).toContain(
      'ov-g1" class="overlay overlay-graphics" data-composition-id="flash" data-composition-src="compositions/flash.html" data-start="1.9" data-duration="0.3" data-track-index="2" data-width="1920" data-height="1080" data-variable-values'
    );
    expect(html).toContain(
      'data-duration="3" data-media-start="1" data-track-index="10" data-volume="1"'
    );
    expect(html).toContain(
      '{&quot;t&quot;:1.5,&quot;v&quot;:0.8},{&quot;t&quot;:3,&quot;v&quot;:0}'
    );
    expect(html).toContain('<title>Night &lt;drive&gt;</title>');
    expect(html).toContain('font-family: "Bebas Neue"');
  });

  it('mounts a scene as a full-frame composition and resolves photo variables', () => {
    const scenes = compileDocument(
      {
        ...document,
        music: null,
        shots: [
          shot('intro', {
            mediaId: null,
            scene: {
              composition: 'compositions/card.html',
              label: 'Title card',
              variables: { text: 'HELLO', screen: 'media:p1' },
            },
            refShot: null,
          }),
          shot('s2', { transitionIn: 'dissolve', sourceIn: 10 }),
        ],
        overlays: [
          {
            id: 'g1',
            lane: 'graphics',
            start: 0,
            duration: 1,
            label: 'Shine',
            composition: 'compositions/shine.html',
            variables: { image: 'media:p1' },
          },
        ],
      },
      context
    );
    expect(scenes).toContain(
      '<div id="shot-intro-frame" class="frame"><div id="shot-intro" class="clip" data-slot-id="intro" data-composition-id="card" data-composition-src="compositions/card.html" data-start="0" data-duration="2" data-track-index="0" data-width="1920" data-height="1080" data-variable-values="{&quot;text&quot;:&quot;HELLO&quot;,&quot;screen&quot;:&quot;assets/media/p1.jpg&quot;,&quot;__editorOwner&quot;:&quot;intro&quot;,&quot;__editorDuration&quot;:2}"></div></div>'
    );
    expect(scenes).toContain(
      'data-variable-values="{&quot;image&quot;:&quot;assets/media/p1.jpg&quot;,&quot;__editorOwner&quot;:&quot;g1&quot;,&quot;__editorDuration&quot;:1}"'
    );
    expect(scenes).toContain(
      'tl.fromTo("#shot-s2-frame", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none" }, 1.6);'
    );
  });

  it('is deterministic', () => {
    expect(compileDocument(document, context)).toBe(html);
    expect(html).toMatchSnapshot();
  });
});

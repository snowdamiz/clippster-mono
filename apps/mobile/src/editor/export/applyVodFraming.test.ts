import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMobileEditProject } from '../model/createProject';
import { applyVodFramingForExport } from './applyVodFraming';

function documentFixture() {
  return createMobileEditProject({
    kind: 'clip',
    targetId: 'clip-1',
    projectId: 'project-1',
    source: {
      uri: 'file:///video.mp4',
      fingerprint: 'video-1',
      durationSeconds: 10,
      sourceKind: 'vod',
      width: 1920,
      height: 1080,
      hasAudio: true,
    },
    ranges: [{ startSeconds: 0, endSeconds: 10 }],
    now: 1,
    idFactory: (prefix) => prefix,
  });
}

describe('Use 16:9 VOD framing export', () => {
  it('adds a blurred cover background and sharp normalized plate for 9:16', () => {
    const document = documentFixture();
    const framed = applyVodFramingForExport(document, '9:16', {
      mode: 'manual',
      regions: [],
      targetAspectRatio: '9:16',
      sourceFrameMode: 'use16x9',
      blurEnabled: true,
      blurAmount: 15,
      sourceTransform: { scale: 0.8, x: 0.1, y: -0.05 },
    });

    const background = framed.tracks.find((track) => track.kind === 'video');
    const sharp = framed.tracks.find((track) => track.id.endsWith('__use169_sharp'));
    assert.equal(background?.kind, 'video');
    assert.equal(background?.items[0]?.transform.overrides?.['9:16']?.fit, 'cover');
    assert.deepEqual(background?.items[0]?.effectStack.at(-1), {
      type: 'blur',
      intensity: 50,
    });
    assert.equal(sharp?.kind, 'overlay');
    assert.equal(sharp?.items[0]?.transform.base.fit, 'contain');
    assert.equal(sharp?.items[0]?.transform.base.positionX, 0.6);
    assert.equal(sharp?.items[0]?.transform.base.positionY, 0.45);
    assert.equal(sharp?.items[0]?.transform.base.scaleX, 0.8);
  });

  it('does not change 16:9 exports or inactive framing modes', () => {
    const document = documentFixture();
    const framing = {
      mode: 'manual' as const,
      regions: [],
      targetAspectRatio: '9:16',
      sourceFrameMode: 'use16x9' as const,
    };
    assert.equal(applyVodFramingForExport(document, '16:9', framing), document);
    assert.equal(
      applyVodFramingForExport(document, '9:16', {
        ...framing,
        sourceFrameMode: 'none',
      }),
      document,
    );
  });
});

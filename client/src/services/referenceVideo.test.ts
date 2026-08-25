import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock, postMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  Channel: class<T> {
    onmessage: (message: T) => void = () => undefined;
  },
  invoke: invokeMock,
}));
vi.mock('./api', () => ({ default: { post: postMock } }));

import { analyzeReferenceVideo } from './referenceVideo';

const evidence = {
  metadata: {
    duration: 10,
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatio: '16:9',
    fileSizeBytes: 100,
    sourceType: 'url',
    displayName: 'video',
    sourceUrl: 'https://youtu.be/example',
  },
  frames: [{ timestamp: 0, kind: 'uniform', mimeType: 'image/jpeg', base64Data: 'eA==' }],
  cutTimestamps: [5],
  audioPeaks: [],
};

describe('reference video orchestration', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    postMock.mockReset();
  });

  it('passes desktop-extracted temporal evidence to the server', async () => {
    invokeMock.mockImplementation(async (command, args) => {
      if (command === 'prepare_reference_video') {
        args.onEvent.onmessage({ stage: 'sampling', progress: 60, message: 'Sampling' });
        return evidence;
      }
      return false;
    });
    postMock.mockResolvedValue({ data: { edit_recipe: { schemaVersion: 1, summary: 'Matched' } } });
    const progress = vi.fn();

    const recipe = await analyzeReferenceVideo(
      { kind: 'url', value: 'https://youtu.be/example' },
      progress
    );

    expect(invokeMock).toHaveBeenCalledWith(
      'prepare_reference_video',
      expect.objectContaining({ input: expect.objectContaining({ kind: 'url' }) })
    );
    expect(postMock).toHaveBeenCalledWith('/ai/reference/analyze', evidence, { signal: undefined });
    expect(recipe.summary).toBe('Matched');
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'sampling' }));
  });

  it('forwards cancellation to the desktop job', async () => {
    let rejectPreparation: (reason: unknown) => void = () => undefined;
    invokeMock.mockImplementation((command) => {
      if (command === 'prepare_reference_video') {
        return new Promise((_resolve, reject) => {
          rejectPreparation = reject;
        });
      }
      rejectPreparation(new DOMException('cancelled', 'AbortError'));
      return Promise.resolve(true);
    });
    const controller = new AbortController();
    const request = analyzeReferenceVideo(
      { kind: 'upload', value: '/tmp/reference.mp4' },
      vi.fn(),
      controller.signal
    );

    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(invokeMock).toHaveBeenCalledWith(
      'cancel_reference_analysis',
      expect.objectContaining({ jobId: expect.any(String) })
    );
    expect(postMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAIImageSession } from './useAIImageSession';
import * as imageApi from '@/services/aiImageApi';
import type { AIImageSession } from '@/services/aiImageApi';

vi.mock('@/services/aiImageApi', () => ({
  listImageSessions: vi.fn(),
  createImageSession: vi.fn(),
  getImageSession: vi.fn(),
  deleteImageSession: vi.fn(),
  renameImageSession: vi.fn(),
  sendImageMessage: vi.fn(),
  prepareImagePrompt: vi.fn(),
  generateImage: vi.fn(),
  prepareImageRevision: vi.fn(),
  reviseImage: vi.fn(),
  selectImageCandidate: vi.fn(),
}));

const readySession: AIImageSession = {
  id: 42,
  name: 'Launch visual',
  status: 'discovery',
  creator_mode: 'image',
  candidates: [],
  thumbnail_url: null,
  composition: null,
  brief_summary: null,
  canvas_width: 1024,
  canvas_height: 1024,
  messages: [
    {
      id: 1,
      role: 'assistant',
      content: 'Ready to create.',
      metadata: {
        ready_to_generate: true,
        expanded_prompt: 'An in-depth production prompt',
      },
      inserted_at: '2026-09-09T00:00:00Z',
    },
  ],
  inserted_at: '2026-09-09T00:00:00Z',
  updated_at: '2026-09-09T00:00:00Z',
};

describe('useAIImageSession generation phases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(imageApi.getImageSession).mockResolvedValue(readySession);
  });

  it('shows the user message immediately while waiting for the assistant', async () => {
    const messageDeferred = deferred<{
      session: AIImageSession;
      response: Record<string, unknown>;
    }>();
    vi.mocked(imageApi.sendImageMessage).mockReturnValue(messageDeferred.promise);

    const state = useAIImageSession();
    await state.loadSession(readySession.id);

    const sendPromise = state.sendMessage('Make it cyan and minimal');
    expect(state.messages.value[state.messages.value.length - 1]?.content).toBe(
      'Make it cyan and minimal'
    );
    expect(state.messages.value[state.messages.value.length - 1]?.role).toBe('user');
    expect(state.isSending.value).toBe(true);

    messageDeferred.resolve({
      session: {
        ...readySession,
        messages: [
          ...readySession.messages,
          {
            id: 2,
            role: 'user',
            content: 'Make it cyan and minimal',
            metadata: null,
            inserted_at: '2026-09-09T00:00:01Z',
          },
          {
            id: 3,
            role: 'assistant',
            content: 'Got it.',
            metadata: { ready_to_generate: false },
            inserted_at: '2026-09-09T00:00:02Z',
          },
        ],
      },
      response: { message: 'Got it.' },
    });
    await sendPromise;

    expect(state.messages.value.map((message) => message.content)).toEqual([
      'Ready to create.',
      'Make it cyan and minimal',
      'Got it.',
    ]);
  });

  it('finishes prompt generation before invoking image generation', async () => {
    const promptDeferred = deferred<Awaited<ReturnType<typeof imageApi.prepareImagePrompt>>>();
    const imageDeferred = deferred<AIImageSession>();

    vi.mocked(imageApi.prepareImagePrompt).mockReturnValue(promptDeferred.promise);
    vi.mocked(imageApi.generateImage).mockReturnValue(imageDeferred.promise);

    const state = useAIImageSession();
    await state.loadSession(readySession.id);

    const generation = state.generate();
    expect(state.isGeneratingPrompt.value).toBe(true);
    expect(state.isGenerating.value).toBe(false);
    expect(imageApi.generateImage).not.toHaveBeenCalled();

    promptDeferred.resolve({
      session: {
        ...readySession,
        brief_summary: {
          generation_prompt: 'Final production prompt',
          aspect_ratio: '1:1',
        },
      },
      prompt: 'Final production prompt',
      aspect_ratio: '1:1',
    });
    await vi.waitFor(() => expect(state.isGenerating.value).toBe(true));

    expect(state.isGeneratingPrompt.value).toBe(false);
    expect(imageApi.generateImage).toHaveBeenCalledWith(readySession.id);

    imageDeferred.resolve({
      ...readySession,
      status: 'generated',
      thumbnail_url: 'https://example.com/generated.png',
    });
    await generation;

    expect(state.isGenerating.value).toBe(false);
    expect(state.generatedImageUrl.value).toBe('https://example.com/generated.png');
  });

  it('prepares an edit instruction before revising a generated image', async () => {
    const generatedSession: AIImageSession = {
      ...readySession,
      status: 'generated',
      thumbnail_url: 'https://example.com/generated.png',
      messages: [
        {
          id: 10,
          role: 'assistant',
          content: 'Ready to apply those changes.',
          metadata: {
            ready_to_edit: true,
            edit_prompt: 'Soften glow and keep the monogram',
          },
          inserted_at: '2026-09-09T00:00:00Z',
        },
      ],
    };

    vi.mocked(imageApi.getImageSession).mockResolvedValue(generatedSession);

    const promptDeferred = deferred<Awaited<ReturnType<typeof imageApi.prepareImageRevision>>>();
    const reviseDeferred = deferred<AIImageSession>();
    vi.mocked(imageApi.prepareImageRevision).mockReturnValue(promptDeferred.promise);
    vi.mocked(imageApi.reviseImage).mockReturnValue(reviseDeferred.promise);

    const state = useAIImageSession();
    await state.loadSession(generatedSession.id);
    expect(state.readyToEdit.value).toBe(true);

    const revision = state.revise();
    expect(state.isGeneratingPrompt.value).toBe(true);
    expect(imageApi.reviseImage).not.toHaveBeenCalled();

    promptDeferred.resolve({
      session: {
        ...generatedSession,
        brief_summary: {
          edit_prompt: 'Soften glow and keep the monogram',
          aspect_ratio: '1:1',
        },
      },
      prompt: 'Soften glow and keep the monogram',
      aspect_ratio: '1:1',
    });
    await vi.waitFor(() => expect(state.isGenerating.value).toBe(true));
    expect(imageApi.reviseImage).toHaveBeenCalledWith(generatedSession.id);

    reviseDeferred.resolve({
      ...generatedSession,
      thumbnail_url: 'https://example.com/revised.png',
    });
    await revision;

    expect(state.generatedImageUrl.value).toBe('https://example.com/revised.png');
    expect(state.isGenerating.value).toBe(false);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

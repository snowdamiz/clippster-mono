import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAIThumbnailSession } from './useAIThumbnailSession';
import * as thumbnailApi from '@/services/aiThumbnailApi';
import type { AIThumbnailSession } from '@/services/aiThumbnailApi';

vi.mock('@/services/aiThumbnailApi', () => ({
  listThumbnailSessions: vi.fn(),
  createThumbnailSession: vi.fn(),
  getThumbnailSession: vi.fn(),
  deleteThumbnailSession: vi.fn(),
  renameThumbnailSession: vi.fn(),
  setThumbnailMode: vi.fn(),
  updateThumbnailMedia: vi.fn(),
  setThumbnailReference: vi.fn(),
  sendThumbnailMessage: vi.fn(),
  generateThumbnail: vi.fn(),
  generateThumbnailFromVideo: vi.fn(),
  continueThumbnailEditable: vi.fn(),
  analyzeThumbnailVideo: vi.fn(),
  applyThumbnailConcept: vi.fn(),
  refineThumbnail: vi.fn(),
  acceptThumbnail: vi.fn(),
}));

const readySession: AIThumbnailSession = {
  id: 7,
  name: 'Hook thumbnail',
  status: 'discovery',
  generation_mode: 'editable',
  media_items: [],
  key_frames: [],
  reference_image_url: null,
  reference_image_meta: null,
  candidates: [],
  thumbnail_url: null,
  plate_url: null,
  recipe: null,
  composition: null,
  result: null,
  brief_summary: { description: 'Bold gaming thumbnail' },
  canvas_width: 1280,
  canvas_height: 720,
  refinement_round: 0,
  refinement_messages_used: 0,
  max_refinement_rounds: 3,
  max_messages_per_round: 6,
  messages: [
    {
      id: 1,
      role: 'assistant',
      content: 'Ready to generate.',
      metadata: { ready_to_generate: true, summary: { description: 'Bold gaming thumbnail' } },
      inserted_at: '2026-09-09T00:00:00Z',
    },
  ],
  inserted_at: '2026-09-09T00:00:00Z',
  updated_at: '2026-09-09T00:00:00Z',
};

describe('useAIThumbnailSession stuck generation recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats stuck generating sessions as retryable', async () => {
    const stuck: AIThumbnailSession = {
      ...readySession,
      status: 'generating',
      thumbnail_url: null,
      plate_url: null,
      candidates: [],
    };
    vi.mocked(thumbnailApi.getThumbnailSession).mockResolvedValue(stuck);

    const state = useAIThumbnailSession();
    await state.loadSession(stuck.id);

    expect(state.stuckFailedGeneration.value).toBe(true);
    expect(state.readyToGenerate.value).toBe(true);
  });

  it('reloads before generate so the server can recover stuck status', async () => {
    const stuck: AIThumbnailSession = {
      ...readySession,
      status: 'generating',
    };
    const recovered: AIThumbnailSession = {
      ...readySession,
      status: 'discovery',
    };
    const generated: AIThumbnailSession = {
      ...readySession,
      status: 'generated',
      thumbnail_url: 'https://example.com/thumb.png',
      candidates: [{ url: 'https://example.com/thumb.png', selected: true }],
    };

    vi.mocked(thumbnailApi.getThumbnailSession)
      .mockResolvedValueOnce(stuck)
      .mockResolvedValueOnce(recovered);
    vi.mocked(thumbnailApi.generateThumbnail).mockResolvedValue(generated);

    const state = useAIThumbnailSession();
    await state.loadSession(stuck.id);
    await state.generate();

    expect(thumbnailApi.getThumbnailSession).toHaveBeenCalledTimes(2);
    expect(thumbnailApi.generateThumbnail).toHaveBeenCalledWith(7, 'editable');
    expect(state.session.value?.status).toBe('generated');
  });

  it('reloads stuck generating sessions before chat', async () => {
    const stuck: AIThumbnailSession = {
      ...readySession,
      status: 'generating',
    };
    const recovered: AIThumbnailSession = {
      ...readySession,
      status: 'discovery',
    };
    const afterChat: AIThumbnailSession = {
      ...readySession,
      messages: [
        ...readySession.messages,
        {
          id: 2,
          role: 'user',
          content: 'Make the text larger',
          metadata: null,
          inserted_at: '2026-09-09T00:00:01Z',
        },
      ],
    };

    vi.mocked(thumbnailApi.getThumbnailSession)
      .mockResolvedValueOnce(stuck)
      .mockResolvedValueOnce(recovered);
    vi.mocked(thumbnailApi.sendThumbnailMessage).mockResolvedValue({
      session: afterChat,
      response: {},
    });

    const state = useAIThumbnailSession();
    await state.loadSession(stuck.id);
    await state.sendMessage('Make the text larger');

    expect(thumbnailApi.getThumbnailSession).toHaveBeenCalledTimes(2);
    expect(thumbnailApi.sendThumbnailMessage).toHaveBeenCalledWith(7, 'Make the text larger');
  });
});

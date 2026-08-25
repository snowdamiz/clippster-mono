import { describe, expect, it } from 'vitest';
import { AI_VIDEO_STYLE_PACKS } from './ai-video-style-packs';
import { canAccessAIVideo } from '@/utils/aiVideoAccess';

describe('AI video style packs', () => {
  it('ships six complete, versioned recipes with wide and vertical adaptations', () => {
    expect(AI_VIDEO_STYLE_PACKS).toHaveLength(6);
    expect(new Set(AI_VIDEO_STYLE_PACKS.map((pack) => pack.id)).size).toBe(6);

    for (const pack of AI_VIDEO_STYLE_PACKS) {
      expect(pack.schemaVersion).toBe(1);
      expect(pack.aspectRatios['16:9'].layout).toBeTruthy();
      expect(pack.aspectRatios['9:16'].layout).toBeTruthy();
      expect(pack.rendererFallbacks).not.toEqual({});
    }
  });
});

describe('AI video access', () => {
  it('allows admins or enabled Creator/Pro users only', () => {
    expect(canAccessAIVideo({ is_admin: true })).toBe(true);
    expect(canAccessAIVideo({ ai_editor_enabled: true, subscription: { tier: 'creator' } })).toBe(
      true
    );
    expect(canAccessAIVideo({ ai_editor_enabled: true, subscription: { tier: 'pro' } })).toBe(true);
    expect(canAccessAIVideo({ ai_editor_enabled: true, subscription: { tier: 'starter' } })).toBe(
      false
    );
    expect(canAccessAIVideo({ ai_editor_enabled: false, subscription: { tier: 'pro' } })).toBe(
      false
    );
  });
});

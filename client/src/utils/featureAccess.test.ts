import { describe, expect, it } from 'vitest';
import { canAccessAIVideo } from './aiVideoAccess';
import { canAccessCampaigns, canAccessImageEditor } from './featureAccess';
import { canAccessTokend } from './tokendAccess';

describe('platform rollout access', () => {
  it('grants each feature globally without an individual account grant', () => {
    const user = { subscription: { tier: 'free' } };

    expect(canAccessAIVideo(user, true)).toBe(true);
    expect(canAccessImageEditor(user, true)).toBe(true);
    expect(canAccessTokend(user, true)).toBe(true);
    expect(canAccessCampaigns(user, true)).toBe(true);
  });

  it('preserves admin and individual access while rollout flags are disabled', () => {
    const paidUser = { subscription: { tier: 'creator' } };

    expect(canAccessAIVideo({ ...paidUser, ai_editor_enabled: true }, false)).toBe(true);
    expect(canAccessImageEditor({ ...paidUser, ai_editor_enabled: true }, false)).toBe(true);
    expect(canAccessTokend({ ...paidUser, tokend_enabled: true }, false)).toBe(true);
    expect(canAccessCampaigns({ campaigns_enabled: true }, false)).toBe(true);
    expect(canAccessCampaigns({ is_admin: true }, false)).toBe(true);
  });

  it('denies ungranted users while rollout flags are disabled', () => {
    const user = { subscription: { tier: 'pro' } };

    expect(canAccessAIVideo(user, false)).toBe(false);
    expect(canAccessImageEditor(user, false)).toBe(false);
    expect(canAccessTokend(user, false)).toBe(false);
    expect(canAccessCampaigns(user, false)).toBe(false);
  });
});

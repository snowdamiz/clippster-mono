import { describe, expect, it } from 'vitest';
import { parseCreatorSkillPreferences, serializeCreatorSkillPreferences } from './creatorSkillPreferences';

describe('creator skill preferences', () => {
  it('retains the audience when saving and loading a creator profile', () => {
    const saved = serializeCreatorSkillPreferences({ publishing: { audience: 'First-time home cooks' } });
    expect(parseCreatorSkillPreferences(saved).publishing?.audience).toBe('First-time home cooks');
  });
  it('keeps brand, delivery, schedule, and sponsor restrictions with existing preferences', () => {
    const saved = serializeCreatorSkillPreferences({
      brand: { channelName: 'The Channel', colors: [' #123456 '], fonts: [' Inter '], companyUrl: 'https://example.com' },
      editing: { preserveEveryWord: true, rules: ['No face grading'] },
      publishing: { schedule: 'Shorts in the morning' },
      delivery: { destination: 'Team review folder', previewMaxMb: 30 },
      sponsors: [{ name: ' Acme ', platforms: ['YouTube'], riskLine: 'Risk disclosure', discountInDescriptionAllowed: false }],
    });
    const result = parseCreatorSkillPreferences(saved);
    expect(result.brand).toMatchObject({ channelName: 'The Channel', colors: ['#123456'], fonts: ['Inter'] });
    expect(result.editing?.rules).toEqual(['No face grading']);
    expect(result.publishing?.schedule).toBe('Shorts in the morning');
    expect(result.delivery).toEqual({ destination: 'Team review folder', previewMaxMb: 30 });
    expect(result.sponsors?.[0]).toMatchObject({ name: 'Acme', riskLine: 'Risk disclosure', discountInDescriptionAllowed: false });
  });
  it('accepts the structured preference object returned by the account API', () => {
    expect(parseCreatorSkillPreferences({ brand: { channelName: 'The Channel' }, sponsors: [{ name: 'Acme' }] })).toMatchObject({
      brand: { channelName: 'The Channel' }, sponsors: [{ name: 'Acme' }],
    });
  });
  it('rejects an impossible phone preview limit instead of silently using the default', () => {
    expect(() => serializeCreatorSkillPreferences({ delivery: { previewMaxMb: 250 } })).toThrow('between 1 and 200 MB');
    expect(() => serializeCreatorSkillPreferences({ delivery: { previewMaxMb: 8 } })).not.toThrow();
  });
});

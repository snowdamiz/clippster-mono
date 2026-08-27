import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CAPTION_PRESETS, DEFAULT_CAPTION_PRESET_ID, settingsFromPresetId } from './captionPresets';

describe('captionPresets', () => {
  it('matches the Tauri default caption set', () => {
    assert.deepEqual(
      CAPTION_PRESETS.map((preset) => preset.id),
      ['mr-beast', 'tiktok-bold', 'subtitle-tutorial', 'neon-glow', 'karaoke'],
    );
    assert.equal(CAPTION_PRESETS.find((preset) => preset.id === 'mr-beast')?.name, 'MrBeast');
    assert.equal(CAPTION_PRESETS.find((preset) => preset.id === 'subtitle-tutorial')?.name, 'Clean Subtitle');
    assert.equal(DEFAULT_CAPTION_PRESET_ID, 'tiktok-bold');
  });

  it('builds the same core styles as the desktop wizard', () => {
    const beast = settingsFromPresetId('mr-beast');
    assert.equal(beast.textColor, '#FACC15');
    assert.equal(beast.fontFamily, 'Bebas Neue');
    assert.equal(beast.border2Width, 4);
    assert.equal(beast.highlightColor, '#FFFFFF');
    assert.equal(beast.animationStyle, 'zoom');

    const tiktok = settingsFromPresetId('tiktok-bold');
    assert.equal(tiktok.backgroundEnabled, true);
    assert.equal(tiktok.backgroundColor, 'rgba(0,0,0,0.8)');
    assert.equal(tiktok.animationStyle, 'karaoke');

    const clean = settingsFromPresetId('subtitle-tutorial');
    assert.equal(clean.fontFamily, 'Roboto');
    assert.equal(clean.fontWeight, 400);
    assert.equal(clean.fontSize, 40);
    assert.equal(clean.animationStyle, 'none');

    const neon = settingsFromPresetId('neon-glow');
    assert.equal(neon.shadowColor, '#22D3EE');
    assert.equal(neon.shadowBlur, 15);
    assert.equal(neon.animationStyle, 'glow');

    const karaoke = settingsFromPresetId('karaoke');
    assert.equal(karaoke.highlightColor, '#FACC15');
    assert.equal(karaoke.animationStyle, 'karaoke');
  });
});

import { expect, it } from 'vitest';
import { creatorSkillQrSvg } from './creatorSkillQr';

it('encodes and decodes the exact saved HTTPS referral URL locally', () => {
  const svg = creatorSkillQrSvg('https://sponsor.example/ref?code=CREATOR23');
  expect(svg).toContain('aria-label="Referral QR code"');
  expect(svg).toContain('<rect');
  expect(svg).not.toContain('sponsor.example');
});

it('rejects non-HTTPS and credential-bearing links', () => {
  expect(() => creatorSkillQrSvg('http://sponsor.example/ref')).toThrow();
  expect(() => creatorSkillQrSvg('https://user:pass@sponsor.example/ref')).toThrow();
});

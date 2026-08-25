import { describe, expect, it } from 'vitest';
import { extractTokendChannel, isTokendUrl } from './tokend';

describe('tokend service', () => {
  it('detects tokend.tv and local web URLs', () => {
    expect(isTokendUrl('https://tokend.tv/seed-nova')).toBe(true);
    expect(isTokendUrl('http://localhost:4100/seed-nova')).toBe(true);
    expect(isTokendUrl('https://tokend.com/@seed-nova')).toBe(false);
    expect(isTokendUrl('https://youtube.com/@x')).toBe(false);
  });

  it('extracts creator slug from Tokend paths and handles', () => {
    expect(extractTokendChannel('https://tokend.tv/Seed-Nova')).toBe('seed-nova');
    expect(extractTokendChannel('http://localhost:4100/seed-nova/vods')).toBe('seed-nova');
    expect(extractTokendChannel('https://tokend.tv/stream/seed-halo')).toBe('seed-halo');
    expect(extractTokendChannel('@seed-nova')).toBe('seed-nova');
    expect(extractTokendChannel('seed-orbit')).toBe('seed-orbit');
  });
});

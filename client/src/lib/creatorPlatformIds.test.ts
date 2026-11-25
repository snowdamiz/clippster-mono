import { describe, expect, it } from 'vitest';
import { extractYouTubeChannel } from './creatorPlatformIds';

describe('extractYouTubeChannel', () => {
  it.each([
    ['https://www.youtube.com/c/ExampleChannel', 'c/ExampleChannel'],
    ['https://www.youtube.com/c/ExampleChannel/streams?view=0', 'c/ExampleChannel'],
    ['https://www.youtube.com/user/ExampleChannel/videos', 'user/ExampleChannel'],
    ['https://www.youtube.com/@ExampleChannel/videos', '@ExampleChannel'],
    ['https://www.youtube.com/channel/UC1234567890123456789012', 'UC1234567890123456789012'],
    ['c/ExampleChannel', 'c/ExampleChannel'],
    ['@ExampleChannel', '@ExampleChannel'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', null],
  ])('preserves the channel identity in %s', (input, expected) => {
    expect(extractYouTubeChannel(input)).toBe(expected);
  });
});

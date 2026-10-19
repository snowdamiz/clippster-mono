import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => path }));

class MockAudio extends EventTarget {
  static instance: MockAudio;
  currentTime = 0;
  duration = 180;
  volume = 0.7;
  muted = false;
  src = '';
  constructor() {
    super();
    MockAudio.instance = this;
  }
  play = vi.fn(async () => {
    this.dispatchEvent(new Event('play'));
  });
  pause = vi.fn(() => {
    this.dispatchEvent(new Event('pause'));
  });
}

const tracks = ['First', 'Second', 'Third'].map((title, i) => ({
  id: String(i),
  title,
  filePath: `${i}.mp3`,
}));

describe('audio player navigation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('Audio', MockAudio);
  });

  it('goes backward from a first selection in the middle, then forward in list order', async () => {
    const { useAudioPlayer } = await import('./useAudioPlayer');
    const player = useAudioPlayer();
    await player.playPlaylist(tracks, 1);
    expect(player.hasPrevious.value).toBe(true);
    player.seek(46);
    await player.playPrevious();
    expect(player.currentTrack.value?.title).toBe('First');
    expect(player.hasPrevious.value).toBe(false);
    await player.playNext();
    expect(player.currentTrack.value?.title).toBe('Second');
    await player.playNext();
    expect(player.currentTrack.value?.title).toBe('Third');
    expect(player.hasNext.value).toBe(false);
  });

  it('cycles off, one, all, off and wraps list boundaries with repeat all', async () => {
    const { useAudioPlayer } = await import('./useAudioPlayer');
    const player = useAudioPlayer();
    await player.playPlaylist(tracks, 2);
    player.toggleRepeat();
    expect(player.repeatMode.value).toBe('one');
    player.toggleRepeat();
    expect(player.repeatMode.value).toBe('all');
    await player.playNext();
    expect(player.currentTrack.value?.title).toBe('First');
    await player.playPrevious();
    expect(player.currentTrack.value?.title).toBe('Third');
    player.toggleRepeat();
    expect(player.repeatMode.value).toBe('off');
  });

  it('uses playback history while shuffled and list order when shuffle is turned off', async () => {
    const { useAudioPlayer } = await import('./useAudioPlayer');
    const player = useAudioPlayer();
    await player.playPlaylist(tracks, 1, { shuffle: true });
    expect(player.hasPrevious.value).toBe(false);
    await player.playNext();
    expect(player.currentTrack.value?.id).not.toBe('1');
    await player.playPrevious();
    expect(player.currentTrack.value?.id).toBe('1');
    player.toggleShuffle();
    await player.playPrevious();
    expect(player.currentTrack.value?.id).toBe('0');
    await player.playNext();
    expect(player.currentTrack.value?.id).toBe('1');
  });

  it('restarts the current song without changing selection or repeat mode', async () => {
    const { useAudioPlayer } = await import('./useAudioPlayer');
    const player = useAudioPlayer();
    await player.playPlaylist(tracks, 1);
    player.seek(46);
    player.pause();
    player.restart();
    expect(player.currentTime.value).toBe(0);
    expect(MockAudio.instance.currentTime).toBe(0);
    expect(player.isPlaying.value).toBe(true);
    expect(player.currentTrack.value?.id).toBe('1');
    expect(player.repeatMode.value).toBe('off');
  });

  it('repeats one at track end and supports repeat all with a single song', async () => {
    const { useAudioPlayer } = await import('./useAudioPlayer');
    const player = useAudioPlayer();
    await player.playPlaylist([tracks[0]]);
    player.toggleRepeat();
    player.seek(180);
    MockAudio.instance.dispatchEvent(new Event('ended'));
    expect(MockAudio.instance.currentTime).toBe(0);
    expect(player.currentTrack.value?.id).toBe('0');
    player.toggleRepeat();
    expect(player.hasNext.value).toBe(true);
    await player.playNext();
    expect(player.currentTrack.value?.id).toBe('0');
  });
});

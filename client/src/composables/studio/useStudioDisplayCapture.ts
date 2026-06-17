export type DisplayCaptureVideoConstraints = MediaTrackConstraints & {
  cursor?: 'always' | 'motion' | 'never';
  displaySurface?: ConstrainDOMString;
};

type DisplayCaptureTrackSettings = MediaTrackSettings & {
  cursor?: 'always' | 'motion' | 'never';
  displaySurface?: 'monitor' | 'window' | 'browser';
};

export function buildDisplayMediaConstraints(hideCursor: boolean): DisplayCaptureVideoConstraints {
  if (!hideCursor) {
    return { cursor: 'always' };
  }

  return {
    cursor: 'never',
    displaySurface: { ideal: 'monitor' },
  };
}

export async function applyDisplayCursorPreference(
  stream: MediaStream | null,
  hideCursor: boolean
): Promise<boolean> {
  const track = stream?.getVideoTracks()[0];
  if (!track) return false;

  const cursorValue = hideCursor ? 'never' : 'always';
  const attempts: MediaTrackConstraints[] = [
    { cursor: cursorValue } as DisplayCaptureVideoConstraints,
    { advanced: [{ cursor: cursorValue } as MediaTrackConstraintSet] },
  ];

  for (const constraints of attempts) {
    try {
      await track.applyConstraints(constraints);
      const settings = track.getSettings() as DisplayCaptureTrackSettings;
      if (!hideCursor || settings.cursor === 'never') {
        return true;
      }
    } catch {
      // Try the next constraint shape supported by the capture backend.
    }
  }

  return !hideCursor;
}

export function getDisplaySurface(stream: MediaStream | null): DisplayCaptureTrackSettings['displaySurface'] | null {
  const track = stream?.getVideoTracks()[0];
  if (!track) return null;
  return (track.getSettings() as DisplayCaptureTrackSettings).displaySurface ?? null;
}

/** Selected creator media may contain speech, music, or both; do not silently discard its audio. */
export function creatorSkillAssetAudioReview(role: 'intro' | 'outro', hasAudio: boolean, musicAllowed: boolean): string | null {
  if (!hasAudio) return null;
  return musicAllowed
    ? `The selected creator ${role} contains audio. Confirm speech, music rights, and platform licensing in the finished edit.`
    : `The selected creator ${role} contains audio. Check for music in the finished edit; no added music was approved for this creator.`;
}

import type { AudioChunk } from '@/composables/useAudioChunking';

/** Decode an extracted MP3 chunk for the existing multipart transcription API. */
export function audioChunkFile(chunk: AudioChunk): File {
  const binary = atob(chunk.base64_data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], chunk.filename, { type: 'audio/mpeg' });
}

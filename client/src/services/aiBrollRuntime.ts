import { invoke } from '@tauri-apps/api/core';
export { suggestAiBroll, searchAiBrollStock } from './aiBrollApi';
export { getAiBrollSuggestionsForClip, saveAiBrollSuggestions, updateAiBrollSuggestion, upsertAiBrollSuggestion } from './database/ai-broll-suggestions';
export { addProjectMedia } from './database/project-media';
export function downloadBrollMedia(options: { url: string; projectId: string; filename: string; mediaType: 'image' | 'video' }) {
  return invoke<string>('download_broll_media', { url: options.url, projectId: options.projectId, filename: options.filename });
}

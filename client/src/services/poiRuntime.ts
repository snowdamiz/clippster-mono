import { invoke } from '@tauri-apps/api/core';
import { EditorCore } from '@/editor/core';
import { convertFileSrc } from '@/services/creatorProfileRuntime';
import { utf8ToBase64 } from '@/utils/encoding';
export function getPoiTimelineEditor() { return EditorCore.getInstance(); }
export async function resolvePoiVideoSource(path: string, urlSafe = false) {
  const port = await invoke<number>('get_video_server_port');
  const base64 = utf8ToBase64(path);
  const encoded = urlSafe ? base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : base64;
  return path.toLowerCase().endsWith('.ts') ? `http://localhost:${port}/ts-hls/${encoded}/playlist.m3u8` : `http://localhost:${port}/video/${encoded}`;
}
export async function savePoiMedia(file: File, _projectId?: string | null) {
  return invoke<string>('save_temp_media_file', { fileName: file.name, data: Array.from(new Uint8Array(await file.arrayBuffer())) });
}
export function resolvePoiMedia(_projectId: string | null | undefined, path: string) { return convertFileSrc(path); }

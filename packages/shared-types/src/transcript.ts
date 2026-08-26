import type { WordInfo } from './clip';

export interface Transcript {
  id: string;
  raw_video_id: string;
  content?: string;
  raw_json?: string;
  text?: string;
  words?: WordInfo[];
  language: string | null;
  duration: number | null;
  created_at: number;
  updated_at: number;
}

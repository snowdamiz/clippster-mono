/** SQLite/API project row — snake_case matches DB columns. */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  thumbnail_path: string | null;
  parent_id: string | null;
  active_vod_preset_id?: string | null;
  active_vod_preset_config?: string | null;
  created_at: number;
  updated_at: number;
}

export interface RawVideo {
  id: string;
  project_id: string | null;
  file_path: string;
  filename?: string | null;
  original_filename?: string | null;
  thumbnail_path?: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  frame_rate?: number | null;
  fps?: number | null;
  codec: string | null;
  file_size: number | null;
  platform?: string | null;
  source_url?: string | null;
  created_at: number;
  updated_at: number;
}

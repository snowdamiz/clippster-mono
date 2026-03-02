import { getDatabase } from './core';

/**
 * Clear all local storage data from SQLite database except built clips and transcripts.
 * This is called after the Rust command deletes files from disk.
 */
export async function clearLocalStorageData(): Promise<void> {
  console.log('[Storage Cleanup] Starting database cleanup...');
  const db = await getDatabase();
  
  try {
    // Clear raw videos
    console.log('[Storage Cleanup] Deleting raw_videos...');
    await db.execute('DELETE FROM raw_videos');
    
    // Clear VOD projects (the main projects table)
    console.log('[Storage Cleanup] Deleting projects...');
    const projectsBefore = await db.select<Array<{ count: number }>>('SELECT COUNT(*) as count FROM projects');
    console.log(`[Storage Cleanup] projects count before: ${projectsBefore[0]?.count || 0}`);
    await db.execute('DELETE FROM projects');
    const projectsAfter = await db.select<Array<{ count: number }>>('SELECT COUNT(*) as count FROM projects');
    console.log(`[Storage Cleanup] projects count after: ${projectsAfter[0]?.count || 0}`);
    
    // Clear video editor projects
    console.log('[Storage Cleanup] Deleting video_editor_projects...');
    const editorProjectsBefore = await db.select<Array<{ count: number }>>('SELECT COUNT(*) as count FROM video_editor_projects');
    console.log(`[Storage Cleanup] video_editor_projects count before: ${editorProjectsBefore[0]?.count || 0}`);
    await db.execute('DELETE FROM video_editor_projects');
    const editorProjectsAfter = await db.select<Array<{ count: number }>>('SELECT COUNT(*) as count FROM video_editor_projects');
    console.log(`[Storage Cleanup] video_editor_projects count after: ${editorProjectsAfter[0]?.count || 0}`);
    
    // Clear video editor sources
    console.log('[Storage Cleanup] Deleting video_editor_sources...');
    await db.execute('DELETE FROM video_editor_sources');
    
    // Clear video editor edits and related tables
    console.log('[Storage Cleanup] Deleting video_editor_edits...');
    await db.execute('DELETE FROM video_editor_edits');
    await db.execute('DELETE FROM video_editor_audio_tracks');
    await db.execute('DELETE FROM video_editor_text_overlays');
    await db.execute('DELETE FROM video_editor_stickers');
    await db.execute('DELETE FROM video_editor_watermarks');
    await db.execute('DELETE FROM video_editor_effects');
    await db.execute('DELETE FROM video_editor_transitions');
    
    // Clear project media
    console.log('[Storage Cleanup] Deleting project_media...');
    await db.execute('DELETE FROM project_media');
    
    // Clear OpenCut editor projects
    console.log('[Storage Cleanup] Deleting opencut_projects...');
    await db.execute('DELETE FROM opencut_projects');
    await db.execute('DELETE FROM opencut_media_assets');
    await db.execute('DELETE FROM opencut_saved_sounds');
    
    // Clear thumbnails (except those linked to built clips)
    // Note: Thumbnail files on disk are preserved, we only clean orphaned DB records
    // The thumbnails table has clip_id that references clips
    await db.execute(`
      DELETE FROM thumbnails 
      WHERE clip_id NOT IN (
        SELECT id FROM clips 
        WHERE build_status = 'completed' 
        AND built_file_path IS NOT NULL
      )
    `);
    
    // Clear detection sessions and segments
    await db.execute('DELETE FROM clip_detection_sessions');
    await db.execute('DELETE FROM clip_segments');
    
    // Clear manual clips (not built clips)
    await db.execute('DELETE FROM manual_clips');
    
    // Clear clip edits
    await db.execute('DELETE FROM clip_edits');
    
    // Clear clip versions
    await db.execute('DELETE FROM clip_versions');
    
    // Clear focal points
    await db.execute('DELETE FROM focal_points');
    
    // Clear speaker detection data
    await db.execute('DELETE FROM speaker_detection');
    
    // Clear chunked transcripts (for detection, not final clip transcripts)
    await db.execute('DELETE FROM chunked_transcripts');
    
    // Clear transcript words (except those linked to built clips)
    await db.execute(`
      DELETE FROM transcript_words 
      WHERE transcript_id NOT IN (
        SELECT id FROM transcripts 
        WHERE id IN (
          SELECT transcript_id FROM clips 
          WHERE transcript_id IS NOT NULL 
          AND build_status = 'completed' 
          AND built_file_path IS NOT NULL
        )
      )
    `);
    
    // Clear transcripts (except those linked to built clips)
    await db.execute(`
      DELETE FROM transcripts 
      WHERE id NOT IN (
        SELECT transcript_id FROM clips 
        WHERE transcript_id IS NOT NULL 
        AND build_status = 'completed' 
        AND built_file_path IS NOT NULL
      )
    `);
    
    // Clear livestream monitoring sessions
    await db.execute('DELETE FROM livestream_monitoring');
    
    // Clear organization assets (uploaded media)
    await db.execute('DELETE FROM organization_assets');
    
    // Clear audio assets
    await db.execute('DELETE FROM audio_assets');
    
    // Clear image assets
    await db.execute('DELETE FROM image_assets');
    
    // Clear watermarks
    await db.execute('DELETE FROM watermarks');
    
    // Clear intro/outros
    await db.execute('DELETE FROM intro_outros');
    
    // Clear custom fonts
    await db.execute('DELETE FROM custom_fonts');
    
    console.log('[Storage Cleanup] Successfully cleared local storage data from database');
  } catch (error) {
    console.error('[Storage Cleanup] Failed to clear database:', error);
    throw error;
  }
}

/**
 * Clear localStorage proxy status entries.
 * These track proxy file generation status.
 */
export function clearProxyStatus(): void {
  try {
    const keysToRemove: string[] = [];
    
    // Find all proxy status keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('proxy_')) {
        keysToRemove.push(key);
      }
    }
    
    // Remove them
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log(`[Storage Cleanup] Cleared ${keysToRemove.length} proxy status entries from localStorage`);
  } catch (error) {
    console.error('[Storage Cleanup] Failed to clear localStorage:', error);
    throw error;
  }
}

/**
 * Complete cleanup: database + localStorage.
 */
export async function performCompleteCleanup(): Promise<void> {
  await clearLocalStorageData();
  clearProxyStatus();
}

import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { AudioPlaylist, AudioPlaylistItem, DownloadedAudio } from './types';

// ============================================
// Audio Playlists
// ============================================

export async function createAudioPlaylist(
  name: string,
  description?: string
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    'INSERT INTO audio_playlists (id, name, description, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, description || null, userId, now, now]
  );

  return id;
}

export async function getAllAudioPlaylists(): Promise<AudioPlaylist[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<AudioPlaylist[]>(
      'SELECT * FROM audio_playlists WHERE user_id IS NULL ORDER BY created_at DESC'
    );
  }

  return await db.select<AudioPlaylist[]>(
    'SELECT * FROM audio_playlists WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC',
    [userId]
  );
}

export async function getAudioPlaylist(id: string): Promise<AudioPlaylist | null> {
  const db = await getDatabase();
  const results = await db.select<AudioPlaylist[]>(
    'SELECT * FROM audio_playlists WHERE id = ?',
    [id]
  );
  return results.length > 0 ? results[0] : null;
}

export async function updateAudioPlaylist(
  id: string,
  updates: {
    name?: string;
    description?: string;
  }
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const setClause: string[] = ['updated_at = ?'];
  const params: any[] = [now];

  if (updates.name !== undefined) {
    setClause.push('name = ?');
    params.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClause.push('description = ?');
    params.push(updates.description);
  }

  params.push(id);
  await db.execute(`UPDATE audio_playlists SET ${setClause.join(', ')} WHERE id = ?`, params);
}

export async function deleteAudioPlaylist(id: string): Promise<void> {
  const db = await getDatabase();
  // Playlist items will be deleted automatically via CASCADE
  await db.execute('DELETE FROM audio_playlists WHERE id = ?', [id]);
}

// ============================================
// Audio Playlist Items
// ============================================

export async function addAudioToPlaylist(
  playlistId: string,
  audioId: string
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  // Get the next position
  const maxPositionResult = await db.select<Array<{ max_position: number | null }>>(
    'SELECT MAX(position) as max_position FROM audio_playlist_items WHERE playlist_id = ?',
    [playlistId]
  );
  const nextPosition = (maxPositionResult[0]?.max_position ?? -1) + 1;

  await db.execute(
    'INSERT INTO audio_playlist_items (id, playlist_id, audio_id, position, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, playlistId, audioId, nextPosition, now]
  );

  return id;
}

export async function getPlaylistItems(playlistId: string): Promise<AudioPlaylistItem[]> {
  const db = await getDatabase();
  return await db.select<AudioPlaylistItem[]>(
    'SELECT * FROM audio_playlist_items WHERE playlist_id = ? ORDER BY position ASC',
    [playlistId]
  );
}

export async function getPlaylistItemsWithAudio(
  playlistId: string
): Promise<Array<AudioPlaylistItem & { audio: DownloadedAudio }>> {
  const db = await getDatabase();
  return await db.select<Array<AudioPlaylistItem & { audio: DownloadedAudio }>>(
    `SELECT 
      api.*,
      da.id as audio_id,
      da.title as audio_title,
      da.source as audio_source,
      da.platform as audio_platform,
      da.source_url as audio_source_url,
      da.file_path as audio_file_path,
      da.duration as audio_duration,
      da.file_size as audio_file_size,
      da.sample_rate as audio_sample_rate,
      da.channels as audio_channels,
      da.thumbnail_url as audio_thumbnail_url,
      da.user_id as audio_user_id,
      da.created_at as audio_created_at,
      da.updated_at as audio_updated_at
     FROM audio_playlist_items api
     JOIN downloaded_audio da ON api.audio_id = da.id
     WHERE api.playlist_id = ?
     ORDER BY api.position ASC`,
    [playlistId]
  );
}

export async function removeAudioFromPlaylist(itemId: string): Promise<void> {
  const db = await getDatabase();
  
  // Get the item to know its position and playlist
  const item = await db.select<AudioPlaylistItem[]>(
    'SELECT * FROM audio_playlist_items WHERE id = ?',
    [itemId]
  );
  
  if (item.length === 0) return;
  
  const { playlist_id, position } = item[0];
  
  // Delete the item
  await db.execute('DELETE FROM audio_playlist_items WHERE id = ?', [itemId]);
  
  // Reorder remaining items
  await db.execute(
    'UPDATE audio_playlist_items SET position = position - 1 WHERE playlist_id = ? AND position > ?',
    [playlist_id, position]
  );
}

export async function reorderPlaylistItem(
  itemId: string,
  newPosition: number
): Promise<void> {
  const db = await getDatabase();
  
  // Get current item
  const item = await db.select<AudioPlaylistItem[]>(
    'SELECT * FROM audio_playlist_items WHERE id = ?',
    [itemId]
  );
  
  if (item.length === 0) return;
  
  const { playlist_id, position: oldPosition } = item[0];
  
  if (oldPosition === newPosition) return;
  
  // Shift items between old and new positions
  if (newPosition < oldPosition) {
    // Moving up: shift items down
    await db.execute(
      'UPDATE audio_playlist_items SET position = position + 1 WHERE playlist_id = ? AND position >= ? AND position < ?',
      [playlist_id, newPosition, oldPosition]
    );
  } else {
    // Moving down: shift items up
    await db.execute(
      'UPDATE audio_playlist_items SET position = position - 1 WHERE playlist_id = ? AND position > ? AND position <= ?',
      [playlist_id, oldPosition, newPosition]
    );
  }
  
  // Update the item's position
  await db.execute(
    'UPDATE audio_playlist_items SET position = ? WHERE id = ?',
    [newPosition, itemId]
  );
}

export async function getPlaylistTrackCount(playlistId: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.select<Array<{ count: number }>>(
    'SELECT COUNT(*) as count FROM audio_playlist_items WHERE playlist_id = ?',
    [playlistId]
  );
  return result[0]?.count ?? 0;
}

export async function isAudioInPlaylist(
  playlistId: string,
  audioId: string
): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.select<Array<{ count: number }>>(
    'SELECT COUNT(*) as count FROM audio_playlist_items WHERE playlist_id = ? AND audio_id = ?',
    [playlistId, audioId]
  );
  return (result[0]?.count ?? 0) > 0;
}

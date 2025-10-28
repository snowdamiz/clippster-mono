#!/usr/bin/env node

/**
 * PumpFun Clips Fetcher
 * Fetches clips for a given mint ID and outputs JSON to stdout
 */

import { PumpFunClient } from '@120356aa/pumpfun-wrapper';

async function fetchClips(mintId, limit = 20) {
  try {
    const client = new PumpFunClient();
    
    // Fetch complete streams (VODs)
    const result = await client.getCompleteStreams(mintId, limit);
    
    // Transform the data to include generated titles
    const clips = result.clips.map((clip, index) => {
      // Generate a title if not present
      const title = clip.title || `Stream ${index + 1}`;
      
      return {
        clipId: clip.clipId || clip.clip_id || clip.id,
        sessionId: clip.sessionId || clip.session_id,
        title: title,
        duration: clip.duration || 0,
        thumbnailUrl: clip.thumbnailUrl || clip.thumbnail_url || clip.thumbnailUrl,
        playlistUrl: clip.playlistUrl || clip.playlist_url || clip.url,
        mp4Url: clip.mp4Url || clip.mp4_url,
        clipType: clip.clipType || clip.clip_type || 'COMPLETE',
        startTime: clip.startTime || clip.start_time,
        endTime: clip.endTime || clip.end_time,
        createdAt: clip.createdAt || clip.created_at
      };
    });
    
    // Output result as JSON
    const output = {
      success: true,
      clips: clips,
      hasMore: result.hasMore || false,
      total: clips.length
    };
    
    console.log(JSON.stringify(output));
  } catch (error) {
    // Output error as JSON
    const errorOutput = {
      success: false,
      error: error.message || 'Failed to fetch clips',
      clips: [],
      hasMore: false,
      total: 0
    };
    
    console.error(JSON.stringify(errorOutput));
    process.exit(1);
  }
}

// Get mint ID from command line arguments
const mintId = process.argv[2];
const limit = parseInt(process.argv[3]) || 20;

if (!mintId) {
  console.error(JSON.stringify({
    success: false,
    error: 'Mint ID is required',
    clips: [],
    hasMore: false,
    total: 0
  }));
  process.exit(1);
}

fetchClips(mintId, limit);

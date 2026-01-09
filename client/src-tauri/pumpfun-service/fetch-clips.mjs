#!/usr/bin/env node

/**
 * PumpFun Clips Fetcher
 * Fetches clips for a given mint ID and outputs JSON to stdout
 */

import { PumpFunClient } from '@120356aa/pumpfun-wrapper';

// PulseKit initialization
let pulsekit = null;
try {
  const { PulseKit } = await import('@120356aa/pulsekit-sdk');
  const apiKey = process.env.PULSEKIT_PUMPFUN_SERVICE;
  const endpoint = process.env.PULSEKIT_ENDPOINT || 'https://pulsekit.fly.dev';
  
  if (apiKey) {
    pulsekit = new PulseKit({
      endpoint,
      apiKey,
      environment: process.env.NODE_ENV || 'development',
    });
  }
} catch (e) {
  // PulseKit not available, continue without it
}

function pulseCapture(event) {
  if (pulsekit) {
    try {
      pulsekit.capture(event);
    } catch (e) {
      // Ignore PulseKit errors
    }
  }
}

async function fetchClips(mintId, limit = 20) {
  pulseCapture({
    type: 'pumpfun.clips.fetch_start',
    level: 'info',
    message: `Fetching clips for mint: ${mintId}`,
    metadata: { mintId, limit },
    tags: { service: 'pumpfun', action: 'fetch_clips_start' }
  });
  
  try {
    const client = new PumpFunClient();
    
    // Fetch complete streams (VODs)
    const result = await client.getCompleteStreams(mintId, limit);
    
    // Transform the data to include generated titles
    const clips = result.clips.map((clip, index) => {
      // Generate a title if not present
      const title = clip.title || `Stream ${index + 1}`;
      
      // Try multiple possible thumbnail field names
      const thumbnailUrl = clip.thumbnailUrl || clip.thumbnail_url || clip.thumbnail || null;
      
      return {
        clipId: clip.clipId || clip.clip_id || clip.id,
        sessionId: clip.sessionId || clip.session_id,
        title: title,
        duration: clip.duration || 0,
        thumbnailUrl: thumbnailUrl,
        playlistUrl: clip.playlistUrl || clip.playlist_url || clip.url,
        mp4Url: clip.mp4Url || clip.mp4_url,
        clipType: clip.clipType || clip.clip_type || 'COMPLETE',
        startTime: clip.startTime || clip.start_time,
        endTime: clip.endTime || clip.end_time,
        createdAt: clip.createdAt || clip.created_at
      };
    });
    
    pulseCapture({
      type: 'pumpfun.clips.fetch_success',
      level: 'info',
      message: `Successfully fetched ${clips.length} clips for mint: ${mintId}`,
      metadata: { mintId, clipCount: clips.length, hasMore: result.hasMore || false },
      tags: { service: 'pumpfun', action: 'fetch_clips_success' }
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
    pulseCapture({
      type: 'pumpfun.clips.fetch_error',
      level: 'error',
      message: `Failed to fetch clips: ${error.message}`,
      metadata: { mintId, error: error.message, stack: error.stack },
      tags: { service: 'pumpfun', action: 'fetch_clips_error' }
    });
    
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

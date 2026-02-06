import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extracted clip file information
 */
export interface ExtractedClip {
  id: string;
  sourcePath: string;
  clipPath: string;
  startTime: number;
  endTime: number;
  duration: number;
  thumbnailPath?: string;
  waveformPath?: string;
}

/**
 * Service for extracting clips from source media as independent files
 * This follows professional video editor workflow where clips are extracted first,
 * then worked with directly (no trim parameters during playback)
 */
export class ClipExtractor {
  /**
   * Extract a segment from source media as an independent clip file
   * 
   * @param sourcePath Path to the source media file
   * @param startTime Start time in seconds
   * @param endTime End time in seconds
   * @param outputPath Optional output path (generated if not provided)
   * @returns Promise<ExtractedClip> Information about the extracted clip
   */
  async extractClip(
    sourcePath: string,
    startTime: number,
    endTime: number,
    outputPath?: string
  ): Promise<ExtractedClip> {
    const clipId = uuidv4();
    const duration = endTime - startTime;
    
    // Generate output path if not provided
    if (!outputPath) {
      const sourceFileName = sourcePath.split(/[\\/]/).pop() || 'source';
      const baseName = sourceFileName.replace(/\.[^/.]+$/, '');
      outputPath = `clips/clip_${clipId}_${baseName}_${startTime.toFixed(2)}_${endTime.toFixed(2)}.mp4`;
    }

    console.log(`[ClipExtractor] Extracting clip: ${sourcePath} -> ${outputPath}`);
    console.log(`[ClipExtractor] Time range: ${startTime}s - ${endTime}s (${duration}s)`);

    try {
      // Use Tauri command to extract clip with FFmpeg
      await invoke('extract_clip', {
        sourcePath,
        outputPath,
        startTime,
        endTime,
      });

      const extractedClip: ExtractedClip = {
        id: clipId,
        sourcePath,
        clipPath: outputPath,
        startTime,
        endTime,
        duration,
      };

      console.log(`[ClipExtractor] ✓ Clip extracted successfully: ${outputPath}`);
      return extractedClip;

    } catch (error) {
      console.error(`[ClipExtractor] Failed to extract clip:`, error);
      throw new Error(`Failed to extract clip: ${error}`);
    }
  }

  /**
   * Generate a thumbnail for an extracted clip
   * 
   * @param clipPath Path to the clip file
   * @param thumbnailTime Time in seconds to capture thumbnail (default: 1 second or start)
   * @returns Promise<string> Path to generated thumbnail
   */
  async generateThumbnail(
    clipPath: string,
    thumbnailTime?: number
  ): Promise<string> {
    const time = thumbnailTime || 1; // Default to 1 second or start of clip
    const thumbnailPath = `thumbnails/thumb_${clipPath.split(/[\\/]/).pop()}_${time.toFixed(2)}.jpg`;

    console.log(`[ClipExtractor] Generating thumbnail: ${clipPath} -> ${thumbnailPath}`);

    try {
      await invoke('generate_clip_thumbnail', {
        videoPath: clipPath,
        outputPath: thumbnailPath,
        time,
      });

      console.log(`[ClipExtractor] ✓ Thumbnail generated: ${thumbnailPath}`);
      return thumbnailPath;

    } catch (error) {
      console.error(`[ClipExtractor] Failed to generate thumbnail:`, error);
      throw new Error(`Failed to generate thumbnail: ${error}`);
    }
  }

  /**
   * Extract audio waveform data for a clip
   * 
   * @param clipPath Path to the clip file
   * @returns Promise<string> Path to generated waveform data file
   */
  async generateWaveform(clipPath: string): Promise<string> {
    const waveformPath = `waveforms/wave_${clipPath.split(/[\\/]/).pop()}.json`;

    console.log(`[ClipExtractor] Generating waveform: ${clipPath} -> ${waveformPath}`);

    try {
      await invoke('generate_waveform', {
        videoPath: clipPath,
        outputPath: waveformPath,
      });

      console.log(`[ClipExtractor] ✓ Waveform generated: ${waveformPath}`);
      return waveformPath;

    } catch (error) {
      console.error(`[ClipExtractor] Failed to generate waveform:`, error);
      throw new Error(`Failed to generate waveform: ${error}`);
    }
  }

  /**
   * Extract a clip with thumbnail and waveform
   * 
   * @param sourcePath Path to source media
   * @param startTime Start time in seconds
   * @param endTime End time in seconds
   * @returns Promise<ExtractedClip> Complete clip information
   */
  async extractClipWithAssets(
    sourcePath: string,
    startTime: number,
    endTime: number
  ): Promise<ExtractedClip> {
    // First extract the clip
    const clip = await this.extractClip(sourcePath, startTime, endTime);

    try {
      // Generate thumbnail (at 1 second or clip start if shorter)
      const thumbnailTime = Math.min(1, clip.duration / 2);
      clip.thumbnailPath = await this.generateThumbnail(clip.clipPath, thumbnailTime);

      // Generate waveform
      clip.waveformPath = await this.generateWaveform(clip.clipPath);

    } catch (error) {
      console.warn(`[ClipExtractor] Failed to generate assets for clip ${clip.id}:`, error);
      // Don't fail the entire extraction if assets fail
    }

    return clip;
  }

  /**
   * Delete an extracted clip and its assets
   * 
   * @param clip The clip to delete
   * @returns Promise<void>
   */
  async deleteClip(clip: ExtractedClip): Promise<void> {
    console.log(`[ClipExtractor] Deleting clip: ${clip.clipPath}`);

    try {
      // Delete clip file
      await invoke('delete_file', { path: clip.clipPath });

      // Delete thumbnail if exists
      if (clip.thumbnailPath) {
        try {
          await invoke('delete_file', { path: clip.thumbnailPath });
        } catch (error) {
          console.warn(`[ClipExtractor] Failed to delete thumbnail: ${clip.thumbnailPath}`, error);
        }
      }

      // Delete waveform if exists
      if (clip.waveformPath) {
        try {
          await invoke('delete_file', { path: clip.waveformPath });
        } catch (error) {
          console.warn(`[ClipExtractor] Failed to delete waveform: ${clip.waveformPath}`, error);
        }
      }

      console.log(`[ClipExtractor] ✓ Clip deleted successfully: ${clip.id}`);

    } catch (error) {
      console.error(`[ClipExtractor] Failed to delete clip:`, error);
      throw new Error(`Failed to delete clip: ${error}`);
    }
  }

  /**
   * Check if a clip file exists
   * 
   * @param clipPath Path to the clip file
   * @returns Promise<boolean> True if file exists
   */
  async clipExists(clipPath: string): Promise<boolean> {
    try {
      await invoke('file_exists', { path: clipPath });
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const clipExtractor = new ClipExtractor();

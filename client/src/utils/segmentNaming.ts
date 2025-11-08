import { getNextSegmentNumber } from '@/services/database';

/**
 * Generate a segment name for a downloaded VOD segment
 * Format: "{originalTitle} Part {segmentNumber}"
 * Examples: "Skateboarding Part 1", "Gaming Highlights Part 2"
 */
export async function generateSegmentName(
  originalTitle: string,
  sourceClipId: string
): Promise<string> {
  try {
    const nextSegmentNumber = await getNextSegmentNumber(sourceClipId);
    return `${originalTitle} Part ${nextSegmentNumber}`;
  } catch (error) {
    // Fallback to original title with "Segment" suffix
    return `${originalTitle} Segment`;
  }
}

/**
 * Generate a display filename for a segment download
 * This will be shown to the user in the download dialog
 */
export async function generateSegmentDisplayFilename(
  originalTitle: string,
  sourceClipId: string
): Promise<string> {
  return await generateSegmentName(originalTitle, sourceClipId);
}

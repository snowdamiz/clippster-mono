/**
 * useEditorFormatters - Pure utility functions for formatting in the clip editor
 *
 * Consolidates all formatting logic that was previously duplicated across:
 * - ClipEditorPreview (formatTime)
 * - ClipEditorTimeline (formatTime)
 * - AudioPanel (pan label)
 * - AudioInspector (pan label)
 * - MediaPanel (filename extraction)
 */

/**
 * Format seconds as MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds as MM:SS.mmm (with milliseconds)
 */
export function formatTimeWithMs(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Format duration in a human-readable format (e.g., "1:30")
 * Similar to formatTime but without leading zeros for minutes
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format pan value as a human-readable label
 * @param pan - Pan value from -1 (full left) to 1 (full right)
 * @returns Label like "Center", "50% L", or "50% R"
 */
export function formatPanLabel(pan: number): string {
  if (pan === 0) return 'Center';
  if (pan < 0) {
    return `${Math.abs(pan * 100).toFixed(0)}% L`;
  }
  return `${(pan * 100).toFixed(0)}% R`;
}

/**
 * Extract filename from a file path (works with both Unix and Windows paths)
 * @param path - Full file path
 * @param withExtension - Whether to include the file extension (default: true)
 * @returns The filename
 */
export function extractFileName(path: string, withExtension: boolean = true): string {
  // Handle both Unix and Windows path separators
  const fileName = path.split(/[\\/]/).pop() || path;
  if (withExtension) {
    return fileName;
  }
  // Remove extension
  return fileName.replace(/\.[^.]+$/, '');
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Format volume as a percentage
 * @param volume - Volume value from 0 to 2 (100% = 1.0)
 * @returns Formatted percentage string
 */
export function formatVolumePercent(volume: number): string {
  return `${Math.round(volume * 100)}%`;
}

/**
 * Format volume in decibels
 * @param db - Volume in decibels
 * @returns Formatted dB string
 */
export function formatVolumeDb(db: number): string {
  return `${db.toFixed(1)} dB`;
}

/**
 * Format a decimal value as a percentage
 * @param value - Decimal value (e.g., 0.5 for 50%, 1.5 for 150%)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Format a raw percentage value (already 0-100)
 * @param value - Percentage value (e.g., 50 for 50%)
 * @returns Formatted percentage string
 */
export function formatRawPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Format rotation with degree symbol
 * @param degrees - Rotation in degrees
 * @returns Formatted rotation string
 */
export function formatRotation(degrees: number): string {
  return `${Math.round(degrees)}°`;
}

/**
 * Format time with centiseconds (like toolbar display)
 * @param seconds - Time in seconds
 * @returns Formatted time string MM:SS.cc
 */
export function formatTimeWithCentiseconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

/**
 * Composable that returns all formatter functions
 * Use this in Vue components for a consistent API
 */
export function useEditorFormatters() {
  return {
    formatTime,
    formatTimeWithMs,
    formatTimeWithCentiseconds,
    formatDuration,
    formatPanLabel,
    extractFileName,
    truncateText,
    formatVolumePercent,
    formatVolumeDb,
    formatPercentage,
    formatRawPercentage,
    formatRotation,
  };
}

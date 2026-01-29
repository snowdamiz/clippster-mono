/**
 * useMediaTypeStyles - Media type styling utilities
 *
 * Extracted from MediaPanel.vue to centralize media type color schemes
 * and style generation for consistent UI across the application.
 */

export type MediaType = 'audio' | 'video' | 'image';

export interface MediaTypeColorScheme {
  /** Primary color (e.g., rgba(139, 92, 246, 1)) */
  primary: string;
  /** Light/muted color for text */
  light: string;
  /** Background color with low opacity */
  bg: string;
  /** Background color for gradients (start) */
  gradientStart: string;
  /** Background color for gradients (end) */
  gradientEnd: string;
  /** Border color with low opacity */
  border: string;
  /** Hover background color */
  hoverBg: string;
  /** Hover border color */
  hoverBorder: string;
}

/** Color schemes for each media type */
export const MEDIA_TYPE_COLORS: Record<MediaType, MediaTypeColorScheme> = {
  audio: {
    primary: 'rgba(139, 92, 246, 1)',
    light: 'rgba(168, 139, 250, 1)',
    bg: 'rgba(139, 92, 246, 0.2)',
    gradientStart: 'rgba(139, 92, 246, 0.2)',
    gradientEnd: 'rgba(168, 139, 250, 0.2)',
    border: 'rgba(139, 92, 246, 0.3)',
    hoverBg: 'rgba(139, 92, 246, 0.1)',
    hoverBorder: 'rgba(139, 92, 246, 0.3)',
  },
  video: {
    primary: 'rgba(14, 165, 233, 1)',
    light: 'rgba(59, 130, 246, 1)',
    bg: 'rgba(14, 165, 233, 0.2)',
    gradientStart: 'rgba(14, 165, 233, 0.2)',
    gradientEnd: 'rgba(59, 130, 246, 0.2)',
    border: 'rgba(14, 165, 233, 0.3)',
    hoverBg: 'rgba(14, 165, 233, 0.1)',
    hoverBorder: 'rgba(14, 165, 233, 0.3)',
  },
  image: {
    primary: 'rgba(16, 185, 129, 1)',
    light: 'rgba(52, 211, 153, 1)',
    bg: 'rgba(16, 185, 129, 0.2)',
    gradientStart: 'rgba(16, 185, 129, 0.2)',
    gradientEnd: 'rgba(52, 211, 153, 0.2)',
    border: 'rgba(16, 185, 129, 0.3)',
    hoverBg: 'rgba(16, 185, 129, 0.1)',
    hoverBorder: 'rgba(16, 185, 129, 0.3)',
  },
};

/**
 * Get color scheme for a media type
 */
export function getMediaTypeColors(mediaType: MediaType): MediaTypeColorScheme {
  return MEDIA_TYPE_COLORS[mediaType] || MEDIA_TYPE_COLORS.video;
}

/**
 * Get thumbnail container styles for a media type
 */
export function getThumbnailStyles(mediaType: MediaType): Record<string, string> {
  const colors = getMediaTypeColors(mediaType);
  return {
    background: `linear-gradient(135deg, ${colors.gradientStart}, ${colors.gradientEnd})`,
    border: `1px solid ${colors.border}`,
  };
}

/**
 * Get badge styles for a media type
 */
export function getBadgeStyles(mediaType: MediaType): Record<string, string> {
  const colors = getMediaTypeColors(mediaType);
  return {
    backgroundColor: colors.bg,
    color: colors.light,
  };
}

/**
 * Get hover class names for a media item based on type
 */
export function getHoverClasses(mediaType: MediaType): string {
  const classMap: Record<MediaType, string> = {
    audio: 'hover:!bg-[rgba(139,92,246,0.1)] hover:!border-[rgba(139,92,246,0.3)]',
    video: 'hover:!bg-[rgba(14,165,233,0.1)] hover:!border-[rgba(14,165,233,0.3)]',
    image: 'hover:!bg-[rgba(16,185,129,0.1)] hover:!border-[rgba(16,185,129,0.3)]',
  };
  return classMap[mediaType] || classMap.video;
}

/**
 * Get icon color for a media type
 */
export function getIconColor(mediaType: MediaType): string {
  const colors = getMediaTypeColors(mediaType);
  return colors.primary.replace('1)', '0.8)'); // Slightly transparent
}

export interface MediaTypeStylesReturn {
  /** Get full color scheme for a media type */
  getMediaTypeColors: (mediaType: MediaType) => MediaTypeColorScheme;
  /** Get thumbnail container styles */
  getThumbnailStyles: (mediaType: MediaType) => Record<string, string>;
  /** Get badge styles */
  getBadgeStyles: (mediaType: MediaType) => Record<string, string>;
  /** Get hover classes for Tailwind */
  getHoverClasses: (mediaType: MediaType) => string;
  /** Get icon color */
  getIconColor: (mediaType: MediaType) => string;
  /** Color schemes constant */
  colors: typeof MEDIA_TYPE_COLORS;
}

/**
 * Composable for media type styling utilities
 */
export function useMediaTypeStyles(): MediaTypeStylesReturn {
  return {
    getMediaTypeColors,
    getThumbnailStyles,
    getBadgeStyles,
    getHoverClasses,
    getIconColor,
    colors: MEDIA_TYPE_COLORS,
  };
}

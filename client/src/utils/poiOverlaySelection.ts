/** Sentinel IDs for non-region selections in Manual POI editor tab rows. */
export const POI_OVERLAY_SCALED_16X9_ID = '__poi_overlay_scaled_16x9__';
export const POI_OVERLAY_SUBTITLES_ID = '__poi_overlay_subtitles__';
export const POI_OVERLAY_TEXTBOX_ID = '__poi_overlay_textbox__';

export function isPoiOverlaySelection(id: string | null | undefined): boolean {
  return (
    id === POI_OVERLAY_SCALED_16X9_ID ||
    id === POI_OVERLAY_SUBTITLES_ID ||
    id === POI_OVERLAY_TEXTBOX_ID
  );
}

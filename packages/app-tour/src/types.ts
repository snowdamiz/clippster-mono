export type TourId =
  | 'desktop_sidebar'
  | 'page_creators'
  | 'page_live_clip'
  | 'page_vods'
  | 'page_projects'
  | 'page_video_editor'
  | 'page_image_editor'
  | 'landing_org';

export type TourPlacement = 'right' | 'left' | 'bottom' | 'top';

export interface TourContext {
  isAdmin?: boolean;
  isAffiliate?: boolean;
  isLiveClipEnabled?: boolean;
  isRestricted?: boolean;
  hasOrgMembership?: boolean;
  isTourActive?: boolean;
  completedTours?: Partial<Record<TourId, string>>;
}

export interface TourStep {
  id: string;
  /** data-tour-id attribute value; empty string = centered / no spotlight */
  target: string;
  title: string;
  body: string;
  group?: string;
  placement?: TourPlacement;
  /** Optional route to navigate before highlighting */
  route?: string;
  /** When true, injects mock streamer/project for this step */
  injectMock?: 'streamer' | 'project';
  /**
   * Optional arrow preset index (0–3). See ARROW_STYLES in arrow.ts.
   * When omitted, the step ordinal rotates through the style library.
   */
  arrowStyle?: number;
  visible?: (ctx: TourContext) => boolean;
}

export interface TourDefinition {
  id: TourId;
  version: string;
  steps: TourStep[];
}

export const TOUR_VERSION = 'desktop-v1';

export type CompletedTours = Partial<Record<TourId, string>>;

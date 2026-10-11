export * from './auth';
export * from './access';
export * from './billing';
export * from './api';
export * from './project';
export * from './clip';
export * from './transcript';
export * from './media';
export * from './manualFraming';
export * from './subtitle';
export * from './clipTextBox';
export * from './editor';

/**
 * Desktop SQLite uses snake_case column names; TypeScript interfaces mirror those names.
 * API JSON from Phoenix typically uses snake_case as well.
 */
export type { WebClip, WebClipInput, WebProject, WebJob, WebWorkspace, WebBranding } from './web';
export { WEB_PUBLISH_PLATFORMS } from './web';
export { manualSourceRect } from './framingGeometry';

export * from './detectionPrompts';

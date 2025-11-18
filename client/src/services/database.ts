// Re-export core functionality
export { initDatabase, getDatabase, timestamp, generateId } from './database/core';

// Re-export types
export type {
  Project,
  Prompt,
  Transcript,
  ChunkedTranscript,
  TranscriptChunk,
  TranscriptSegment,
  IntroOutro,
  Clip,
  Thumbnail,
  RawVideo,
  ClipDetectionSession,
  ClipVersion,
  ClipSegment,
  ClipWithVersion,
  FocalPoint,
  CustomSubtitlePreset,
  SubtitleSettings,
} from './database/types';

// Re-export intro/outro functions
export {
  createIntroOutro,
  getAllIntroOutros,
  updateIntroOutroCompletion,
  updateIntroOutroThumbnailStatus,
  deleteIntroOutro,
} from './database/intro-outros';

// Re-export thumbnail functions
export { createThumbnail, getThumbnailByClipId } from './database/thumbnails';

// Re-export clip detection session functions
export {
  createClipDetectionSession,
  getClipDetectionSession,
  getClipDetectionSessionsByProjectId,
  updateClipDetectionSession,
  deleteClipDetectionSession,
} from './database/clip-detection-sessions';

// Re-export clip version functions
export {
  createClipVersion,
  getClipVersion,
  getClipVersionsByClipId,
  getClipVersionsBySessionId,
  getCurrentClipVersion,
  restoreClipVersion,
} from './database/clip-versions';

// Re-export clip segment functions
export {
  getAdjacentClipSegments,
  getClipSegmentsByClipId,
  getClipSegmentsByVersionId,
  updateClipSegment,
  splitClipSegment,
  deleteClipSegment,
  realignClipSegment,
} from './database/clip-segments';

// Re-export clip build management functions
export {
  updateClipBuildStatus,
  getClipsWithBuildStatus,
  getClipWithBuildStatus,
  getClipsCurrentlyBuilding,
  cancelClipBuild,
} from './database/clip-build';

// Re-export project functions
export {
  createProject,
  getProject,
  getAllProjects,
  updateProject,
  deleteProject,
  hasRawVideosForProject,
  hasClipsForProject,
  hasDetectedOrGeneratedClips,
} from './database/projects';

// Re-export prompt functions
export {
  createPrompt,
  getPrompt,
  getAllPrompts,
  updatePrompt,
  deletePrompt,
  seedDefaultPrompt,
} from './database/prompts';

// Re-export transcript functions
export {
  createTranscript,
  getTranscriptByRawVideoId,
  getTranscriptByProjectId,
  createTranscriptSegment,
  getTranscriptSegments,
  getTranscriptWithSegmentsByProjectId,
  searchTranscripts,
  searchSegments,
} from './database/transcripts';

// Re-export chunked transcript functions
export {
  createChunkedTranscript,
  storeTranscriptChunk,
  getChunkedTranscriptByRawVideoId,
  getTranscriptChunks,
  updateChunkedTranscriptCompleteness,
  getChunkMetadataForProcessing,
} from './database/chunked-transcripts';

// Re-export raw video functions
export {
  createRawVideo,
  getAllRawVideos,
  getNextSegmentNumber,
  getRawVideo,
  getRawVideosByProjectId,
  getRawVideoByPath,
  updateRawVideo,
  deleteRawVideo,
  hasClipsReferencingRawVideo,
} from './database/raw-videos';

// Re-export clip functions
export {
  createClip,
  getAllClips,
  getGeneratedClips,
  getDetectedClips,
  getClipsByProjectId,
  updateClip,
  deleteClip,
} from './database/clips';

// Re-export clip detection and versioning functions
export {
  ensureClipVersioningTables,
  createVersionedClip,
  getClipsWithVersionsByProjectId,
  persistClipDetectionResults,
} from './database/clip-detection';

// Re-export transcript word update functions
export { updateTranscriptWord } from './database/transcript-words';

// Re-export focal point functions
export {
  createFocalPoint,
  bulkCreateFocalPoints,
  getFocalPointsByRawVideoId,
  getFocalPointAtTime,
  hasFocalPoints,
  deleteFocalPointsByRawVideoId,
  getFocalPointCount,
} from './database/focal-points';

// Re-export custom subtitle preset functions
export {
  createCustomSubtitlePreset,
  getCustomSubtitlePreset,
  getAllCustomSubtitlePresets,
  updateCustomSubtitlePreset,
  deleteCustomSubtitlePreset,
  customPresetToSettings,
} from './database/custom-subtitle-presets';

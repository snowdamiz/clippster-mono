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
  ClipBuild,
  ClipWithVersion,
  ClipWithVersionAndSegment,
  FocalPoint,
  CustomSubtitlePreset,
  SubtitleSettings,
  MonitoredStreamerRecord,
  LivestreamSessionRecord,
  LivestreamSegmentRecord,
  WatermarkImage,
  WatermarkSettings,
  AudioSettings,
  CreatorProfile,
  CreatorPlatformLink,
  CreatorProfileWithLinks,
} from './database/types';

// Re-export intro/outro functions
export {
  createIntroOutro,
  getAllIntroOutros,
  getIntroOutroById,
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
  // Multiple builds support
  createClipBuild,
  updateClipBuild,
  getClipBuilds,
  getClipBuild,
  deleteClipBuild,
  getLatestClipBuild,
  hasCompletedBuilds,
  getAllClipsWithBuilds,
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
  hasChildProjects,
  getChildProjects,
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
  getClipsWithVersionsForProjectAndChildren,
  getClipsByDetectionSession,
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

// Livestream monitoring exports
export {
  getAllMonitoredStreamers,
  getMonitoredStreamer,
  getMonitoredStreamerByMint,
  createMonitoredStreamer,
  updateMonitoredStreamer,
  deleteMonitoredStreamer,
  createLivestreamSession,
  getLivestreamSession,
  getLivestreamSessionByProjectId,
  getActiveLivestreamSessions,
  endLivestreamSession,
  updateLivestreamSessionProgress,
  createLivestreamSegment,
  getLivestreamSegment,
  getSegmentsBySession,
  updateLivestreamSegment,
  updateSegmentStatus,
} from './database/livestream-monitoring';

// Watermark exports
export {
  createWatermarkImage,
  getAllWatermarkImages,
  getWatermarkImage,
  updateWatermarkImage,
  deleteWatermarkImage,
} from './database/watermarks';

// Watermark preset exports
export {
  createWatermarkPreset,
  getAllWatermarkPresets,
  getWatermarkPreset,
  updateWatermarkPreset,
  deleteWatermarkPreset,
  presetToWatermarkSettings,
  type WatermarkPreset,
} from './database/watermark-presets';

// Manual clip creation exports
export {
  createManualClip,
  addSegmentToClip,
  extractTranscriptForTimeRange,
} from './database/manual-clips';

// Creator profiles exports
export {
  getAllCreatorProfiles,
  getCreatorProfile,
  createCreatorProfile,
  updateCreatorProfile,
  deleteCreatorProfile,
  addPlatformLink,
  updatePlatformLink,
  deletePlatformLink,
  getPlatformLinksByCreator,
  getPlatformLinkByPlatformId,
  linkMonitoredStreamer,
  unlinkMonitoredStreamer,
  getCreatorProfileByMonitoredStreamer,
  getCreatorProfileByProjectId,
} from './database/creator-profiles';

// Audio settings exports
export {
  getDefaultAudioSettings,
  getProjectAudioSettings,
  updateProjectAudioSettings,
} from './database/audio-settings';

// Speaker detection exports
export {
  saveSpeakerDetections,
  getSpeakerDetectionsByClipId,
  deleteSpeakerDetectionsByClipId,
  saveSpeakerSummary,
  getSpeakerSummariesByClipId,
  saveFramingStrategy,
  getFramingStrategyByClipId,
  getFramingStrategyWithData,
  deleteFramingStrategyByClipId,
  getClipsByFramingMode,
  getClipsByVideoType,
  clearAllSpeakerDataForClip,
  hasFramingStrategy,
  type SpeakerDetection,
  type SpeakerSummary,
  type FramingStrategy as FramingStrategyRecord,
  type FramingMode,
  type VideoType,
  type ParsedStrategyData,
} from './database/speaker-detection';

// Custom fonts exports
export {
  createCustomFont,
  getAllCustomFonts,
  getCustomFontById,
  deleteCustomFont,
  updateCustomFontName,
  type CustomFont,
} from './database/custom-fonts';

// Clip editor exports
export {
  createClipEdit,
  getClipEditByClipId,
  updateClipEdit,
  deleteClipEdit,
  createAudioTrack,
  getAudioTracksByEditId,
  updateAudioTrack,
  deleteAudioTrack,
  createTextOverlay,
  getTextOverlaysByEditId,
  updateTextOverlay,
  deleteTextOverlay,
  createSticker,
  getStickersByEditId,
  updateSticker,
  deleteSticker,
  createEffect,
  getEffectsByEditId,
  updateEffect,
  deleteEffect,
  getFullClipEdit,
  getOrCreateClipEdit,
  type ClipEditRecord,
  type ClipAudioTrackRecord,
  type ClipTextOverlayRecord,
  type ClipStickerRecord,
  type ClipEffectRecord,
  type FullClipEdit,
} from './database/clip-edits';

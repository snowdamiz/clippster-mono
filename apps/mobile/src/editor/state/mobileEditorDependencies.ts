import {
  getClipById,
  getClipBuildsByClipId,
  getClipSegmentsByClipId,
  getClipSubtitleSettings,
  getClipTextOverlay,
  getProject,
  getRawVideoByProjectId,
  getTranscriptByProjectId,
} from '@/services/database';

import { createNativeEditorId } from '../model/nativeIds';
import { mobileDraftRepository } from '../persistence/asyncStorageDraftRepository';
import {
  fingerprintMediaUri,
  probeNativeMedia,
} from '../persistence/nativeMediaProbe';
import type { LoadEditorEntryDependencies } from './loadEditorEntry';
import { getClipVersionPreference } from '@/services/clipVersionPreference';
import { getMobileCreatorSkillState } from '@/services/creatorSkillMobile';

export const mobileEditorDependencies: LoadEditorEntryDependencies = {
  data: {
    getClipById,
    getClipSegmentsByClipId,
    getClipSubtitleSettings,
    getClipTextOverlay,
    getProject,
    getRawVideoByProjectId,
    getTranscriptByProjectId,
  },
  drafts: mobileDraftRepository,
  idFactory: createNativeEditorId,
  fingerprint: fingerprintMediaUri,
  probeMedia: probeNativeMedia,
  now: () => Date.now(),
  getSelectedClipEditSource: async clipId => {
    if (await getClipVersionPreference(clipId) !== 'edited') return null;
    const state = await getMobileCreatorSkillState(clipId);
    if (state?.status !== 'needs_review' || !state.editedPath) throw new Error('The selected Clippster Skill edit is unavailable. Switch to Raw or download the edit again.');
    const builds = await getClipBuildsByClipId(clipId);
    const build = builds.find(item => item.file_path === state.editedPath && item.status === 'completed');
    if (!build?.duration || build.duration <= 0) throw new Error('The selected Clippster Skill edit has no valid duration. Switch to Raw.');
    return { path: state.editedPath, duration: build.duration, buildId: build.id, aspectRatio: state.editedAspectRatio };
  },
};

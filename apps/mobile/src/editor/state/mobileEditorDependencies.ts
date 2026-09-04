import {
  getClipById,
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
};

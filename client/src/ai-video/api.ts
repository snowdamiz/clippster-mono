import api from '@/services/api';
import type {
  AspectRatio,
  Blueprint,
  EditDocument,
  GenerateBrief,
  MediaItem,
  ReferenceInfo,
  SpeechIndex,
  SessionSummary,
  SourceSegment,
  ToolResult,
  TurnResponse,
  VideoMeasurement,
  VideoPolicy,
  VideoRun,
  VideoSession,
} from './types';

export type SessionPatch = Partial<{
  name: string | null;
  media_items: MediaItem[];
  speech_index: SpeechIndex;
  reference: ReferenceInfo | null;
  aspect_ratio: AspectRatio | null;
  motion_graphics: import('./types').MotionGraphicsLevel;
  playbook_enabled: boolean;
  creator_profile_id: number | null;
  creator_skill_job_id: number | null;
  document: EditDocument | null;
  composition_files: Record<string, string>;
}>;

export interface CreatorVideoPlaybook {
  audience: string;
  editing_style: string;
  hard_rules: string;
  captions: 'ask' | 'yes' | 'no';
}

export interface VideoCreatorProfile {
  id: number;
  name: string;
  disabled?: boolean;
  video_playbook: CreatorVideoPlaybook | null;
}

export async function listCreatorProfiles(): Promise<VideoCreatorProfile[]> {
  const response = await api.get('/user/creator-profiles');
  return response.data.profiles.filter((profile: VideoCreatorProfile) => !profile.disabled);
}

export async function saveCreatorVideoPlaybook(
  id: number,
  playbook: CreatorVideoPlaybook
): Promise<void> {
  await api.patch(`/user/creator-profiles/${id}`, { video_playbook: playbook });
}

export async function getPolicy(): Promise<VideoPolicy> {
  return (await api.get('/ai/video/policy')).data;
}

export async function listSessions(): Promise<SessionSummary[]> {
  return (await api.get('/ai/video/sessions')).data.sessions;
}

export async function createSession(patch: SessionPatch = {}): Promise<VideoSession> {
  return (await api.post('/ai/video/sessions', patch)).data;
}

export async function getSession(id: number): Promise<VideoSession> {
  return (await api.get(`/ai/video/sessions/${id}`)).data;
}

export async function updateSession(id: number, patch: SessionPatch): Promise<VideoSession> {
  return (await api.patch(`/ai/video/sessions/${id}`, patch)).data;
}

export async function deleteSession(id: number): Promise<void> {
  await api.delete(`/ai/video/sessions/${id}`);
}

// -- Example analysis ------------------------------------------------------------------

export async function startReference(sessionId: number): Promise<number> {
  return (await api.post(`/ai/video/sessions/${sessionId}/reference/start`)).data.run_id;
}

export async function labelReferenceChunk(
  sessionId: number,
  runId: number,
  chunkIndex: number,
  video: string,
  shots: Array<{ index: number; start: number; end: number }>
): Promise<void> {
  await api.post(`/ai/video/sessions/${sessionId}/reference/chunk`, {
    run_id: runId,
    chunk_index: chunkIndex,
    video,
    shots,
  });
}

export async function finishReference(
  sessionId: number,
  runId: number,
  measurement: Omit<VideoMeasurement, 'shots'> & {
    shots: Array<Omit<VideoMeasurement['shots'][number], 'keyframePath'>>;
  },
  beats: unknown
): Promise<Blueprint> {
  return (
    await api.post(`/ai/video/sessions/${sessionId}/reference/finish`, {
      run_id: runId,
      measurement,
      beats,
    })
  ).data.blueprint;
}

// -- Clips and planning ------------------------------------------------------------------

/** Label one chunk of footage. Free before a build (the planning run pays), part of the build during one. */
export async function labelSource(
  sessionId: number,
  body: {
    content_hash: string;
    chunk_key: string;
    chunk_start: number;
    kind: 'video' | 'photo';
    media: string;
    segments: SourceSegment[];
  }
): Promise<SourceSegment[]> {
  return (await api.post(`/ai/video/sessions/${sessionId}/label-source`, body)).data.segments;
}

/** Send a message in the free planning chat; the session comes back with the reply (and plan). */
export async function sendPlanMessage(sessionId: number, message: string): Promise<VideoSession> {
  return (await api.post(`/ai/video/sessions/${sessionId}/plan`, { message })).data;
}

// -- Agent runs ----------------------------------------------------------------------------

export async function startRun(
  sessionId: number,
  kind: 'generate' | 'revise',
  request: string,
  maxCredits?: number
): Promise<VideoRun> {
  return (await api.post(`/ai/video/sessions/${sessionId}/runs`, { kind, request, ...(maxCredits === undefined ? {} : { max_credits: maxCredits }) })).data.run;
}

export async function turn(
  runId: number,
  input: { brief?: GenerateBrief | Record<string, never>; results?: ToolResult[] }
): Promise<TurnResponse> {
  return (await api.post(`/ai/video/runs/${runId}/turn`, input)).data;
}

export async function completeRun(
  runId: number,
  document: EditDocument,
  compositionFiles: Record<string, string>
): Promise<{ run: VideoRun; session: VideoSession }> {
  return (
    await api.post(`/ai/video/runs/${runId}/complete`, {
      document,
      composition_files: compositionFiles,
    })
  ).data;
}

export async function failRun(runId: number, reason: string): Promise<void> {
  await api.post(`/ai/video/runs/${runId}/fail`, { reason });
}

/** The server's `{ error }` message from an axios failure, or the error's own message. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  const response = (error as { response?: { data?: { error?: unknown } } })?.response;
  const message = response?.data?.error;
  if (typeof message === 'string' && message) return message;
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isPaymentRequired(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 402;
}

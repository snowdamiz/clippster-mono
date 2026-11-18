import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CreatorSkillClaimEvidence, CreatorSkillPackage, WebClip, WebJob } from '@clippster/shared-types'
import { getStoredUser } from './authStorage'
import {
  completeClipBuild, createClipBuild, getClipBuildsByClipId, getClipById, getClipSegmentsByClipId, getProject,
  getProjectClipRows, getRawVideoByProjectId, getTranscriptByProjectId,
} from './database'
import { setClipVersionPreference } from './clipVersionPreference'
import {
  addCreatorSkillWebClip, downloadCreatorSkillWebClip, ensureCreatorSkillWebProject,
  cancelCreatorSkillWebJob, getCreatorSkillWebProject, reviewCreatorSkillWebClaim, reviewCreatorSkillWebFootage, reviewCreatorSkillWebFinding, signOffCreatorSkillWebReview, setCreatorSkillWebTranscript, startCreatorSkillWebClip, waitForCreatorSkillWebJob,
} from './creatorSkillWeb'

export interface MobileCreatorSkillState {
  status: 'queued' | 'uploading' | 'editing' | 'needs_review' | 'failed'
  creatorProfileId?: number | null
  webProjectId?: string
  webClipId?: string
  editedPath?: string
  editedAspectRatio?: '9:16' | '16:9'
  playbookPackage?: CreatorSkillPackage
  masterMd5?: string
  thumbnailVariants?: { index: number; headline: string }[]
  thumbnailCandidates?: { index: number; sourceTime: number }[]
  contactSheetAvailable?: boolean
  phonePreviewAvailable?: boolean
  noMusicAvailable?: boolean
  tiktokSafeAvailable?: boolean
  tiktokCaptionsAvailable?: boolean
  sourceCaptures?: { index: number; url: string; title: string; kind: 'source' | 'brand'; fetchedAt: string; screenshotAvailable?: boolean; pagePublishedAt?: string }[]
  claimEvidence?: CreatorSkillClaimEvidence[]
  reviewItems: string[]
}

async function key(clipId: string): Promise<string> {
  const user = await getStoredUser()
  if (!user) throw new Error('Sign in before using Clippster Skill.')
  return `clippster.creatorSkill.clip.${user.id}.${clipId}`
}

export async function getMobileCreatorSkillState(clipId: string): Promise<MobileCreatorSkillState | null> {
  const raw = await AsyncStorage.getItem(await key(clipId))
  if (!raw) return null
  try { return JSON.parse(raw) as MobileCreatorSkillState } catch { return null }
}

async function save(clipId: string, state: MobileCreatorSkillState) {
  await AsyncStorage.setItem(await key(clipId), JSON.stringify(state))
}

export async function clearMobileCreatorSkillState(clipId: string): Promise<void> {
  await AsyncStorage.removeItem(await key(clipId))
}

export async function reviewMobileCreatorSkillClaim(clipId: string, claimIndex: number, decision: 'source_checked' | 'label_checked' | 'needs_changes', note: string): Promise<MobileCreatorSkillState> {
  const state = await getMobileCreatorSkillState(clipId)
  if (!state?.webProjectId || !state.webClipId || !state.playbookPackage) throw new Error('The claim review is unavailable.')
  const workspace = await reviewCreatorSkillWebClaim(state.webProjectId, state.webClipId, claimIndex, decision, note)
  const updated = workspace.project.clips.find(clip => clip.id === state.webClipId)?.creatorSkill?.playbookPackage
  if (!updated) throw new Error('The claim review was saved, but could not be loaded. Reopen this clip.')
  const next = { ...state, playbookPackage: updated }
  await save(clipId, next)
  return next
}

export async function reviewMobileCreatorSkillFootage(clipId: string, footageIndex: number, decision: 'frame_checked' | 'needs_changes', note: string): Promise<MobileCreatorSkillState> {
  const state = await getMobileCreatorSkillState(clipId)
  if (!state?.webProjectId || !state.webClipId || !state.playbookPackage) throw new Error('The footage review is unavailable.')
  const workspace = await reviewCreatorSkillWebFootage(state.webProjectId, state.webClipId, footageIndex, decision, note)
  const updated = workspace.project.clips.find(clip => clip.id === state.webClipId)?.creatorSkill?.playbookPackage
  if (!updated) throw new Error('The footage review was saved, but could not be loaded. Reopen this clip.')
  const next = { ...state, playbookPackage: updated }
  await save(clipId, next)
  return next
}
export async function reviewMobileCreatorSkillFinding(clipId: string, finding: { reviewer: string; severity: 'fix_first' | 'should_fix' | 'ok'; outputTime: number; finding: string }): Promise<MobileCreatorSkillState> {
  const state = await getMobileCreatorSkillState(clipId)
  if (!state?.webProjectId || !state.webClipId || !state.playbookPackage) throw new Error('The independent review is unavailable.')
  const workspace = await reviewCreatorSkillWebFinding(state.webProjectId, state.webClipId, finding)
  const updated = workspace.project.clips.find(clip => clip.id === state.webClipId)?.creatorSkill?.playbookPackage
  if (!updated) throw new Error('The finding was saved, but could not be loaded. Reopen this clip.')
  const next = { ...state, playbookPackage: updated }
  await save(clipId, next)
  return next
}
export async function signOffMobileCreatorSkillReview(clipId: string, input: { reviewer: string; note: string }): Promise<MobileCreatorSkillState> {
  const state = await getMobileCreatorSkillState(clipId)
  if (!state?.webProjectId || !state.webClipId || !state.playbookPackage) throw new Error('The independent review is unavailable.')
  const workspace = await signOffCreatorSkillWebReview(state.webProjectId, state.webClipId, input)
  const updated = workspace.project.clips.find(clip => clip.id === state.webClipId)?.creatorSkill?.playbookPackage
  if (!updated) throw new Error('The signoff was saved, but could not be loaded. Reopen this clip.')
  const next = { ...state, playbookPackage: updated }
  await save(clipId, next)
  return next
}

function transcriptWords(rawJson: string): { word: string; start: number; end: number }[] {
  let parsed: unknown
  try { parsed = JSON.parse(rawJson) } catch { return [] }
  if (!parsed || typeof parsed !== 'object') return []
  const transcript = parsed as { words?: unknown[]; segments?: { words?: unknown[]; text?: string; start?: number; end?: number }[] }
  const words = transcript.words?.length ? transcript.words : transcript.segments?.flatMap(segment => segment.words?.length ? segment.words : [segment]) ?? []
  return words.flatMap(value => {
    if (!value || typeof value !== 'object') return []
    const row = value as Record<string, unknown>
    const word = typeof row.word === 'string' ? row.word : typeof row.text === 'string' ? row.text : ''
    const start = Number(row.start), end = Number(row.end)
    return word.trim() && Number.isFinite(start) && Number.isFinite(end) && end > start
      ? [{ word: word.trim().slice(0, 200), start, end }] : []
  })
}

async function editMobileClip(
  clip: { id: string; name: string | null }, webProjectId: string,
  onProgress: (job: WebJob) => void, maxCreditsPerClip: number, signal?: AbortSignal,
  previousWebClipId?: string,
): Promise<void> {
  const previous = await getMobileCreatorSkillState(clip.id)
  const state: MobileCreatorSkillState = { status: 'editing', creatorProfileId: previous?.creatorProfileId, webProjectId, webClipId: previousWebClipId, reviewItems: [] }
  await save(clip.id, state)
  try {
    const existing = previousWebClipId ? await getCreatorSkillWebProject(webProjectId, signal) : null
    let webClip: WebClip | undefined = existing?.project.clips.find(item => item.id === previousWebClipId)
    if (!webClip) {
      const segments = await getClipSegmentsByClipId(clip.id)
      const saved = await addCreatorSkillWebClip(webProjectId, {
        name: clip.name || 'Clip',
        segments: segments.map(part => ({ start_time: part.start_time, end_time: part.end_time })),
      }, signal)
      webClip = saved.project.clips.at(-1)
      if (!webClip) throw new Error('The web workspace did not save this clip.')
      state.webClipId = webClip.id
      await save(clip.id, state)
    }
    if (webClip.creatorSkill?.status !== 'needs_review') {
      // Await the job id even if cancellation arrives; it is required to cancel a paid run.
      const job = await startCreatorSkillWebClip(webProjectId, webClip.id, maxCreditsPerClip)
      let result
      try { result = await waitForCreatorSkillWebJob(job, onProgress, signal) }
      catch (error) { await cancelCreatorSkillWebJob(job.id).catch(() => {}); throw error }
      webClip = result.project.clips.find(item => item.id === webClip?.id)
    }
    if (!webClip || webClip.creatorSkill?.status !== 'needs_review') throw new Error(webClip?.creatorSkill?.reviewItems[0] || 'Clippster Skill did not finish this clip.')
    await saveCompletedMobileClip(clip.id, webProjectId, webClip)
  } catch (error) {
    await save(clip.id, { ...state, status: 'failed', reviewItems: [error instanceof Error ? error.message : 'Clippster Skill failed.'] })
    throw error
  }
}

async function saveCompletedMobileClip(localClipId: string, webProjectId: string, webClip: WebClip) {
  if (webClip.creatorSkill?.status !== 'needs_review') throw new Error('The remote edit is not ready.')
  const hadCompletedBuild = (await getClipBuildsByClipId(localClipId)).some(build => build.status === 'completed')
  const editedPath = await downloadCreatorSkillWebClip(webProjectId, webClip)
  const editedAspectRatio = webClip.builds?.at(-1)?.aspectRatio === '16:9' ? '16:9' : '9:16'
  const build = await createClipBuild({ clipId: localClipId, filePath: editedPath, aspectRatios: [editedAspectRatio] })
  await completeClipBuild(build.id, editedPath, undefined, webClip.builds?.at(-1)?.duration)
  if (!hadCompletedBuild) await setClipVersionPreference(localClipId, 'edited')
  const previous = await getMobileCreatorSkillState(localClipId)
  await save(localClipId, {
    status: 'needs_review', creatorProfileId: previous?.creatorProfileId, webProjectId, webClipId: webClip.id, editedPath, editedAspectRatio,
    playbookPackage: webClip.creatorSkill.playbookPackage,
    masterMd5: webClip.creatorSkill.masterMd5,
    thumbnailVariants: webClip.creatorSkill.thumbnailVariants,
    thumbnailCandidates: webClip.creatorSkill.thumbnailCandidates,
    contactSheetAvailable: webClip.creatorSkill.contactSheetAvailable,
    phonePreviewAvailable: webClip.creatorSkill.phonePreviewAvailable,
    noMusicAvailable: webClip.creatorSkill.noMusicAvailable,
    tiktokSafeAvailable: webClip.creatorSkill.tiktokSafeAvailable,
    tiktokCaptionsAvailable: webClip.creatorSkill.tiktokCaptionsAvailable,
    sourceCaptures: webClip.creatorSkill.sourceCaptures,
    claimEvidence: webClip.creatorSkill.claimEvidence,
    reviewItems: webClip.creatorSkill.reviewItems,
  })
}

/** Reconnect to an interrupted mobile view without starting or charging another AI run. */
export async function resumeMobileCreatorSkillClip(clipId: string): Promise<MobileCreatorSkillState | null> {
  const state = await getMobileCreatorSkillState(clipId)
  if (!state || state.status === 'needs_review' || state.status === 'failed') return state
  if (!state.webProjectId || !state.webClipId) {
    const interrupted = { ...state, status: 'failed' as const, reviewItems: ['Preparation was interrupted before the AI edit started. Retry only this clip when ready.'] }
    await save(clipId, interrupted)
    return interrupted
  }
  try {
    let workspace = await getCreatorSkillWebProject(state.webProjectId)
    const active = workspace.jobs.find(job => job.kind === 'creator_skill' && job.clipId === state.webClipId && ['queued', 'running'].includes(job.status))
    if (active) workspace = await waitForCreatorSkillWebJob(active, () => {})
    const clip = workspace.project.clips.find(item => item.id === state.webClipId)
    if (clip?.creatorSkill?.status === 'needs_review') {
      await saveCompletedMobileClip(clipId, state.webProjectId, clip)
    } else if (clip?.creatorSkill?.status === 'failed') {
      await save(clipId, { ...state, status: 'failed', reviewItems: clip.creatorSkill.reviewItems })
    } else if (!active) {
      await save(clipId, { ...state, status: 'failed', reviewItems: ['The remote edit is not running. Check Billing before starting another paid run.'] })
    }
  } catch (error) {
    await save(clipId, { ...state, reviewItems: [error instanceof Error ? error.message : 'Could not reconnect to the AI edit. Return to this clip to check again.'] })
  }
  return getMobileCreatorSkillState(clipId)
}

/** Process only clips just created by this detection session; retries always require a separate user action. */
export async function preEditMobileDetection(projectId: string, sessionId: string, onProgress: (message: string, percent: number) => void, maxCreditsPerClip: number, signal?: AbortSignal, creatorProfileId?: number | null): Promise<void> {
  const [project, rawVideo, transcript, clips] = await Promise.all([
    getProject(projectId), getRawVideoByProjectId(projectId), getTranscriptByProjectId(projectId), getProjectClipRows(projectId),
  ])
  if (!project || !rawVideo?.file_path) throw new Error('The downloaded VOD is unavailable.')
  const detected = clips.filter(clip => clip.detection_session_id === sessionId)
  if (!detected.length) return
  for (const clip of detected) await save(clip.id, { status: 'queued', creatorProfileId, reviewItems: [] })
  onProgress('Uploading the downloaded VOD for Clippster Skill…', 0)
  let webProjectId: string
  try {
    const workspace = await ensureCreatorSkillWebProject(projectId, project.name, rawVideo.file_path, ratio => onProgress('Uploading the downloaded VOD for Clippster Skill…', Math.round(ratio * 60)), signal, creatorProfileId)
    webProjectId = workspace.project.id
    if (transcript?.raw_json) await setCreatorSkillWebTranscript(webProjectId,
      transcriptWords(transcript.raw_json).filter(word => detected.some(clip => word.end > (clip.start_time ?? 0) && word.start < (clip.end_time ?? 0))), signal)
  } catch (error) {
    const reason = signal?.aborted ? 'Clippster Skill VOD preparation was cancelled.' : `Could not prepare the downloaded VOD for pre-editing: ${error instanceof Error ? error.message : String(error)}`
    await Promise.all(detected.map(clip => save(clip.id, { status: 'failed', creatorProfileId, reviewItems: [reason] })))
    throw error
  }
  for (const [index, clip] of detected.entries()) {
    signal?.throwIfAborted()
    try {
      await editMobileClip(clip, webProjectId, (current) => onProgress(`Pre-editing ${index + 1} of ${detected.length}: ${current.message}`, 60 + Math.round((index + current.progress / 100) / detected.length * 35)), maxCreditsPerClip, signal)
    } catch (error) {
      if (signal?.aborted) throw error
      // Keep preparing other detected clips; this one remains failed for explicit retry.
    }
  }
  onProgress('Clippster Skill processing finished. Review each clip.', 100)
}

async function prepareSingleMobileCreatorSkill(clipId: string, onProgress: (message: string, percent: number) => void, maxCreditsPerClip: number, signal?: AbortSignal, previous?: MobileCreatorSkillState | null, creatorProfileId?: number | null): Promise<void> {
  const clip = await getClipById(clipId)
  if (!clip?.project_id) throw new Error('The source project is unavailable.')
  const [project, rawVideo, transcript] = await Promise.all([
    getProject(clip.project_id), getRawVideoByProjectId(clip.project_id), getTranscriptByProjectId(clip.project_id),
  ])
  if (!project || !rawVideo?.file_path) throw new Error('The downloaded VOD is unavailable.')
  const selectedProfileId = creatorProfileId === undefined ? previous?.creatorProfileId : creatorProfileId
  await save(clipId, { status: 'queued', creatorProfileId: selectedProfileId, webProjectId: previous?.webProjectId, webClipId: previous?.webClipId, reviewItems: [] })
  let webProjectId: string
  try {
    const workspace = await ensureCreatorSkillWebProject(project.id, project.name, rawVideo.file_path, ratio => onProgress('Uploading VOD…', Math.round(ratio * 60)), signal, selectedProfileId)
    webProjectId = workspace.project.id
    if (transcript?.raw_json) await setCreatorSkillWebTranscript(webProjectId,
      transcriptWords(transcript.raw_json).filter(word => word.end > (clip.start_time ?? 0) && word.start < (clip.end_time ?? 0)), signal)
  } catch (error) {
    await save(clipId, { status: 'failed', creatorProfileId: selectedProfileId, webProjectId: previous?.webProjectId, webClipId: previous?.webClipId, reviewItems: [`Could not prepare the downloaded VOD for pre-editing: ${error instanceof Error ? error.message : String(error)}`] })
    throw error
  }
  await editMobileClip(clip, webProjectId, job => onProgress(job.message, job.progress), maxCreditsPerClip, signal, previous?.webClipId)
}

/** Start a previously Raw detected VOD clip only after a separate one-clip cost approval. */
export async function startMobileCreatorSkill(clipId: string, onProgress: (message: string, percent: number) => void, maxCreditsPerClip: number, signal?: AbortSignal, creatorProfileId: number | null = null): Promise<void> {
  if (await getMobileCreatorSkillState(clipId)) throw new Error('This clip already has a Clippster Skill edit or retry state.')
  const clip = await getClipById(clipId)
  if (!clip?.detection_session_id) throw new Error('Clippster Skill starts from an automatically detected VOD clip.')
  await prepareSingleMobileCreatorSkill(clipId, onProgress, maxCreditsPerClip, signal, null, creatorProfileId)
}

/** Explicit paid retry for one failed clip; never repeats a completed detection session. */
export async function retryMobileCreatorSkill(clipId: string, onProgress: (message: string, percent: number) => void, maxCreditsPerClip: number, signal?: AbortSignal): Promise<void> {
  const previous = await getMobileCreatorSkillState(clipId)
  if (previous?.status !== 'failed') throw new Error('This clip is not ready to retry.')
  await prepareSingleMobileCreatorSkill(clipId, onProgress, maxCreditsPerClip, signal, previous)
}

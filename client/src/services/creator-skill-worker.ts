import { join, videoDir } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { exists, writeFile } from '@tauri-apps/plugin-fs';
import * as videoApi from '@/ai-video/api';
import { runAgent } from '@/ai-video/agent/run';
import { timeCreatorSkillStage } from '@/services/creatorSkillTiming';
import { creatorLayoutIssues } from '@/ai-video/director/creatorLayout';
import { importMediaFiles } from '@/ai-video/analysis/media';
import { measureVideo } from '@/ai-video/analysis/shared';
import { exportFiles, linkProjectMedia, syncWorkspace } from '@/ai-video/runtime/project';
import { HyperframesWorkspace } from '@/ai-video/runtime/workspace';
import { hyperframesRequest } from '@/ai-video/runtime/hyperframesClient';
import { creatorSkillSoundScanReview } from '@/services/creatorSkillSoundScan';
import type { CreatorSkillClipEdit, CreatorSkillPackage, CreatorSkillSoundScan } from '@clippster/shared-types';
import { extractUnbuiltClipSegmentsToPath } from '@/services/clip-vod-extract';
import { getCreatorSkillEdit, getCreatorSkillEditsForSession, getInterruptedCreatorSkillEdits, saveCreatorSkillEdit } from '@/services/database/creator-skill-edits';
import { getClip, getCreatorProfileByProjectId, getProject, getTranscriptByProjectId } from '@/services/database';
import { resolveIntroOutroById } from '@/services/database/intro-outros';
import { creatorSkillProfileAssetIds } from '@/services/creatorSkillProfileAssets';
import type { VideoSession } from '@/ai-video/types';
import { assertCreatorSkillSpeechPreserved, auditCreatorSkillSourceAudio, auditCreatorSkillWordCoverage } from '@/services/creatorSkillQa';
import { speechForCreatorSkillClip, wordSpeechForCreatorSkillClip } from '@/services/creatorSkillSpeech';
import { creatorSkillFinalSrt, draftCreatorSkillSrt } from '@/services/creatorSkillCaptions';
import { transcribeCreatorSkillFinalAudio } from '@/services/creatorSkillFinalTranscriptionDesktop';
import { compareCreatorSkillFinalSpeech, creatorSkillFinalSpeechReport, creatorSkillFinalSpeechReview } from '@/services/creatorSkillFinalSpeech';
import { parseCreatorSkillPreferences } from '@/services/creatorSkillPreferences';
import { creatorSkillRequest, CREATOR_SKILL_EDITORIAL_VERSION } from '@/services/creatorSkillRequest';
import { reconcileCreatorSkillResearch, reconcileCreatorSkillSponsors } from '@/services/creatorSkillPackage';
import { renderCreatorSkillThumbnailDrafts, selectCreatorSkillSourceStills } from '@/services/creatorSkillThumbnailDesktop';
import { creatorSkillThumbnailTimes } from '@/services/creatorSkillThumbnailSelection';
import { creatorSkillBrandLogo } from '@/services/creatorSkillBrandLogo';
import { captureCreatorSkillDesktopSources } from '@/services/creatorSkillSourceCapturesDesktop';
import { auditCreatorSkillLabels } from '@/services/creatorSkillLabelAudit';
import { addCreatorSkillSourceCards } from '@/services/creatorSkillSourceCards';
import { applyCreatorSkillFootageCrops } from '@/services/creatorSkillFootageCrop';
import { prepareCreatorSkillAiCaptions, hasCreatorSkillAiCaptions, creatorSkillCaptionTiming } from '@/services/creatorSkillAiCaptions';
import { addCreatorSkillSponsorDisclosure } from '@/services/creatorSkillSponsorDisclosure';
import { auditCreatorSkillRemovedAudio } from '@/services/creatorSkillRemovedAudio';
import { creatorSkillTikTokCut } from '@/services/creatorSkillPlatformCut';
import { creatorSkillPreviewLimitMb } from '@/services/creatorSkillPreviewLimit';
import { auditCreatorSkillEditorialPackage } from '@/services/creatorSkillEditorialAudit';
import { finalizeCreatorSkillChapters } from '@/services/creatorSkillChapters';
import { auditCreatorSkillPresentation } from '@/services/creatorSkillPresentationAudit';
import { creatorSkillAutomatedQaBlockers } from '@/services/creatorSkillAutomatedQa';
import { creatorSkillAssetAudioReview } from '@/services/creatorSkillAssetAudio';
import { applyCreatorSkillAudioPermissions } from '@/services/creatorSkillAudioPermissions';
import { addCreatorSkillHookTitle } from '@/services/creatorSkillHookTitle';
import { addCreatorSkillChapterCards } from '@/services/creatorSkillChapterCards';
import { auditCreatorSkillStreamTiming } from '@/services/creatorSkillStreamTiming';
import { creatorSkillFormatForDuration, type WordInfo } from '@clippster/shared-types';
import { runCreatorSkillBatch, withCreatorSkillEditSlot, withCreatorSkillRenderSlot } from '@/services/creatorSkillScheduler';
import type { CreatorSkillSourceCache } from '@/services/creatorSkillSourceCapturesDesktop';

const runningSessions = new Set<string>();
const runningClips = new Set<string>();

type SharedRunContext = {
  transcripts: Map<string, ReturnType<typeof getTranscriptByProjectId>>;
  profiles: Map<string, ReturnType<typeof getCreatorProfileByProjectId>>;
  assets: Map<string, ReturnType<typeof resolveIntroOutroById>>;
  inspectedAssets: Map<string, ReturnType<typeof importMediaFiles>>;
  sourcePages: CreatorSkillSourceCache;
  researchSources: Map<string, CreatorSkillPackage['sources'][number]>;
  brandReferences: Map<string, NonNullable<CreatorSkillPackage['brandReferences']>[number]>;
};

function sharedRunContext(): SharedRunContext {
  return { transcripts: new Map(), profiles: new Map(), assets: new Map(), inspectedAssets: new Map(), sourcePages: new Map(), researchSources: new Map(), brandReferences: new Map() };
}

function sharedLookup<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let result = cache.get(key);
  if (!result) {
    result = load();
    cache.set(key, result);
    void result.catch(() => {
      if (cache.get(key) === result) cache.delete(key);
    });
  }
  return result;
}

/** Called after the user opts in and pays for the detection job. */
export async function approveCreatorSkillSession(sessionId: string, parentProjectId?: string | null): Promise<void> {
  for (const edit of await getCreatorSkillEditsForSession(sessionId)) {
    if (edit.status !== 'awaiting_approval') continue;
    edit.status = 'queued';
    await saveCreatorSkillEdit(edit);
  }
  await processCreatorSkillSession(sessionId, parentProjectId);
}

/** A retry is a user action. Reuse a finished AI session; restart an unfinished run only on request. */
export async function retryCreatorSkillEdit(clipId: string): Promise<void> {
  const edit = await getCreatorSkillEdit(clipId);
  if (!edit || edit.status !== 'failed') throw new Error('This Clippster Skill edit is not ready to retry.');
  const previous = edit.aiSessionId ? await videoApi.getSession(edit.aiSessionId).catch(() => null) : null;
  if (previous?.running_run) {
    await videoApi.failRun(previous.running_run.id, 'The user retried this prepaid Clippster Skill edit.');
  }
  if (!previous?.document || !edit.playbookPackage) {
    edit.playbookPackage = undefined;
    edit.sourceCaptures = undefined;
    edit.claimEvidence = undefined;
    edit.sources = [];
  }
  edit.edited = undefined;
  edit.reviewItems = [];
  edit.status = 'queued';
  await saveCreatorSkillEdit(edit);
  const clip = await getClip(clipId);
  const project = clip?.project_id ? await getProject(clip.project_id) : null;
  void withCreatorSkillEditSlot(() => processCreatorSkillEdit(edit, edit.detectionSessionId, project?.parent_id, sharedRunContext())).catch((error) => {
    console.error('[Clippster Skill] Retry could not start:', error);
  });
}

export async function resumeCreatorSkillEdits(): Promise<void> {
  const interrupted = await getInterruptedCreatorSkillEdits();
  for (const edit of interrupted) {
    if (edit.status !== 'queued' && !edit.aiSessionId) {
      edit.status = 'queued';
      await saveCreatorSkillEdit(edit);
    }
  }
  for (const sessionId of new Set(interrupted.map((edit) => edit.detectionSessionId))) {
    const clip = await getClip(interrupted.find((edit) => edit.detectionSessionId === sessionId)!.clipId);
    const project = clip?.project_id ? await getProject(clip.project_id) : null;
    await processCreatorSkillSession(sessionId, project?.parent_id);
  }
}

/** Process the clips of one detection run. Each clip keeps its own raw source and failure state. */
export async function processCreatorSkillSession(sessionId: string, parentProjectId?: string | null): Promise<void> {
  if (runningSessions.has(sessionId)) return;
  runningSessions.add(sessionId);
  try {
    const edits = (await getCreatorSkillEditsForSession(sessionId)).filter(edit =>
      edit.status === 'queued' || (['editing', 'rendering'].includes(edit.status) && edit.aiSessionId));
    const shared = sharedRunContext();
    await runCreatorSkillBatch(edits, edit => withCreatorSkillEditSlot(() => processCreatorSkillEdit(edit, sessionId, parentProjectId, shared)));
  } finally {
    runningSessions.delete(sessionId);
  }
}

async function processCreatorSkillEdit(edit: CreatorSkillClipEdit, sessionId: string, parentProjectId: string | null | undefined, shared: SharedRunContext): Promise<void> {
    if (runningClips.has(edit.clipId)) return;
    runningClips.add(edit.clipId);
    try {
      if (!edit.rawSource.segments.length) throw new Error('The detected clip has no valid source range.');
      edit.status = 'editing';
      await saveCreatorSkillEdit(edit);

      const rawPath = await invoke<string>('get_editor_clip_extract_path', {
        projectId: `creator-skill-${sessionId}`,
        clipId: edit.clipId,
      });
      if (!edit.rawClipMd5 || !await exists(rawPath)) {
        await extractUnbuiltClipSegmentsToPath({
          clipId: edit.clipId,
          segments: edit.rawSource.segments,
          outputPath: rawPath,
          rawVideoParentProjectId: parentProjectId,
        });
      }
      edit.rawClipMd5 = await invoke<string>('hash_creator_skill_file', { filePath: rawPath }).catch(() => undefined);
      await saveCreatorSkillEdit(edit);
      const { items, failed } = await importMediaFiles([{ path: rawPath }], []);
      if (failed.length || !items.length) throw new Error(failed[0]?.error || 'Could not inspect the extracted clip.');
      const skillFormat = creatorSkillFormatForDuration(items[0].duration);
      const clip = await getClip(edit.clipId);
      const projectId = clip?.project_id ?? parentProjectId;
      const transcript = projectId ? await sharedLookup(shared.transcripts, projectId, () => getTranscriptByProjectId(projectId)) : null;
      const speech = transcript ? speechForCreatorSkillClip(transcript.raw_json, edit.rawSource.segments) : [];
      const sourceWords = transcript ? wordSpeechForCreatorSkillClip(transcript.raw_json, edit.rawSource.segments) : [];
      const profile = projectId
        ? await sharedLookup(shared.profiles, projectId, () => getCreatorProfileByProjectId(projectId)) ?? (parentProjectId ? await sharedLookup(shared.profiles, parentProjectId, () => getCreatorProfileByProjectId(parentProjectId)) : null)
        : null;
      const profilePreferences = profile ? parseCreatorSkillPreferences(profile.creator_skill_preferences) : undefined;
      const brandAssetIssues: string[] = [];
      const availableAssets: Array<{ role: 'intro' | 'outro'; mediaId: string; name: string }> = [];
      const brandMedia = [] as typeof items;
      const selectedAssets = profile ? creatorSkillProfileAssetIds(profile, skillFormat) : {};
      for (const role of ['intro', 'outro'] as const) {
        const assetId = selectedAssets[role];
        if (!assetId) continue;
        const asset = await sharedLookup(shared.assets, String(assetId), () => resolveIntroOutroById(String(assetId)));
        if (!asset) {
          brandAssetIssues.push(`The saved creator ${role} could not be loaded; review the end-card branding.`);
          continue;
        }
        const inspected = await sharedLookup(shared.inspectedAssets, asset.filePath, () => importMediaFiles([{ path: asset.filePath }], []));
        const media = inspected.items[0];
        if (!media || [...items, ...brandMedia].some(item => item.contentHash === media.contentHash)) {
          brandAssetIssues.push(`The saved creator ${role} could not be added to the AI edit; review the end-card branding.`);
          continue;
        }
        const clipMedia = { ...media, id: `m${items.length + brandMedia.length + 1}`, name: `Creator ${role}` };
        brandMedia.push(clipMedia);
        const audioIssue = creatorSkillAssetAudioReview(role, clipMedia.hasAudio, profilePreferences?.editing?.musicAllowed === true);
        if (audioIssue) brandAssetIssues.push(audioIssue);
        availableAssets.push({ role, mediaId: clipMedia.id, name: clipMedia.name });
      }
      const profileContext = profile ? {
        name: profile.name,
        description: profile.description,
        preferences: profilePreferences!,
        availableAssets,
      } : null;
      edit.creatorProfile = profileContext ? { name: profileContext.name, preferences: profileContext.preferences } : undefined;
      let request = creatorSkillRequest(profileContext, skillFormat, {
        sources: [...shared.researchSources.values()],
        brandReferences: [...shared.brandReferences.values()],
      });

      request += '\n\n' + creatorSkillCaptionTiming(sourceWords);

      const session = edit.aiSessionId
        ? await videoApi.getSession(edit.aiSessionId)
        : await videoApi.createSession({
            name: `Clippster Skill ${edit.clipId}`,
            media_items: [...items, ...brandMedia],
            speech_index: speech.length ? { [items[0].contentHash]: speech } : {},
            playbook_enabled: true,
            creator_skill_job_id: edit.prepaidJobId,
            creator_profile_id: typeof profile?.server_id === 'number' ? profile.server_id : null,
            motion_graphics: 'light',
            aspect_ratio: skillFormat,
          });
      if (!edit.aiSessionId) {
        edit.aiSessionId = session.id;
        await saveCreatorSkillEdit(edit);
      }
      const workspace = await HyperframesWorkspace.open(session.id);
      const policy = await videoApi.getPolicy();
      let generated: VideoSession;
      let editorNotes: string;
      if (session.document?.creatorSkillEditorialVersion === CREATOR_SKILL_EDITORIAL_VERSION && !creatorLayoutIssues(session.document, session.media_items[0]?.id ?? '').length && (!speech.length || hasCreatorSkillAiCaptions(session.document))) {
        if (!edit.playbookPackage) throw new Error('The completed AI edit has no saved playbook package; review it before publishing.');
        generated = session;
        editorNotes = session.messages[session.messages.length - 1]?.content ?? '';
      } else {
        const result = await timeCreatorSkillStage(edit.clipId, 'ai-edit', () => runAgent({
          session,
          kind: 'generate',
          request,
          workspace,
          policy,
          exampleMeasurement: null,
          requirePlaybookPackage: true,
          maxCredits: 0,
          callbacks: {
            onPlaybookPackage: async (item, researchFetches) => {
              edit.playbookPackage = reconcileCreatorSkillResearch(
                reconcileCreatorSkillSponsors(item, profileContext?.preferences), researchFetches,
              );
              edit.sources = edit.playbookPackage.sources;
              for (const source of edit.playbookPackage.sources) shared.researchSources.set(source.url, source);
              for (const brand of edit.playbookPackage.brandReferences ?? []) shared.brandReferences.set(brand.sourceUrl, brand);
              await saveCreatorSkillEdit(edit);
            },
          },
        }));
        generated = result.session;
        if (generated.document) generated = await videoApi.updateSession(generated.id, {
          document: { ...generated.document, creatorSkillEditorialVersion: CREATOR_SKILL_EDITORIAL_VERSION },
        });
        editorNotes = result.message;
      }
      if (!generated.document) throw new Error('The AI editor did not return an edit.');
      const editedMedia = generated.media_items[0];
      if (!editedMedia) throw new Error('The saved AI edit has no source media.');
      const selectedOutro = generated.media_items.find(item => item.name === 'Creator outro');
      const sourceCaptures = edit.playbookPackage
        ? await timeCreatorSkillStage(edit.clipId, 'source-capture', () => captureCreatorSkillDesktopSources(edit.clipId, edit.playbookPackage!, shared.sourcePages))
        : { captures: [], claimEvidence: [], reviewItems: ['The edit has no saved source package; inspect every factual claim.'] };
      edit.sourceCaptures = sourceCaptures.captures;
      edit.claimEvidence = sourceCaptures.claimEvidence;
      await saveCreatorSkillEdit(edit);
      const audioPermissions = applyCreatorSkillAudioPermissions(generated.document, profileContext?.preferences);
      const sponsor = addCreatorSkillSponsorDisclosure(audioPermissions.document, generated.composition_files ?? {}, speech, edit.playbookPackage, editedMedia.id);
      const cards = addCreatorSkillSourceCards(sponsor.document, sponsor.files, editedMedia.id, edit.playbookPackage, new Set(sourceCaptures.captures.map(capture => capture.url)), new Map(sourceCaptures.captures.filter(capture => capture.pagePublishedAt).map(capture => [capture.url, capture.pagePublishedAt!])));
      const crops = applyCreatorSkillFootageCrops(cards.document, editedMedia, edit.playbookPackage);
      const hook = addCreatorSkillHookTitle(crops.document, cards.files);
      const chapters = addCreatorSkillChapterCards(hook.document, hook.files, edit.playbookPackage);
      const onScreenCaptions = prepareCreatorSkillAiCaptions(chapters.document, chapters.files);
      const captionReviewItems = ['Review the AI-designed caption timing, wording, and placement against the finished audio.'];
      if (audioPermissions.removedMusic || sponsor.added || cards.added || crops.applied || hook.added || chapters.added || onScreenCaptions.changed) generated = await videoApi.updateSession(generated.id, { document: onScreenCaptions.document, composition_files: onScreenCaptions.files });
      if (!generated.document) throw new Error('Could not save the source label timeline.');

      edit.status = 'rendering';
      await saveCreatorSkillEdit(edit);
      const context = await linkProjectMedia(workspace, generated.media_items);
      if (audioPermissions.removedMusic || sponsor.added || cards.added || crops.applied || hook.added || chapters.added || onScreenCaptions.changed) await syncWorkspace(workspace, generated.composition_files ?? {}, generated.document, context);
      const outputPath = await join(await videoDir(), `creator-skill-${edit.clipId}.mp4`);
      const rendered = await timeCreatorSkillStage(edit.clipId, 'render-with-queue', () => withCreatorSkillRenderSlot(() => workspace.render(outputPath, {
        fps: generated.document!.format.fps,
        files: exportFiles(generated.composition_files ?? {}, generated.document!, context),
      })));
      const tiktok = creatorSkillTikTokCut(generated.document, editedMedia.id, speech, edit.playbookPackage, generated.composition_files ?? {});
      const tiktokCaptions = tiktok.document ? prepareCreatorSkillAiCaptions(tiktok.document, generated.composition_files ?? {}) : null;

      let tiktokSafePath: string | undefined;
      let tiktokCaptionsPath: string | undefined;
      let tiktokRenderIssue: string | undefined;
      if (tiktokCaptions) {
        try {
          const candidate = await withCreatorSkillRenderSlot(async () => workspace.render(await join(await videoDir(), `creator-skill-${edit.clipId}-tiktok-no-sponsor.mp4`), {
            fps: tiktokCaptions.document.format.fps,
            files: exportFiles(tiktokCaptions.files, tiktokCaptions.document, context),
          }));
          const check = await invoke<{ fully_decoded: boolean }>('check_creator_skill_export', { filePath: candidate.outputPath, maxPreviewMb: creatorSkillPreviewLimitMb(profileContext?.preferences.delivery?.previewMaxMb) });
          if (!check.fully_decoded) throw new Error('Full decode failed.');
          tiktokSafePath = candidate.outputPath;
          if (speech.length) {
            const captions = draftCreatorSkillSrt(tiktokCaptions.document, editedMedia.id, speech);
            if (captions.omitted) tiktok.reviewItems.push(`${captions.omitted} transcript segment${captions.omitted === 1 ? '' : 's'} crossed the TikTok cut; check the final spoken line and captions.`);
            if (captions.content) {
              const captionTarget = await join(await videoDir(), `creator-skill-${edit.clipId}-tiktok-no-sponsor.srt`);
              try {
                await writeFile(captionTarget, new TextEncoder().encode(captions.content));
                tiktokCaptionsPath = captionTarget;
              } catch { tiktokRenderIssue = 'Could not prepare captions for the sponsor-free TikTok cut; review its speech before posting.'; }
            }
          }
        } catch {
          tiktokRenderIssue = 'Could not render or decode the sponsor-free TikTok cut; do not post the sponsored master to TikTok.';
        }
      }
      let audioNormalizationIssue: string | undefined;
      let masterPath = editedMedia.hasAudio
        ? await invoke<string>('normalize_creator_skill_audio', { filePath: rendered.outputPath }).catch(error => {
            audioNormalizationIssue = `Could not normalize and verify final audio; using the original master. ${error instanceof Error ? error.message : String(error)}`;
            return rendered.outputPath;
          })
        : rendered.outputPath;
      const [visualCheck, flashCheck, sourceSilence, exportCheck] = await Promise.all([
        timeCreatorSkillStage(edit.clipId, 'visual-check', () => workspace.check()).catch(() => null),
        timeCreatorSkillStage(edit.clipId, 'flash-check', () => measureVideo(masterPath, { maxShotSeconds: null, keyframes: false })).catch(() => null),
        editedMedia.hasAudio
          ? timeCreatorSkillStage(edit.clipId, 'source-silence', () => invoke<string>('scan_creator_skill_source_silence', { filePath: rawPath })).catch(() => null)
          : Promise.resolve(null),
        timeCreatorSkillStage(edit.clipId, 'export-check', () => invoke<{
        duration: number;
        width: number;
        height: number;
        has_audio: boolean;
        fully_decoded: boolean;
        error: string | null;
        integrated_lufs: number | null;
        true_peak_dbtp: number | null;
        audio_measurement_error: string | null;
        contact_sheet_path: string | null;
        stream_duration_delta_ms: number | null;
        stream_start_delta_ms: number | null;
        phone_preview_path: string | null;
      }>('check_creator_skill_export', { filePath: masterPath, maxPreviewMb: creatorSkillPreviewLimitMb(profileContext?.preferences.delivery?.previewMaxMb) })),
      ]);
      if (!exportCheck.fully_decoded) throw new Error(`The edited export failed a full decode: ${exportCheck.error || 'unknown error'}. Raw remains available; retry the edit after checking the render.`);
      if (editedMedia.hasAudio && !exportCheck.has_audio) throw new Error('The edited export lost its source audio. Raw remains available; retry the edit.');
      const expectedDuration = generated.document.shots.reduce((total, shot) => total + shot.duration, 0);
      const wordIssues = auditCreatorSkillWordCoverage(generated.document, editedMedia.id, sourceWords);
      const removedAudioIssues = editedMedia.hasAudio && sourceSilence !== null
        ? auditCreatorSkillRemovedAudio(generated.document, editedMedia.id, editedMedia.duration, sourceSilence)
        : [];
      const sourceAudioIssues = auditCreatorSkillSourceAudio(generated.document, editedMedia.id, editedMedia.duration, editedMedia.hasAudio);
      assertCreatorSkillSpeechPreserved(wordIssues, removedAudioIssues, sourceAudioIssues, profileContext?.preferences.editing?.preserveEveryWord !== false);
      let finalWords: WordInfo[] = [];
      let finalSpeechReview = 'Final audio re-transcription was unavailable; compare the edited master with Raw before publishing.';
      let speechDiff: string | undefined;
      if (exportCheck.has_audio) {
        try {
          finalWords = await timeCreatorSkillStage(edit.clipId, 'final-transcription', () => transcribeCreatorSkillFinalAudio(masterPath, edit.clipId, exportCheck.duration));
          const comparison = compareCreatorSkillFinalSpeech(sourceWords.map(word => word.text), finalWords.map(word => word.word));
          finalSpeechReview = creatorSkillFinalSpeechReview(comparison);
          if (sourceWords.length && finalWords.length) speechDiff = creatorSkillFinalSpeechReport(comparison);
        } catch (error) {
          finalSpeechReview = `Final audio re-transcription failed: ${error instanceof Error ? error.message : String(error)}. Compare speech with Raw before publishing.`;
        }
      }
      if (tiktokSafePath && tiktok.document && finalWords.length) {
        const cutDuration = tiktok.document.shots.reduce((total, shot) => total + shot.duration, 0);
        const cutWords = finalWords.filter(word => word.end <= cutDuration + 0.01);
        if (cutWords.length) {
          try {
            const captionTarget = tiktokCaptionsPath ?? await join(await videoDir(), `creator-skill-${edit.clipId}-tiktok-no-sponsor.srt`);
            await writeFile(captionTarget, new TextEncoder().encode(creatorSkillFinalSrt(cutWords, skillFormat)));
            tiktokCaptionsPath = captionTarget;
          } catch {
            tiktokRenderIssue = 'Could not save final-audio captions for the sponsor-free TikTok cut.';
          }
        }
      }
      if (tiktokSafePath) {
        try {
          if (editedMedia.hasAudio) tiktokSafePath = await invoke<string>('normalize_creator_skill_audio', { filePath: tiktokSafePath });
          const check = await invoke<typeof exportCheck>('check_creator_skill_export', { filePath: tiktokSafePath, maxPreviewMb: creatorSkillPreviewLimitMb(profileContext?.preferences.delivery?.previewMaxMb) });
          if (!check.fully_decoded || (editedMedia.hasAudio && !check.has_audio)) throw new Error(check.error || 'The sponsor-free cut failed decode or lost source audio.');
          if (check.has_audio) {
            if (check.integrated_lufs === null || check.true_peak_dbtp === null) tiktok.reviewItems.push('Could not verify sponsor-free TikTok loudness and true peak; listen and measure before posting.');
            else {
              if (Math.abs(check.integrated_lufs + 14) > 2) tiktok.reviewItems.push(`Sponsor-free TikTok cut measures ${check.integrated_lufs} LUFS; review against the -14 LUFS target.`);
              if (check.true_peak_dbtp > -1) tiktok.reviewItems.push(`Sponsor-free TikTok cut peaks at ${check.true_peak_dbtp} dBTP; fix before posting.`);
            }
          }
        } catch (error) {
          tiktokSafePath = undefined;
          tiktokCaptionsPath = undefined;
          tiktokRenderIssue = `Could not verify the finished sponsor-free TikTok cut: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      let noMusicPath: string | undefined;
      let noMusicIssue: string | undefined;
      if (generated.document.music) {
        try {
          const noMusicDocument = { ...generated.document, music: null };
          const noMusicRender = await withCreatorSkillRenderSlot(async () => workspace.render(await join(await videoDir(), `creator-skill-${edit.clipId}-no-music.mp4`), {
            fps: noMusicDocument.format.fps,
            files: exportFiles(generated.composition_files ?? {}, noMusicDocument, context),
          }));
          const normalizedNoMusic = editedMedia.hasAudio
            ? await invoke<string>('normalize_creator_skill_audio', { filePath: noMusicRender.outputPath })
            : noMusicRender.outputPath;
          const noMusicCheck = await invoke<{ fully_decoded: boolean; has_audio: boolean }>('check_creator_skill_export', { filePath: normalizedNoMusic, maxPreviewMb: creatorSkillPreviewLimitMb(profileContext?.preferences.delivery?.previewMaxMb) });
          if (!noMusicCheck.fully_decoded || (editedMedia.hasAudio && !noMusicCheck.has_audio)) throw new Error('Full decode or source-audio check failed.');
          noMusicPath = normalizedNoMusic;
        } catch (error) {
          noMusicIssue = `Could not render the no-music version; deliver one before posting this talking clip. ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      const chapterResult = skillFormat === '16:9' ? finalizeCreatorSkillChapters(edit.playbookPackage, exportCheck.duration) : { item: edit.playbookPackage, reviewItems: [] };
      edit.playbookPackage = chapterResult.item;
      const soundScan = exportCheck.has_audio
        ? await hyperframesRequest<CreatorSkillSoundScan>('classifyAudioEvents', { path: masterPath }).catch(() => null)
        : null;
      const exportIssues = [
        ...(audioNormalizationIssue ? [audioNormalizationIssue] : []),
        ...(exportCheck.duration > 1200 ? ['The contact sheet covers only the first 20 minutes; inspect the remaining rendered frames separately.'] : []),
        ...brandAssetIssues,
        ...creatorSkillSoundScanReview(soundScan, exportCheck.has_audio),
        ...auditCreatorSkillPresentation(generated.document, selectedOutro?.id),
        ...(!edit.rawClipMd5 ? ['Could not hash the extracted Raw clip for the delivery manifest.'] : []),
        ...(Math.abs(exportCheck.duration - expectedDuration) > Math.max(0.5, 2 / generated.document.format.fps)
          ? [`Export duration ${exportCheck.duration.toFixed(2)}s differs from timeline ${expectedDuration.toFixed(2)}s.`]
          : []),
        ...(exportCheck.width !== generated.document.format.width || exportCheck.height !== generated.document.format.height
          ? ['Export dimensions differ from the editable timeline.'] : []),
        ...(exportCheck.has_audio && exportCheck.audio_measurement_error
          ? [`Could not measure final audio: ${exportCheck.audio_measurement_error}`] : []),
        ...(exportCheck.integrated_lufs !== null && Math.abs(exportCheck.integrated_lufs + 14) > 2
          ? [`Final audio measures ${exportCheck.integrated_lufs.toFixed(1)} LUFS; review against the -14 LUFS Short target.`] : []),
        ...(exportCheck.true_peak_dbtp !== null && exportCheck.true_peak_dbtp > -1
          ? [`Final audio true peak is ${exportCheck.true_peak_dbtp.toFixed(1)} dBTP; review against the -1 dBTP ceiling.`] : []),
        ...(!exportCheck.contact_sheet_path ? ['Could not prepare the visual contact sheet; inspect the whole rendered clip before publishing.'] : []),
        ...(!exportCheck.phone_preview_path ? [`Could not prepare a phone preview under ${creatorSkillPreviewLimitMb(profileContext?.preferences.delivery?.previewMaxMb)} MB; use the full export for review.`] : []),
        ...auditCreatorSkillStreamTiming(exportCheck.has_audio, exportCheck.stream_duration_delta_ms, exportCheck.stream_start_delta_ms),
        ...rendered.warnings,
        ...sourceAudioIssues,
        ...wordIssues,
        finalSpeechReview,
        ...(finalWords.length ? ['Final-audio captions use re-transcribed word times; proofread names, tickers, profanity masking, and cue breaks before publishing.'] : []),
        ...auditCreatorSkillEditorialPackage(edit.playbookPackage, editedMedia.duration, exportCheck.duration),
        ...chapterResult.reviewItems,
        ...(editedMedia.hasAudio && sourceSilence !== null
          ? removedAudioIssues
          : editedMedia.hasAudio ? ['Could not complete the 5 ms source silence scan; inspect all removed audio ranges.'] : []),
        ...auditCreatorSkillLabels(generated.document, editedMedia.id, edit.playbookPackage, generated.composition_files ?? {}),
        ...cards.reviewItems,
        ...crops.reviewItems,
        ...captionReviewItems,
        ...audioPermissions.reviewItems,
        ...hook.reviewItems,
        ...chapters.reviewItems,
        ...(noMusicIssue ? [noMusicIssue] : []),
        ...sponsor.reviewItems,
        ...tiktok.reviewItems,
        ...(tiktokRenderIssue ? [tiktokRenderIssue] : []),
        ...(flashCheck
          ? flashCheck.shots.flatMap(shot => [
              ...(shot.transitionIn === 'flash' ? [`Flash transition near ${shot.start.toFixed(2)}s.`] : []),
              ...shot.flashes.map(time => `Brief visual flash near ${time.toFixed(2)}s.`),
            ])
          : ['Automated flash scan was unavailable; check the rendered video for brief flashes.']),
      ];
      let captionsPath: string | undefined;
      if (finalWords.length || speech.length) {
        const captions = finalWords.length
          ? { content: creatorSkillFinalSrt(finalWords, skillFormat), omitted: 0 }
          : draftCreatorSkillSrt(generated.document, editedMedia.id, speech);
        if (captions.content) {
          try {
            captionsPath = await join(await videoDir(), `creator-skill-${edit.clipId}.srt`);
            await writeFile(captionsPath, new TextEncoder().encode(captions.content));
          } catch (error) {
            captionsPath = undefined;
            exportIssues.push(`Could not save the draft captions file: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        if (captions.omitted) exportIssues.push(`${captions.omitted} transcript segments crossed edit cuts and were omitted from draft captions; check the final audio.`);
        if (!captions.content) exportIssues.push('No caption cues mapped onto the edited timeline.');
      }
      edit.edited = {
        path: masterPath,
        masterMd5: await invoke<string>('hash_creator_skill_file', { filePath: masterPath }).catch(() => undefined),
        timeline: generated.document,
        assets: Object.keys(generated.composition_files ?? {}),
        captionsPath,
        contactSheetPath: exportCheck.contact_sheet_path ?? undefined,
        phonePreviewPath: exportCheck.phone_preview_path ?? undefined,
        noMusicPath,
        tiktokSafePath,
        tiktokCaptionsPath,
        editorNotes,
        speechDiff,
        soundScan: soundScan ?? undefined,
      };
      if (!edit.edited.masterMd5) exportIssues.push('Could not hash the edited master for the delivery manifest.');
      if (edit.playbookPackage && edit.edited.masterMd5) edit.playbookPackage.automatedQa = {
        masterMd5: edit.edited.masterMd5,
        blockers: creatorSkillAutomatedQaBlockers({
          document: generated.document, selectedOutroId: selectedOutro?.id,
          flashFindings: flashCheck ? flashCheck.shots.flatMap(shot => [
            ...(shot.transitionIn === 'flash' ? [`Flash transition near ${shot.start.toFixed(2)}s.`] : []),
            ...shot.flashes.map(time => `Brief visual flash near ${time.toFixed(2)}s.`),
          ]) : null,
          hasAudio: exportCheck.has_audio,
          audioMeasured: !exportCheck.audio_measurement_error && exportCheck.integrated_lufs !== null && exportCheck.true_peak_dbtp !== null,
          integratedLufs: exportCheck.integrated_lufs,
          truePeakDbtp: exportCheck.true_peak_dbtp,
          renderedDuration: exportCheck.duration, expectedDuration,
          renderedWidth: exportCheck.width, renderedHeight: exportCheck.height,
          streamDurationDeltaMs: exportCheck.stream_duration_delta_ms,
          streamStartDeltaMs: exportCheck.stream_start_delta_ms,
        }),
      };
      const stillTimes = creatorSkillThumbnailTimes(editedMedia.duration);
      const stillResults = await Promise.allSettled(stillTimes.map(async (sourceTime, index) => ({
        path: await invoke<string>('generate_thumbnail_at_timestamp', {
          videoPath: rawPath,
          timestampSeconds: sourceTime,
          outputFilename: `creator_skill_${edit.clipId}_${index}`,
        }),
        sourceTime,
      })));
      edit.thumbnailCandidates = stillResults.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      const thumbnailSelection = await selectCreatorSkillSourceStills(stillResults.flatMap((result, index) => result.status === 'fulfilled' ? [{ ...result.value, index }] : []));
      const proposedLogo = creatorSkillBrandLogo(edit.playbookPackage,
        new Set(edit.sourceCaptures?.filter(capture => edit.playbookPackage?.brandReferences?.some(brand => brand.sourceUrl === capture.url)).map(capture => capture.url)),
        edit.playbookPackage?.thumbnailHeadlines?.join(' '),
        new Map(edit.sourceCaptures?.filter(capture => capture.linkedLogoUrl).map(capture => [capture.url, capture.linkedLogoUrl!])));
      const logoPath = proposedLogo && edit.thumbnailCandidates.length && edit.playbookPackage?.thumbnailHeadlines?.length
        ? await invoke<string>('capture_creator_skill_logo', { url: proposedLogo.url, clipId: edit.clipId }).catch(() => undefined)
        : undefined;
      const thumbnailDrafts = await renderCreatorSkillThumbnailDrafts(edit.clipId, thumbnailSelection.stills, edit.playbookPackage?.thumbnailHeadlines ?? [], logoPath, profileContext?.preferences.brand?.colors);
      edit.thumbnailVariants = thumbnailDrafts.variants;
      edit.status = 'needs_review';
      edit.reviewItems = [
        ...exportIssues,
        ...(!edit.thumbnailCandidates.length ? ['Could not prepare local thumbnail stills from the source clip.'] : []),
        ...(!thumbnailSelection.faceDetectionAvailable ? ['Local face detection was unavailable; inspect all thumbnail candidate frames for a clear, current-day expression.'] : []),
        ...(thumbnailSelection.faceDetectionAvailable && !thumbnailSelection.faceFrames ? ['No face was detected in thumbnail candidate frames; choose a suitable frame manually if this clip features the creator.'] : []),
        ...(edit.thumbnailVariants.length < 4 ? ['Some thumbnail review drafts could not be rendered; check the source frames and headlines.'] : []),
        ...(edit.thumbnailVariants.length && !thumbnailDrafts.modelAvailable ? ['Local portrait cutout was unavailable; review the original-frame thumbnail drafts or create the cutout manually.'] : []),
        ...(thumbnailDrafts.modelAvailable && thumbnailDrafts.cutoutCount < edit.thumbnailVariants.length ? ['Some local portrait cutouts failed; inspect those thumbnail drafts for background and edge quality.'] : []),
        ...(thumbnailDrafts.cutoutCount ? ['Review portrait cutout edges before publishing; the local mask may miss hair, hands, or clothing.'] : []),
        ...(proposedLogo && edit.thumbnailCandidates.length && !logoPath ? [`Could not render proposed ${proposedLogo.name} logo; review its source and usage rights.`] : []),
        ...(logoPath ? [`Review ${proposedLogo!.name} logo identity and usage rights before publishing a thumbnail.`] : []),
        ...(edit.playbookPackage?.reviewItems ?? []),
        ...sourceCaptures.reviewItems,
        ...(visualCheck
          ? visualCheck.runtime.findings.concat(visualCheck.layout.findings, visualCheck.contrast.findings)
              .filter((finding) => finding.severity !== 'info')
              .map((finding) => finding.message)
          : ['Visual validation was unavailable.']),
        'Fact-check and source cards, speech preservation, audio, and final export QA require review.',
        ...(captionsPath ? [finalWords.length
          ? 'Final-audio SRT and burned vertical captions use the transcribed finished audio; proofread every cue against the master before publishing.'
          : 'Draft SRT captions were mapped from the source transcript; check every cue against the final rendered audio before publishing.'] : []),
        'Thumbnail, platform copy, and sponsor disclosures require review before publishing.',
        ...(!speech.length ? ['No timed transcript was available for the AI editor; check every spoken word against Raw.'] : []),
      ];
      await saveCreatorSkillEdit(edit);
    } catch (error) {
      console.error('[Clippster Skill] Edit failed:', edit.clipId, error);
      edit.status = 'failed';
      edit.reviewItems = [videoApi.isPaymentRequired(error)
        ? 'This edit was included in the detection charge. Your raw clip is still available.'
        : videoApi.apiErrorMessage(error, 'The AI edit failed.')];
      await saveCreatorSkillEdit(edit);
    } finally {
      runningClips.delete(edit.clipId);
    }
}

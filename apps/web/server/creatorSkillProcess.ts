import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { join } from 'node:path'
import type { WebClip, WebProject } from '@clippster/shared-types'
import type { Config } from './config'
import { CreatorSkillApi } from './creatorSkillApi'
import { extractCreatorSkillSource } from './creatorSkillSource'
import { runCreatorSkillAgent } from './creatorSkillAgent'
import { HyperframesBridge } from './hyperframesBridge'
import { WebHyperframesWorkspace } from './webHyperframesWorkspace'
import { creatorSkillRequest } from '../../../client/src/services/creatorSkillRequest'
import { creatorSkillProfileAssetIds } from '../../../client/src/services/creatorSkillProfileAssets'
import { speechForCreatorSkillClip, wordSpeechForCreatorSkillClip } from '../../../client/src/services/creatorSkillSpeech'
import { reconcileCreatorSkillResearch, reconcileCreatorSkillSponsors } from '../../../client/src/services/creatorSkillPackage'
import { draftCreatorSkillSrt } from '../../../client/src/services/creatorSkillCaptions'
import { linkProjectMedia, exportFiles } from '../../../client/src/ai-video/runtime/project'
import { probe } from './media'
import { run } from './process'
import { assertCreatorSkillSpeechPreserved, auditCreatorSkillSourceAudio, auditCreatorSkillWordCoverage } from '../../../client/src/services/creatorSkillQa'
import { CREATOR_SKILL_THUMBNAIL_SIZE, drawCreatorSkillThumbnail } from '../../../client/src/services/creatorSkillThumbnail'
import { scanCreatorSkillFlashes } from './creatorSkillFlashScan'
import { createCreatorSkillPhonePreview } from './creatorSkillPhonePreview'
import { captureCreatorSkillSources } from './creatorSkillSourceCaptures'
import { creatorSkillBrandLogo } from '../../../client/src/services/creatorSkillBrandLogo'
import { downloadAsset, openAsset } from './network'
import { auditCreatorSkillLabels } from '../../../client/src/services/creatorSkillLabelAudit'
import { addCreatorSkillSourceCards } from '../../../client/src/services/creatorSkillSourceCards'
import { applyCreatorSkillFootageCrops } from '../../../client/src/services/creatorSkillFootageCrop'
import { creatorSkillCaptionTiming, prepareCreatorSkillAiCaptions } from '../../../client/src/services/creatorSkillAiCaptions'
import { addCreatorSkillSponsorDisclosure } from '../../../client/src/services/creatorSkillSponsorDisclosure'
import { auditCreatorSkillRemovedAudio } from '../../../client/src/services/creatorSkillRemovedAudio'
import { creatorSkillTikTokCut } from '../../../client/src/services/creatorSkillPlatformCut'
import { creatorSkillPreviewLimitMb } from '../../../client/src/services/creatorSkillPreviewLimit'
import { auditCreatorSkillEditorialPackage } from '../../../client/src/services/creatorSkillEditorialAudit'
import { finalizeCreatorSkillChapters } from '../../../client/src/services/creatorSkillChapters'
import { auditCreatorSkillPresentation } from '../../../client/src/services/creatorSkillPresentationAudit'
import { creatorSkillAutomatedQaBlockers } from '../../../client/src/services/creatorSkillAutomatedQa'
import { creatorSkillAssetAudioReview } from '../../../client/src/services/creatorSkillAssetAudio'
import { applyCreatorSkillAudioPermissions } from '../../../client/src/services/creatorSkillAudioPermissions'
import { addCreatorSkillHookTitle } from '../../../client/src/services/creatorSkillHookTitle'
import { addCreatorSkillChapterCards } from '../../../client/src/services/creatorSkillChapterCards'
import { auditCreatorSkillStreamTiming } from '../../../client/src/services/creatorSkillStreamTiming'
import { creatorSkillFormatForDuration } from '@clippster/shared-types'
import { transcribeVideoWords } from './clipTranscription'
import { compareCreatorSkillFinalSpeech, creatorSkillFinalSpeechReport, creatorSkillFinalSpeechReview } from '../../../client/src/services/creatorSkillFinalSpeech'
import { creatorSkillFinalSrt } from '../../../client/src/services/creatorSkillCaptions'
import { creatorSkillFrameSharpness, creatorSkillThumbnailFaceScore, creatorSkillThumbnailTimes, selectCreatorSkillThumbnailStills } from '../../../client/src/services/creatorSkillThumbnailSelection'
import { normalizeCreatorSkillAudio } from './creatorSkillAudio'
import { creatorSkillSoundScanReview } from '../../../client/src/services/creatorSkillSoundScan'
import type { CreatorSkillSoundScan } from '@clippster/shared-types'

async function loadBrandLogo(item: NonNullable<WebClip['creatorSkill']>['playbookPackage'], capturedPages: ReadonlySet<string>, linkedLogos: ReadonlyMap<string, string>, headline: string, signal: AbortSignal) {
  const target = creatorSkillBrandLogo(item, capturedPages, headline, linkedLogos)
  if (!target) return null
  const response = await openAsset(target.url, AbortSignal.any([signal, AbortSignal.timeout(20_000)]), undefined, 0, new URL(target.url).hostname)
  const mime = String(response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) {
    response.destroy()
    throw new Error('The proposed logo is not a supported raster image.')
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of response) {
    size += chunk.length
    if (size > 5 * 1024 * 1024) { response.destroy(); throw new Error('The proposed logo exceeds 5 MB.') }
    chunks.push(chunk)
  }
  const image = await loadImage(Buffer.concat(chunks))
  if (image.width > 4096 || image.height > 4096) throw new Error('The proposed logo dimensions are too large.')
  return { image, width: image.width, height: image.height, name: target.name }
}

async function mediaHashes(path: string): Promise<{ sha256: string; md5: string }> {
  const sha = createHash('sha256')
  const md5 = createHash('md5')
  for await (const chunk of createReadStream(path)) { sha.update(chunk); md5.update(chunk) }
  return { sha256: sha.digest('hex'), md5: md5.digest('hex') }
}

/** Verify bytes after moving a rendered asset into its downloadable location. */
async function copyVerified(source: string, destination: string): Promise<string> {
  const expected = (await mediaHashes(source)).md5
  if (source !== destination) await copyFile(source, destination)
  const actual = (await mediaHashes(destination)).md5
  if (actual !== expected) throw new Error('The rendered file changed during transfer.')
  return actual
}

/** One detected web clip. Raw VOD ranges are saved before this function is called. */
export async function processCreatorSkillClip(options: {
  project: WebProject
  clip: WebClip
  directory: string
  config: Config
  token: string
  maxCreditsPerClip: number
  signal: AbortSignal
  save: () => void
  progress: (value: number, message: string) => void
}): Promise<void> {
  const { project, clip, directory, config, token, maxCreditsPerClip, signal, save, progress } = options
  const state = clip.creatorSkill
  if (!state || state.status !== 'queued') return
  const skillDir = join(directory, 'creator-skill', clip.id)
  await mkdir(skillDir, { recursive: true })
  const api = new CreatorSkillApi(config, token)
  let bridge: HyperframesBridge | null = null
  try {
    state.status = 'editing'
    save()
    progress(80, `Preparing ${clip.name} for Clippster Skill…`)
    const source = await extractCreatorSkillSource(clip, directory, skillDir, config, signal)
    const skillFormat = creatorSkillFormatForDuration(source.duration)
    const rawHashes = await mediaHashes(source.path)
    state.rawClipMd5 = rawHashes.md5
    save()
    const sourceMedia = [{
      id: randomUUID(), name: clip.name, kind: 'video' as const,
      path: source.path, duration: source.duration, width: source.width,
      height: source.height, hasAudio: source.hasAudio, contentHash: rawHashes.sha256,
    }]
    const clipRanges = clip.segments.map(part => ({ start: part.start_time, end: part.end_time }))
    const sourceTranscript = JSON.stringify({ words: project.words })
    const speech = speechForCreatorSkillClip(sourceTranscript, clipRanges)
    const sourceWords = wordSpeechForCreatorSkillClip(sourceTranscript, clipRanges)
    const existingSession = state.aiSessionId ? await api.session(state.aiSessionId) : null
    if (existingSession?.running_run) throw new Error('The previous AI edit may still be using credits. Check Billing before retrying.')
    const resumeRender = Boolean(existingSession?.document && existingSession.composition_files)
    const profile = project.creatorId ? await api.creatorProfile(project.creatorId, signal) : null
    state.creatorProfile = profile ? { name: profile.name, preferences: profile.preferences } : undefined
    const brandAssetIssues: string[] = []
    const availableAssets: Array<{ role: 'intro' | 'outro'; mediaId: string; name: string }> = []
    const brandMedia: typeof sourceMedia = []
    const selectedAssets = profile ? creatorSkillProfileAssetIds(profile, skillFormat) : {}
    if (!resumeRender && (selectedAssets.intro || selectedAssets.outro)) {
      const assets = await api.creatorAssets(signal)
      for (const role of ['intro', 'outro'] as const) {
        const assetId = selectedAssets[role]
        if (!assetId) continue
        const asset = assets.find(item => String(item.id) === assetId && item.asset_type === role)
        if (!asset?.url) {
          brandAssetIssues.push(`The saved creator ${role} could not be loaded; review the end-card branding.`)
          continue
        }
        try {
          const extension = ({ 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-matroska': 'mkv', 'video/x-msvideo': 'avi' } as Record<string, string>)[asset.mime_type?.toLowerCase() ?? ''] ?? 'mp4'
          const path = join(skillDir, `${role}-${randomUUID()}.${extension}`)
          await downloadAsset(asset.url, path, signal)
          const measured = await probe(path, config, signal)
          const hashes = await mediaHashes(path)
          const mediaId = randomUUID()
          brandMedia.push({ id: mediaId, name: `Creator ${role}`, kind: 'video', path, duration: measured.duration, width: measured.width, height: measured.height, hasAudio: measured.hasAudio, contentHash: hashes.sha256 })
          const audioIssue = creatorSkillAssetAudioReview(role, measured.hasAudio, profile?.preferences.editing?.musicAllowed === true)
          if (audioIssue) brandAssetIssues.push(audioIssue)
          availableAssets.push({ role, mediaId, name: `Creator ${role}` })
        } catch (error) {
          if (signal.aborted) throw error
          brandAssetIssues.push(`The saved creator ${role} could not be added to the AI edit; review the end-card branding.`)
        }
      }
    }
    const session = resumeRender ? existingSession! : await api.createSession([...sourceMedia, ...brandMedia], speech.length ? { [sourceMedia[0].contentHash]: speech } : {}, profile ? project.creatorId ?? null : null, skillFormat, signal)
    const media = session.media_items
    state.aiSessionId = session.id
    save()
    bridge = new HyperframesBridge(config.hyperframesScript)
    const workspace = await WebHyperframesWorkspace.open(bridge, join(skillDir, 'workspace'))
    const result = resumeRender ? { session } : await runCreatorSkillAgent({
      api, session, workspace, config, request: creatorSkillRequest(profile ? { ...profile, availableAssets } : null, skillFormat) + '\n\n' + creatorSkillCaptionTiming(sourceWords), maxCreditsPerClip, signal,
      onPlaybookPackage: async (item, fetches) => {
        state.playbookPackage = reconcileCreatorSkillResearch(reconcileCreatorSkillSponsors(item, profile?.preferences), fetches)
        save()
      },
    })
    signal.throwIfAborted()
    progress(87, `Capturing public sources for ${clip.name}…`)
    const sourceCaptures = state.playbookPackage
      ? await captureCreatorSkillSources(state.playbookPackage, skillDir, signal, (html, destination, highlightText, sourceUrl, capturedAt) => {
          return bridge!.request<{ highlighted: boolean }>('capturePageScreenshot', { html, destination, highlightText, sourceUrl, capturedAt }, { signal })
        }).catch(error => {
          if (signal.aborted) throw error
          return { captures: [], claimEvidence: [], reviewItems: ['Could not prepare public source captures; inspect every cited page directly.'] }
        })
      : { captures: [], claimEvidence: [], reviewItems: ['The edit has no saved source package; inspect every factual claim.'] }
    state.sourceCaptures = sourceCaptures.captures
    state.claimEvidence = sourceCaptures.claimEvidence
    save()
    if (!result.session.document) throw new Error('The AI editor did not save a timeline.')
    const audioPermissions = applyCreatorSkillAudioPermissions(result.session.document, profile?.preferences)
    const sponsor = addCreatorSkillSponsorDisclosure(audioPermissions.document, result.session.composition_files ?? {}, speech, state.playbookPackage, media[0].id)
    const cards = addCreatorSkillSourceCards(sponsor.document, sponsor.files, media[0].id, state.playbookPackage, new Set(sourceCaptures.captures.map(capture => capture.url)), new Map(sourceCaptures.captures.filter(capture => capture.pagePublishedAt).map(capture => [capture.url, capture.pagePublishedAt!])))
    const crops = applyCreatorSkillFootageCrops(cards.document, media[0], state.playbookPackage)
    const hook = addCreatorSkillHookTitle(crops.document, cards.files)
    const chapters = addCreatorSkillChapterCards(hook.document, hook.files, state.playbookPackage)
    const onScreenCaptions = prepareCreatorSkillAiCaptions(chapters.document, chapters.files)
    const editedSession = audioPermissions.removedMusic || sponsor.added || cards.added || crops.applied || hook.added || chapters.added || onScreenCaptions.changed
      ? await api.updateSession(result.session.id, onScreenCaptions.document, onScreenCaptions.files, signal)
      : result.session
    const document = editedSession.document
    if (!document) throw new Error('Could not save the source label timeline.')
    const selectedOutro = media.find(item => item.name === 'Creator outro')
    state.status = 'rendering'
    save()
    progress(90, `Rendering ${clip.name}…`)
    const buildId = randomUUID()
    const outputPath = join(directory, `${buildId}.mp4`)
    const context = await linkProjectMedia(workspace, result.session.media_items)
    const render = await workspace.render(outputPath, {
      fps: document.format.fps,
      files: exportFiles(editedSession.composition_files ?? {}, document, context),
      signal,
    })
    const tiktok = creatorSkillTikTokCut(document, media[0].id, speech, state.playbookPackage, editedSession.composition_files ?? {})
    const tiktokCaptions = tiktok.document ? prepareCreatorSkillAiCaptions(tiktok.document, editedSession.composition_files ?? {}) : null
    state.tiktokSafeAvailable = false
    state.tiktokCaptionsAvailable = false
    let tiktokRenderIssue: string | null = null
    if (tiktokCaptions) {
      const path = join(skillDir, 'tiktok-no-sponsor.mp4')
      state.tiktokSafeAvailable = await workspace.render(path, {
        fps: tiktokCaptions.document.format.fps,
        files: exportFiles(tiktokCaptions.files, tiktokCaptions.document, context), signal,
      }).then(async result => {
        await run(config.ffmpeg, ['-v', 'error', '-i', result.outputPath, '-map', '0:v:0', '-map', '0:a?', '-f', 'null', '-'], signal, 10 * 60_000)
        await copyVerified(result.outputPath, path)
        return true
      }).catch(error => {
        if (signal.aborted) throw error
        tiktokRenderIssue = 'Could not render or decode the sponsor-free TikTok cut; do not post the sponsored master to TikTok.'
        return false
      })
      if (state.tiktokSafeAvailable && speech.length) {
        const captions = draftCreatorSkillSrt(tiktokCaptions.document, media[0].id, speech)
        if (captions.omitted) tiktok.reviewItems.push(`${captions.omitted} transcript segment${captions.omitted === 1 ? '' : 's'} crossed the TikTok cut; check the final spoken line and captions.`)
        if (captions.content) state.tiktokCaptionsAvailable = await writeFile(join(skillDir, 'tiktok-no-sponsor.srt'), captions.content).then(() => true, () => false)
        if (!state.tiktokCaptionsAvailable) tiktokRenderIssue = 'Could not prepare captions for the sponsor-free TikTok cut; review its speech before posting.'
      }
      save()
    }
    const renderedProbe = await probe(render.outputPath, config, signal)
    const normalized = renderedProbe.hasAudio
      ? await normalizeCreatorSkillAudio(render.outputPath, skillDir, config, signal)
      : null
    const masterPath = normalized?.path ?? render.outputPath
    const output = masterPath === render.outputPath ? renderedProbe : await probe(masterPath, config, signal)
    const expected = document.shots.reduce((total, shot) => total + shot.duration, 0)
    const fullDecode = await run(config.ffmpeg, ['-v', 'error', '-i', masterPath, '-map', '0:v:0', '-map', '0:a?', '-f', 'null', '-'], signal, 10 * 60_000).then(() => true, () => false)
    if (!fullDecode) throw new Error('The edited export failed a full decode. Raw remains available; retry the edit after checking the render.')
    if (source.hasAudio && !output.hasAudio) throw new Error('The edited export lost its source audio. Raw remains available; retry the edit.')
    let finalWords: Awaited<ReturnType<typeof transcribeVideoWords>> = []
    let finalSpeechReview = 'Final audio re-transcription was unavailable; compare the edited master with Raw before publishing.'
    state.speechDiffAvailable = false
    if (output.hasAudio) {
      try {
        finalWords = await transcribeVideoWords(config, token, project.id, masterPath, output.duration, skillDir, signal)
        const comparison = compareCreatorSkillFinalSpeech(sourceWords.map(word => word.text), finalWords.map(word => word.word))
        finalSpeechReview = creatorSkillFinalSpeechReview(comparison)
        if (sourceWords.length && finalWords.length) {
          state.speechDiffAvailable = await writeFile(join(skillDir, 'speech-diff.md'), creatorSkillFinalSpeechReport(comparison)).then(() => true, () => false)
          if (!state.speechDiffAvailable) finalSpeechReview += ' Could not save the word comparison report.'
        }
      } catch (error) {
        if (signal.aborted) throw error
        finalSpeechReview = `Final audio re-transcription failed: ${error instanceof Error ? error.message : String(error)}. Compare speech with Raw before publishing.`
      }
    }
    if (state.tiktokSafeAvailable && tiktok.document && finalWords.length) {
      const cutDuration = tiktok.document.shots.reduce((total, shot) => total + shot.duration, 0)
      const cutWords = finalWords.filter(word => word.end <= cutDuration + 0.01)
      if (cutWords.length) {
        state.tiktokCaptionsAvailable = await writeFile(join(skillDir, 'tiktok-no-sponsor.srt'), creatorSkillFinalSrt(cutWords, skillFormat)).then(() => true, () => false)
        if (!state.tiktokCaptionsAvailable) tiktokRenderIssue = 'Could not save final-audio captions for the sponsor-free TikTok cut.'
      }
    }
    if (state.tiktokSafeAvailable) {
      try {
        const cutPath = join(skillDir, 'tiktok-no-sponsor.mp4')
        const cutProbe = await probe(cutPath, config, signal)
        if (source.hasAudio && !cutProbe.hasAudio) throw new Error('The sponsor-free cut lost source audio.')
        if (cutProbe.hasAudio) {
          const audioDir = join(skillDir, 'tiktok-audio-work')
          await mkdir(audioDir, { recursive: true })
          const normalizedCut = await normalizeCreatorSkillAudio(cutPath, audioDir, config, signal)
          if (normalizedCut.path !== cutPath) await copyVerified(normalizedCut.path, cutPath)
          if (normalizedCut.issue) tiktok.reviewItems.push(`Sponsor-free TikTok audio: ${normalizedCut.issue}`)
          if (normalizedCut.measure.lufs === null || normalizedCut.measure.truePeak === null)
            tiktok.reviewItems.push('Could not verify sponsor-free TikTok loudness and true peak; listen and measure before posting.')
          else {
            if (Math.abs(normalizedCut.measure.lufs + 14) > 2) tiktok.reviewItems.push(`Sponsor-free TikTok cut measures ${normalizedCut.measure.lufs} LUFS; review against the -14 LUFS target.`)
            if (normalizedCut.measure.truePeak > -1) tiktok.reviewItems.push(`Sponsor-free TikTok cut peaks at ${normalizedCut.measure.truePeak} dBTP; fix before posting.`)
          }
        }
        await run(config.ffmpeg, ['-v', 'error', '-i', cutPath, '-map', '0:v:0', '-map', '0:a?', '-f', 'null', '-'], signal, 10 * 60_000)
      } catch (error) {
        if (signal.aborted) throw error
        state.tiktokSafeAvailable = false
        state.tiktokCaptionsAvailable = false
        tiktokRenderIssue = `Could not verify the finished sponsor-free TikTok cut: ${error instanceof Error ? error.message : String(error)}`
      }
    }
    state.noMusicAvailable = false
    let noMusicIssue: string | null = null
    if (document.music) {
      try {
        const variantDir = join(skillDir, 'no-music-work')
        await mkdir(variantDir, { recursive: true })
        const noMusicDocument = { ...document, music: null }
        const variant = await workspace.render(join(variantDir, 'render.mp4'), {
          fps: noMusicDocument.format.fps,
          files: exportFiles(editedSession.composition_files ?? {}, noMusicDocument, context), signal,
        })
        const variantProbe = await probe(variant.outputPath, config, signal)
        const variantAudio = variantProbe.hasAudio
          ? await normalizeCreatorSkillAudio(variant.outputPath, variantDir, config, signal)
          : null
        const variantPath = variantAudio?.path ?? variant.outputPath
        const finalProbe = await probe(variantPath, config, signal)
        if (source.hasAudio && !finalProbe.hasAudio) throw new Error('The source audio is missing.')
        await run(config.ffmpeg, ['-v', 'error', '-i', variantPath, '-map', '0:v:0', '-map', '0:a?', '-f', 'null', '-'], signal, 10 * 60_000)
        await copyVerified(variantPath, join(skillDir, 'edited-no-music.mp4'))
        state.noMusicAvailable = true
      } catch (error) {
        if (signal.aborted) throw error
        noMusicIssue = `Could not render the no-music version; deliver one before posting this talking clip. ${error instanceof Error ? error.message : String(error)}`
      }
    }
    const flashes = await scanCreatorSkillFlashes(masterPath, config, signal).catch(() => null)
    let silenceLog = ''
    let silenceOverflow = false
    const sourceSilenceMeasured = !source.hasAudio || await run(config.ffmpeg, ['-nostdin', '-hide_banner', '-i', source.path, '-map', '0:a:0', '-af', 'silencedetect=noise=-50dB:d=0.005', '-f', 'null', '-'], signal, 10 * 60_000, chunk => {
      if (silenceLog.length + chunk.length > 1024 * 1024) silenceOverflow = true
      else silenceLog += chunk
    }, false).then(() => true, () => false)
    const audioMeasured = !!normalized && normalized.measure.lufs !== null && normalized.measure.truePeak !== null
    const wordIssues = auditCreatorSkillWordCoverage(document, media[0].id, sourceWords)
    const removedAudioIssues = source.hasAudio && sourceSilenceMeasured && !silenceOverflow
      ? auditCreatorSkillRemovedAudio(document, media[0].id, source.duration, silenceLog) : []
    const sourceAudioIssues = auditCreatorSkillSourceAudio(document, media[0].id, media[0].duration, media[0].hasAudio)
    assertCreatorSkillSpeechPreserved(wordIssues, removedAudioIssues, sourceAudioIssues, profile?.preferences.editing?.preserveEveryWord !== false)
    const integrated = normalized?.measure.lufs ?? null
    const truePeak = normalized?.measure.truePeak ?? null
    const soundScan = output.hasAudio
      ? await bridge.request<CreatorSkillSoundScan>('classifyAudioEvents', { path: masterPath, ffmpegPath: config.ffmpeg }, { signal }).catch(error => {
          if (signal.aborted) throw error
          return null
        })
      : null
    state.soundScan = soundScan ?? undefined
    const chapterResult = skillFormat === '16:9' ? finalizeCreatorSkillChapters(state.playbookPackage, output.duration) : { item: state.playbookPackage, reviewItems: [] }
    state.playbookPackage = chapterResult.item
    const reviewItems = [
      ...brandAssetIssues,
      ...creatorSkillSoundScanReview(soundScan, output.hasAudio),
      ...(normalized?.issue ? [normalized.issue] : []),
      ...auditCreatorSkillPresentation(document, selectedOutro?.id),
      ...(flashes ? flashes.map(time => `Brief visual flash near ${time.toFixed(2)}s; inspect and fix before publishing.`) : ['Automated flash scan was unavailable; check the rendered video for brief flashes.']),
      ...(output.hasAudio && !audioMeasured ? ['Could not measure final audio loudness and true peak.'] : []),
      ...(integrated !== null && Math.abs(integrated + 14) > 2 ? [`Final audio measures ${integrated} LUFS; review against the -14 LUFS target.`] : []),
      ...(truePeak !== null && truePeak > -1 ? [`Final audio true peak measures ${truePeak} dBFS; review against the -1 dBTP ceiling.`] : []),
      ...(Math.abs(output.duration - expected) > Math.max(0.5, 2 / document.format.fps) ? ['Rendered duration differs from the editable timeline.'] : []),
      ...(output.width !== document.format.width || output.height !== document.format.height ? ['Rendered dimensions differ from the editable timeline.'] : []),
      ...auditCreatorSkillStreamTiming(output.hasAudio,
        Number.isFinite(output.videoDuration) && Number.isFinite(output.audioDuration) ? Math.abs(output.videoDuration - output.audioDuration) * 1000 : null,
        Number.isFinite(output.videoStart) && Number.isFinite(output.audioStart) ? Math.abs(output.videoStart - output.audioStart) * 1000 : null),
      ...render.warnings,
      ...sourceAudioIssues,
      ...(source.hasAudio && sourceSilenceMeasured && !silenceOverflow
        ? removedAudioIssues
        : source.hasAudio ? ['Could not complete the 5 ms source silence scan; inspect all removed audio ranges.'] : []),
      ...wordIssues,
      finalSpeechReview,
      ...(finalWords.length ? ['The SRT uses re-transcribed word times. Proofread names, tickers, profanity masking, and cue breaks before publishing.'] : []),
      ...auditCreatorSkillEditorialPackage(state.playbookPackage, source.duration, output.duration),
      ...chapterResult.reviewItems,
      ...auditCreatorSkillLabels(document, media[0].id, state.playbookPackage, editedSession.composition_files ?? {}),
      ...cards.reviewItems,
      ...crops.reviewItems,
      'Review the AI-designed caption timing, wording, and placement against the finished audio.',
      ...audioPermissions.reviewItems,
      ...hook.reviewItems,
      ...chapters.reviewItems,
      ...(noMusicIssue ? [noMusicIssue] : []),
      ...sponsor.reviewItems,
      ...(state.playbookPackage?.reviewItems ?? []),
      ...sourceCaptures.reviewItems,
      ...tiktok.reviewItems,
      ...(tiktokRenderIssue ? [tiktokRenderIssue] : []),
      'Check factual claims, source cards, speech, captions, audio, sponsor disclosures, and thumbnail before publishing.',
    ]
    const previewMaxMb = creatorSkillPreviewLimitMb(profile?.preferences.delivery?.previewMaxMb)
    state.phonePreviewAvailable = await createCreatorSkillPhonePreview(masterPath, skillDir, output.duration, config, signal, previewMaxMb, skillFormat).catch(() => false)
    if (!state.phonePreviewAvailable) reviewItems.push(`Could not prepare a phone preview under ${previewMaxMb} MB; use the full export for review.`)
    save()
    if (finalWords.length || speech.length) {
      const captions = finalWords.length
        ? { content: creatorSkillFinalSrt(finalWords, skillFormat), omitted: 0 }
        : draftCreatorSkillSrt(document, media[0].id, speech)
      if (captions.content) {
        try {
          await writeFile(join(skillDir, 'captions.srt'), captions.content)
          state.captionsAvailable = true
        } catch {
          reviewItems.push('Could not save draft SRT captions; review the transcript against the rendered clip.')
        }
      }
      if (captions.omitted) reviewItems.push(`${captions.omitted} transcript segments crossed edit cuts and need caption review.`)
    } else reviewItems.push('No timed transcript was available; check spoken words against Raw.')
    const stillTimes = creatorSkillThumbnailTimes(source.duration)
    const candidates = await Promise.allSettled(stillTimes.map(async (sourceTime, index) => {
      await run(config.ffmpeg, ['-v', 'error', '-ss', String(sourceTime), '-i', source.path, '-frames:v', '1', '-vf', 'scale=640:640:force_original_aspect_ratio=decrease', '-threads', '1', '-y', join(skillDir, `thumbnail-${index}.jpg`)], signal)
      return { index, sourceTime }
    }))
    state.thumbnailCandidates = candidates.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    if (!state.thumbnailCandidates.length) reviewItems.push('Could not prepare local thumbnail stills from the VOD.')
    const detectedFaces = state.thumbnailCandidates.length
      ? await bridge.request<Array<Array<{ width: number; height: number; score: number; keypoints: Array<{ x: number; y: number }> }>>>('detectFaces', {
          paths: state.thumbnailCandidates.map(still => join(skillDir, `thumbnail-${still.index}.jpg`)),
        }, { signal }).catch(error => {
          if (signal.aborted) throw error
          reviewItems.push('Local face detection was unavailable; inspect thumbnail candidates for a clear creator expression.')
          return []
        })
      : []
    const facesByIndex = new Map(state.thumbnailCandidates.map((still, position) => [still.index, detectedFaces[position] ?? []]))
    if (detectedFaces.length && !detectedFaces.some(faces => faces.length)) reviewItems.push('No face was detected in thumbnail candidate frames; choose a suitable frame manually if this clip features the creator.')
    const scoredStills = await Promise.all((state.thumbnailCandidates ?? []).map(async still => {
      try {
        const image = await loadImage(join(skillDir, `thumbnail-${still.index}.jpg`))
        const canvas = createCanvas(128, 72)
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0, 128, 72)
        const sharpness = creatorSkillFrameSharpness(context.getImageData(0, 0, 128, 72).data, 128, 72)
        return { ...still, score: creatorSkillThumbnailFaceScore(sharpness, facesByIndex.get(still.index) ?? []) }
      } catch { return { ...still, score: 0 } }
    }))
    const draftStills = selectCreatorSkillThumbnailStills(scoredStills)
    if (draftStills.length) reviewItems.push('Inspect thumbnail drafts for a clear, current-day creator expression and replace any unsuitable still before publishing.')
    const headlines = state.playbookPackage?.thumbnailHeadlines ?? []
    if (draftStills.length && headlines.length) {
      const cutouts = new Map<number, string>()
      for (const still of draftStills) {
        const destination = join(skillDir, `thumbnail-cutout-${still.index}.png`)
        try {
          await bridge.request('cutoutPortrait', { path: join(skillDir, `thumbnail-${still.index}.jpg`), destination }, { signal })
          cutouts.set(still.index, destination)
        } catch (error) {
          if (signal.aborted) throw error
        }
      }
      if (cutouts.size < draftStills.length) reviewItems.push('Some local portrait cutouts were unavailable; inspect those original-frame thumbnail drafts or create the cutout manually.')
      if (cutouts.size) reviewItems.push('Review portrait cutout edges before publishing; the local mask may miss hair, hands, or clothing.')
      const capturedBrandPages = new Set(sourceCaptures.captures.filter(capture => state.playbookPackage?.brandReferences?.some(brand => brand.sourceUrl === capture.url)).map(capture => capture.url))
      const linkedLogos = new Map(sourceCaptures.captures.filter(capture => capture.linkedLogoUrl).map(capture => [capture.url, capture.linkedLogoUrl!]))
      const proposedLogo = creatorSkillBrandLogo(state.playbookPackage, capturedBrandPages, headlines.join(' '), linkedLogos)
      const logo = await loadBrandLogo(state.playbookPackage, capturedBrandPages, linkedLogos, headlines.join(' '), signal).catch(() => null)
      if (proposedLogo && !logo) reviewItems.push(`Could not render proposed ${proposedLogo.name} logo; review its source and usage rights.`)
      if (logo) reviewItems.push(`Review ${logo.name} logo identity and usage rights before publishing a thumbnail.`)
      const variants = await Promise.allSettled(Array.from({ length: 4 }, async (_, index) => {
        const still = draftStills[index % draftStills.length]
        const image = await loadImage(join(skillDir, `thumbnail-${still.index}.jpg`))
        const portrait = cutouts.has(still.index) ? await loadImage(cutouts.get(still.index)!).catch(() => null) : null
        const canvas = createCanvas(CREATOR_SKILL_THUMBNAIL_SIZE.width, CREATOR_SKILL_THUMBNAIL_SIZE.height)
        drawCreatorSkillThumbnail(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, image as unknown as CanvasImageSource, image, headlines[index % headlines.length], index, logo ? { image: logo.image as unknown as CanvasImageSource, width: logo.width, height: logo.height } : undefined, profile?.preferences.brand?.colors, portrait as unknown as CanvasImageSource | undefined)
        await writeFile(join(skillDir, `thumbnail-variant-${index}.png`), canvas.toBuffer('image/png'))
        return { index, headline: headlines[index % headlines.length] }
      }))
      state.thumbnailVariants = variants.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
      if (state.thumbnailVariants.length < 4) reviewItems.push('Some thumbnail review drafts could not be rendered; check source frames and headlines.')
    }
    state.contactSheetAvailable = await run(config.ffmpeg, [
      '-nostdin', '-v', 'error', '-i', masterPath,
      '-vf', `fps=0.5,scale=480:-2,tile=6x${Math.max(1, Math.min(100, Math.ceil(output.duration / 12)))}:padding=4:margin=4`,
      '-frames:v', '1', '-y', join(skillDir, 'contact-sheet.jpg'),
    ], signal, 10 * 60_000).then(() => true, () => false)
    if (!state.contactSheetAvailable) reviewItems.push('Could not prepare the visual contact sheet; inspect the whole rendered clip before publishing.')
    if (output.duration > 1200) reviewItems.push('The contact sheet covers only the first 20 minutes; inspect the remaining rendered frames separately.')
    await copyVerified(masterPath, outputPath)
    const deliveredMasterPath = join(directory, `${clip.id}.mp4`)
    state.masterMd5 = await copyVerified(outputPath, deliveredMasterPath)
    if (state.playbookPackage) state.playbookPackage.automatedQa = {
      masterMd5: state.masterMd5,
      blockers: creatorSkillAutomatedQaBlockers({
        document, selectedOutroId: selectedOutro?.id,
        flashFindings: flashes?.map(time => `Brief visual flash near ${time.toFixed(2)}s.`) ?? null,
        hasAudio: output.hasAudio, audioMeasured, integratedLufs: integrated, truePeakDbtp: truePeak,
        renderedDuration: output.duration, expectedDuration: expected,
        renderedWidth: output.width, renderedHeight: output.height,
        streamDurationDeltaMs: Number.isFinite(output.videoDuration) && Number.isFinite(output.audioDuration) ? Math.abs(output.videoDuration - output.audioDuration) * 1000 : null,
        streamStartDeltaMs: Number.isFinite(output.videoStart) && Number.isFinite(output.audioStart) ? Math.abs(output.videoStart - output.audioStart) * 1000 : null,
      }),
    }
    ;(clip.builds ||= []).push({ id: buildId, revision: clip.revision, aspectRatio: skillFormat, format: 'mp4', origin: 'creator_skill', completedAt: Date.now(), duration: output.duration })
    clip.builtRevision = clip.revision
    clip.selectedVersion = 'edited'
    state.status = 'needs_review'
    state.timeline = document
    state.reviewItems = reviewItems
    save()
  } catch (error) {
    state.status = 'failed'
    state.reviewItems = [signal.aborted ? 'Clippster Skill editing was cancelled.' : error instanceof Error ? error.message : 'Clippster Skill editing failed.']
    save()
  } finally {
    await bridge?.close()
  }
}

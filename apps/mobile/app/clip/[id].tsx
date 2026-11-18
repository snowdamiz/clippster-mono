import { useEventListener } from 'expo'
import { AppIcon } from '@/components/AppIcon'
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { File } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AdjustClipTimeline } from '@/components/adjust/AdjustClipTimeline'
import { AdjustClipToolBar } from '@/components/adjust/AdjustClipToolBar'
import { ExportSheet } from '@/components/export/ExportSheet'
import { ExportPreview } from '@/components/export/ExportPreview'
import { FramedVideoPreview } from '@/components/framing/FramedVideoPreview'
import { hasVisibleFraming } from '@/components/framing/framingRegions'
import { SubtitleOverlay } from '@/components/subtitles/SubtitleOverlay'
import { SubtitleSheet } from '@/components/subtitles/SubtitleSheet'
import { MenuRow } from '@/components/navigation/MenuRow'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Tabs } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useSmoothPlayerTime } from '@/hooks/useSmoothPlayerTime'
import { appAlert } from '@/lib/appAlert'
import { extendBuffer, initialAdjustWindow, selectionIsDirty } from '@/lib/clipAdjust'
import { configurePreviewPlayer } from '@/lib/configurePreviewPlayer'
import { formatClock } from '@/lib/formatTime'
import { toPlaybackUri, toVideoSource } from '@/lib/playbackVideo'
import { transcriptWordsForClip } from '@/lib/subtitleVisibleWords'
import {
  createDefaultSubtitleSettings,
  CREATOR_SKILL_DOCUMENT_NAMES,
  type CreatorSkillDocumentName,
  type ActiveVodPresetConfig,
  type Clip,
  type Project,
  type SubtitleSettings
} from '@clippster/shared-types'
import { AiPipeline, type AiPipelineProgress } from '@/services/aiPipeline'
import { generateClipThumbnailAtTimestamp } from '@/services/clipThumbnailGeneration'
import {
  getClipById,
  getClipBuildsByClipId,
  getClipSubtitleSettings,
  getProject,
  getProjectVodPresetConfig,
  getRawVideoByProjectId,
  getTranscriptByProjectId,
  replaceClipSegments,
  updateClipBuiltThumbnail,
  updateClipSubtitleSettings,
  updateRawVideoFilePath
} from '@/services/database'
import { ensurePlayableVideo } from '@/services/ensurePlayableVideo'
import { useAccount } from '@/context/AccountContext'
import { tokens } from '@/theme/tokens'
import { exportEditorProject } from '@/editor/export/exportEditorProject'
import type { EditorExportProgress as ClipBuildProgress } from '@/editor/export/exportProgress'
import { loadEditorEntry } from '@/editor/state/loadEditorEntry'
import { mobileEditorDependencies } from '@/editor/state/mobileEditorDependencies'
import { getClipVersionPreference, setClipVersionPreference, type ClipVersionPreference } from '@/services/clipVersionPreference'
import { getMobileCreatorSkillState, resumeMobileCreatorSkillClip, retryMobileCreatorSkill, reviewMobileCreatorSkillClaim, reviewMobileCreatorSkillFootage, reviewMobileCreatorSkillFinding, signOffMobileCreatorSkillReview, startMobileCreatorSkill, type MobileCreatorSkillState } from '@/services/creatorSkillMobile'
import { creatorSkillPolicy, downloadCreatorSkillContactSheet, downloadCreatorSkillDelivery, downloadCreatorSkillDocument, downloadCreatorSkillNoMusic, downloadCreatorSkillPhonePreview, downloadCreatorSkillSourceCapture, downloadCreatorSkillSourceScreenshot, downloadCreatorSkillThumbnailCandidate, downloadCreatorSkillThumbnailDraft, downloadCreatorSkillTikTokCut, downloadCreatorSkillTikTokCaptions } from '@/services/creatorSkillWeb'
import { userBrandingApi } from '@/services/api'

function completedPreviewPath(builds: Awaited<ReturnType<typeof getClipBuildsByClipId>>, skill: MobileCreatorSkillState | null): string | null {
  const ready = builds.filter(item => item.status === 'completed' && !!item.file_path && new File(toPlaybackUri(item.file_path)).exists)
  if (skill?.status === 'needs_review' && skill.editedPath) {
    return ready.find(item => item.file_path === skill.editedPath)?.file_path ?? null
  }
  return ready[0]?.file_path ?? null
}

function ClipAdjustWorkspace({
  clipId,
  clip,
  project,
  videoPath,
  mediaDuration,
  hasTranscript,
  transcriptJson,
  initialSettings,
  onReload
}: {
  clipId: string
  clip: Clip
  project: Project | null
  videoPath: string
  mediaDuration: number
  hasTranscript: boolean
  transcriptJson: string | null
  initialSettings: SubtitleSettings | null
  onReload: () => Promise<void>
}) {
  const router = useRouter()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const { requireSubscription } = useAccount()
  const [rangeVisible, setRangeVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSubtitleSheet, setShowSubtitleSheet] = useState(false)
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(
    initialSettings ?? createDefaultSubtitleSettings()
  )
  const [aiProgress, setAiProgress] = useState<AiPipelineProgress | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [playbackEpoch, setPlaybackEpoch] = useState(0)
  const [previewRatio, setPreviewRatio] = useState<'16:9' | '9:16'>('16:9')
  const [previewSize, setPreviewSize] = useState({ width: 360, height: 203 })
  const [vodPresetConfig, setVodPresetConfig] = useState<ActiveVodPresetConfig | null>(null)
  const [exportVisible, setExportVisible] = useState(false)
  const [exportProgress, setExportProgress] = useState<ClipBuildProgress | null>(null)
  const [completedBuildPath, setCompletedBuildPath] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<ClipVersionPreference>('raw')
  const [creatorSkill, setCreatorSkill] = useState<MobileCreatorSkillState | null>(null)
  const [deliveryArchivePath, setDeliveryArchivePath] = useState<string | null>(null)
  const [claimReviewNotes, setClaimReviewNotes] = useState<Record<number, string>>({})
  const [footageReviewNotes, setFootageReviewNotes] = useState<Record<number, string>>({})
  const [reviewerName, setReviewerName] = useState('')
  const [reviewSeverity, setReviewSeverity] = useState<'fix_first' | 'should_fix' | 'ok'>('fix_first')
  const [reviewOutputTime, setReviewOutputTime] = useState('0')
  const [reviewFinding, setReviewFinding] = useState('')
  const [reviewSignoffNote, setReviewSignoffNote] = useState('')
  const [claimReviewSaving, setClaimReviewSaving] = useState(false)
  const [skillRetrying, setSkillRetrying] = useState(false)
  const [skillProfilePickerVisible, setSkillProfilePickerVisible] = useState(false)
  const [skillProfiles, setSkillProfiles] = useState<{ id: number; name: string }[]>([])
  const [skillProfileId, setSkillProfileId] = useState<number | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  async function saveClaimReview(index: number, decision: 'source_checked' | 'label_checked' | 'needs_changes') {
    const note = claimReviewNotes[index] ?? creatorSkill?.playbookPackage?.claimReviews?.find(review => review.claimIndex === index)?.note ?? ''
    if (note.trim().length < 10) { appAlert('Review note required', 'Add at least 10 characters explaining your source check or requested change.'); return }
    setClaimReviewSaving(true)
    try { setCreatorSkill(await reviewMobileCreatorSkillClaim(clipId, index, decision, note)) }
    catch (error) { appAlert('Could not save claim review', error instanceof Error ? error.message : String(error)) }
    finally { setClaimReviewSaving(false) }
  }

  async function saveFootageReview(index: number, decision: 'frame_checked' | 'needs_changes') {
    const note = footageReviewNotes[index] ?? creatorSkill?.playbookPackage?.footageReviews?.find(review => review.footageIndex === index)?.note ?? ''
    if (note.trim().length < 10) { appAlert('Review note required', 'Add at least 10 characters explaining which frames you checked or what needs changing.'); return }
    setClaimReviewSaving(true)
    try { setCreatorSkill(await reviewMobileCreatorSkillFootage(clipId, index, decision, note)) }
    catch (error) { appAlert('Could not save footage review', error instanceof Error ? error.message : String(error)) }
    finally { setClaimReviewSaving(false) }
  }
  async function saveIndependentFinding() {
    setClaimReviewSaving(true)
    try {
      setCreatorSkill(await reviewMobileCreatorSkillFinding(clipId, { reviewer: reviewerName, severity: reviewSeverity, outputTime: Number(reviewOutputTime), finding: reviewFinding }))
      setReviewFinding('')
    } catch (error) { appAlert('Could not save reviewer finding', error instanceof Error ? error.message : String(error)) }
    finally { setClaimReviewSaving(false) }
  }
  async function saveIndependentSignoff() {
    setClaimReviewSaving(true)
    try {
      setCreatorSkill(await signOffMobileCreatorSkillReview(clipId, { reviewer: reviewerName, note: reviewSignoffNote }))
      setReviewSignoffNote('')
    } catch (error) { appAlert('Could not save reviewer signoff', error instanceof Error ? error.message : String(error)) }
    finally { setClaimReviewSaving(false) }
  }

  const start = clip.start_time ?? 0
  const end = clip.end_time ?? start + Math.max(clip.duration ?? 30, 1)
  const initialWindow = initialAdjustWindow({
    selectStart: start,
    selectEnd: end,
    mediaDuration
  })

  const [originalStart, setOriginalStart] = useState(initialWindow.selectStart)
  const [originalEnd, setOriginalEnd] = useState(initialWindow.selectEnd)
  const [bufferStart, setBufferStart] = useState(initialWindow.bufferStart)
  const [bufferEnd, setBufferEnd] = useState(initialWindow.bufferEnd)
  const [selectStart, setSelectStart] = useState(initialWindow.selectStart)
  const [selectEnd, setSelectEnd] = useState(initialWindow.selectEnd)

  const startedRef = useRef(false)
  const selectStartRef = useRef(selectStart)
  const selectEndRef = useRef(selectEnd)
  const aiPipelineRef = useRef<AiPipeline | null>(null)

  const player = useVideoPlayer(toVideoSource(videoPath), configurePreviewPlayer)
  useFocusEffect(useCallback(() => {
    let active = true
    void Promise.all([getClipBuildsByClipId(clipId), getClipVersionPreference(clipId), getMobileCreatorSkillState(clipId).catch(() => null)]).then(([builds, version, skill]) => {
      if (!active) return
      const path = completedPreviewPath(builds, skill)
      setCompletedBuildPath(path)
      setSelectedVersion(path ? version : 'raw')
      setCreatorSkill(skill)
      if (skill && !['needs_review', 'failed'].includes(skill.status)) {
        void resumeMobileCreatorSkillClip(clipId).then(async recovered => {
          if (!active) return
          setCreatorSkill(recovered)
          const path = completedPreviewPath(await getClipBuildsByClipId(clipId), recovered)
          if (path) {
            setCompletedBuildPath(path)
            setSelectedVersion(await getClipVersionPreference(clipId))
          }
        }).catch(error => console.warn('[ClipWorkspace] Could not reconnect to Clippster Skill:', error))
      }
    }).catch(error => console.warn('[ClipWorkspace] Could not load built preview:', error))
    return () => { active = false }
  }, [clipId]))
  const editedPreview = selectedVersion === 'edited' && !!completedBuildPath
  async function selectVersion(version: ClipVersionPreference) {
    if (version === 'edited' && !completedBuildPath) return
    player.pause()
    try {
      await setClipVersionPreference(clipId, version)
      setSelectedVersion(version)
    } catch (error) {
      appAlert('Clip version', error instanceof Error ? error.message : 'Could not save the selected version')
    }
  }
  async function chooseSkillProfile() {
    if (skillRetrying || creatorSkill || !clip.detection_session_id) return
    try {
      const bundle = await userBrandingApi.getBundle()
      setSkillProfiles(bundle.success ? bundle.profiles.filter(profile => !profile.disabled).map(profile => ({ id: profile.id, name: profile.name })) : [])
    } catch { setSkillProfiles([]) }
    setSkillProfileId(null)
    setSkillProfilePickerVisible(true)
  }
  async function requestSkillEdit(retry: boolean, creatorProfileId?: number | null) {
    if (skillRetrying || (retry ? creatorSkill?.status !== 'failed' : !!creatorSkill || !clip.detection_session_id)) return
    try {
      const policy = await creatorSkillPolicy()
      appAlert(retry ? 'Retry Clippster Skill' : 'Pre-edit this clip?', `One AI edit may use ${policy.credits.generate} personal credits. The downloaded VOD and clip speech go to the private web workspace and AI editor, along with saved preferences and selected intro or outro assets if a creator profile is linked. Finished audio from clips under 30 minutes goes to Clippster's transcription service for QA with no extra personal-credit charge. Raw remains available. VOD-frame thumbnails have no separate charge.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: retry ? 'Retry edit' : 'Pre-edit clip', onPress: () => { void (async () => {
          setSkillRetrying(true)
          try {
            if (retry) await retryMobileCreatorSkill(clipId, () => {}, policy.credits.generate)
            else await startMobileCreatorSkill(clipId, () => {}, policy.credits.generate, undefined, creatorProfileId)
            const [skill, builds] = await Promise.all([getMobileCreatorSkillState(clipId), getClipBuildsByClipId(clipId)])
            setCreatorSkill(skill)
            setCompletedBuildPath(completedPreviewPath(builds, skill))
            setSelectedVersion(await getClipVersionPreference(clipId))
            await onReload()
          } catch (error) {
            setCreatorSkill(await getMobileCreatorSkillState(clipId).catch(() => null))
            appAlert('Clippster Skill edit failed', error instanceof Error ? error.message : 'Try again.')
          } finally { setSkillRetrying(false) }
        })() } },
      ])
    } catch { appAlert('Clippster Skill unavailable', 'Could not load the current AI editing cost. Try again later.') }
  }
  async function shareSkillDocument(name: CreatorSkillDocumentName) {
    if (!creatorSkill?.webProjectId || !creatorSkill.webClipId) return
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.')
      const path = await downloadCreatorSkillDocument(creatorSkill.webProjectId, creatorSkill.webClipId, name)
      await Sharing.shareAsync(path, { mimeType: 'text/markdown', dialogTitle: `Share ${name}` })
    } catch (error) {
      appAlert('Could not share playbook file', error instanceof Error ? error.message : String(error))
    }
  }
  async function saveSkillDelivery() {
    if (!creatorSkill?.webProjectId || !creatorSkill.webClipId) return
    try {
      const path = await downloadCreatorSkillDelivery(creatorSkill.webProjectId, creatorSkill.webClipId)
      setDeliveryArchivePath(path)
      appAlert('Full delivery downloaded', 'The dated ZIP with Raw, Edited, review assets, notes, and checksums is saved in this app’s documents.')
    } catch (error) { appAlert('Could not download full delivery', error instanceof Error ? error.message : String(error)) }
  }
  async function shareSkillDelivery() {
    if (!creatorSkill?.webProjectId || !creatorSkill.webClipId) return
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.')
      const path = await downloadCreatorSkillDelivery(creatorSkill.webProjectId, creatorSkill.webClipId)
      setDeliveryArchivePath(path)
      await Sharing.shareAsync(path, { mimeType: 'application/zip', dialogTitle: 'Share full Clippster Skill delivery' })
    } catch (error) { appAlert('Could not share full delivery', error instanceof Error ? error.message : String(error)) }
  }
  async function shareSkillThumbnail(index: number) {
    if (!creatorSkill?.webProjectId || !creatorSkill.webClipId) return
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.')
      const path = await downloadCreatorSkillThumbnailDraft(creatorSkill.webProjectId, creatorSkill.webClipId, index)
      await Sharing.shareAsync(path, { mimeType: 'image/png', dialogTitle: `Share thumbnail draft ${String.fromCharCode(65 + index)}` })
    } catch (error) {
      appAlert('Could not share thumbnail draft', error instanceof Error ? error.message : String(error))
    }
  }
  async function shareSkillThumbnailCandidate(index: number) {
    if (!creatorSkill?.webProjectId || !creatorSkill.webClipId) return
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.')
      const path = await downloadCreatorSkillThumbnailCandidate(creatorSkill.webProjectId, creatorSkill.webClipId, index)
      await Sharing.shareAsync(path, { mimeType: 'image/jpeg', dialogTitle: `Share VOD frame ${index + 1}` })
    } catch (error) { appAlert('Could not share VOD frame', error instanceof Error ? error.message : String(error)) }
  }
  async function shareSkillContactSheet() {
    if (!creatorSkill?.webProjectId || !creatorSkill.webClipId) return
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.')
      const path = await downloadCreatorSkillContactSheet(creatorSkill.webProjectId, creatorSkill.webClipId)
      await Sharing.shareAsync(path, { mimeType: 'image/jpeg', dialogTitle: 'Share visual contact sheet' })
    } catch (error) {
      appAlert('Could not share visual contact sheet', error instanceof Error ? error.message : String(error))
    }
  }
  async function shareSkillPhonePreview() {
    if (!creatorSkill?.webProjectId || !creatorSkill.webClipId) return
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.')
      const path = await downloadCreatorSkillPhonePreview(creatorSkill.webProjectId, creatorSkill.webClipId)
      await Sharing.shareAsync(path, { mimeType: 'video/mp4', dialogTitle: 'Share phone preview' })
    } catch (error) {
      appAlert('Could not share phone preview', error instanceof Error ? error.message : String(error))
    }
  }
  async function shareSkillTikTokCut() {
    if (!creatorSkill?.webProjectId || !creatorSkill.webClipId) return
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.')
      const path = await downloadCreatorSkillTikTokCut(creatorSkill.webProjectId, creatorSkill.webClipId)
      await Sharing.shareAsync(path, { mimeType: 'video/mp4', dialogTitle: 'Share sponsor-free TikTok cut' })
    } catch (error) {
      appAlert('Could not share TikTok cut', error instanceof Error ? error.message : String(error))
    }
  }
  async function shareSkillNoMusic() {
    if (!creatorSkill?.webProjectId || !creatorSkill.webClipId) return
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.')
      const path = await downloadCreatorSkillNoMusic(creatorSkill.webProjectId, creatorSkill.webClipId)
      await Sharing.shareAsync(path, { mimeType: 'video/mp4', dialogTitle: 'Share no-music edit' })
    } catch (error) {
      appAlert('Could not share no-music edit', error instanceof Error ? error.message : String(error))
    }
  }
  async function shareSkillTikTokCaptions() {
    if (!creatorSkill?.webProjectId || !creatorSkill.webClipId) return
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.')
      const path = await downloadCreatorSkillTikTokCaptions(creatorSkill.webProjectId, creatorSkill.webClipId)
      await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: 'Share TikTok cut captions' })
    } catch (error) {
      appAlert('Could not share TikTok captions', error instanceof Error ? error.message : String(error))
    }
  }
  async function shareSkillSourceCapture(index: number) {
    if (!creatorSkill?.webProjectId || !creatorSkill.webClipId) return
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.')
      const path = await downloadCreatorSkillSourceCapture(creatorSkill.webProjectId, creatorSkill.webClipId, index)
      await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: `Share source capture ${index + 1}` })
    } catch (error) {
      appAlert('Could not share source capture', error instanceof Error ? error.message : String(error))
    }
  }
  async function shareSkillSourceScreenshot(index: number) {
    if (!creatorSkill?.webProjectId || !creatorSkill.webClipId) return
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.')
      const path = await downloadCreatorSkillSourceScreenshot(creatorSkill.webProjectId, creatorSkill.webClipId, index)
      await Sharing.shareAsync(path, { mimeType: 'image/png', dialogTitle: `Share static source screenshot ${index + 1}` })
    } catch (error) { appAlert('Could not share static source screenshot', error instanceof Error ? error.message : String(error)) }
  }
  const { currentTime, noteSeek } = useSmoothPlayerTime(player, (seconds) => {
    if (seconds >= selectEndRef.current - 0.04) {
      player.pause()
      player.currentTime = selectStartRef.current
      noteSeek(selectStartRef.current)
    }
  })

  useEventListener(player, 'playingChange', () => {
    setPlaybackEpoch((value) => value + 1)
  })

  useEffect(() => {
    selectStartRef.current = selectStart
    selectEndRef.current = selectEnd
  }, [selectEnd, selectStart])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    player.currentTime = selectStart
    noteSeek(selectStart)
  }, [noteSeek, player, selectStart])

  useFocusEffect(
    useCallback(() => {
      let active = true
      if (!clip.project_id) {
        setVodPresetConfig(null)
        return () => {
          active = false
        }
      }
      void getProjectVodPresetConfig(clip.project_id).then((next) => {
        if (!active) return
        setVodPresetConfig(next)
        if (hasVisibleFraming(next?.framingConfig)) {
          setPreviewRatio('9:16')
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y: 0, animated: false })
          })
        }
      })
      return () => {
        active = false
      }
    }, [clip.project_id])
  )

  const dirty = selectionIsDirty(selectStart, selectEnd, originalStart, originalEnd)
  const clipRelativeTime = currentTime - selectStart

  const subtitleWords = useMemo(() => {
    if (!hasTranscript || !transcriptJson) return []
    return transcriptWordsForClip(transcriptJson, selectStart, selectEnd)
  }, [hasTranscript, transcriptJson, selectStart, selectEnd])

  const seekTo = useCallback(
    (seconds: number) => {
      const next = Math.max(bufferStart, Math.min(bufferEnd, seconds))
      player.currentTime = next
      noteSeek(next)
    },
    [bufferEnd, bufferStart, noteSeek, player]
  )

  const persistSelection = useCallback(async () => {
    await replaceClipSegments(clipId, [{ start_time: selectStart, end_time: selectEnd }])
    const mid = selectStart + (selectEnd - selectStart) / 2
    const thumb = await generateClipThumbnailAtTimestamp(videoPath, mid, clipId)
    if (thumb) await updateClipBuiltThumbnail(clipId, thumb)
    if (clip.project_id) {
      const { queueProjectSync } = await import('@/services/cloudSync')
      void queueProjectSync(clip.project_id)
    }
    setOriginalStart(selectStart)
    setOriginalEnd(selectEnd)
  }, [clip.project_id, clipId, selectEnd, selectStart, videoPath])

  const ensureSaved = useCallback(async () => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      await persistSelection()
    } catch (error) {
      appAlert('Could not save', error instanceof Error ? error.message : String(error))
      throw error
    } finally {
      setSaving(false)
    }
  }, [dirty, persistSelection, saving])

  const openEditor = useCallback(async () => {
    try {
      await ensureSaved()
    } catch {
      return
    }
    router.push({
      pathname: '/edit/[kind]/[id]',
      params: {
        kind: 'clip',
        id: clipId
      }
    })
  }, [clipId, ensureSaved, router])

  const openExport = useCallback(async () => {
    try {
      await ensureSaved()
    } catch {
      return
    }
    setExportProgress(null)
    setExportVisible(true)
  }, [ensureSaved])

  const startExport = useCallback(
    (ratios: import('@/editor/model/schema').CanvasRatio[]) => {
      setExportProgress({
        state: 'building',
        progress: 0,
        message: 'Preparing clip…'
      })
      void loadEditorEntry('clip', clipId, mobileEditorDependencies)
        .then((loaded) => {
          if (loaded.missingMedia.length > 0) {
            throw new Error(
              `${loaded.missingMedia.length} media ${
                loaded.missingMedia.length === 1 ? 'file is' : 'files are'
              } unavailable.`
            )
          }
          return exportEditorProject(loaded.document, ratios, setExportProgress)
        })
        .catch((error) => {
          setExportProgress({
            state: 'error',
            progress: 0,
            message: 'Export failed',
            error: error instanceof Error ? error.message : String(error)
          })
        })
    },
    [clipId]
  )

  const handleExtend = useCallback(
    (edge: 'start' | 'end') => {
      const next = extendBuffer(edge, bufferStart, bufferEnd, mediaDuration)
      if (!next.extended) return
      setBufferStart(next.bufferStart)
      setBufferEnd(next.bufferEnd)
    },
    [bufferEnd, bufferStart, mediaDuration]
  )

  const handleReset = useCallback(() => {
    const window = initialAdjustWindow({
      selectStart: originalStart,
      selectEnd: originalEnd,
      mediaDuration
    })
    setSelectStart(window.selectStart)
    setSelectEnd(window.selectEnd)
    setBufferStart(window.bufferStart)
    setBufferEnd(window.bufferEnd)
    player.currentTime = window.selectStart
    noteSeek(window.selectStart)
  }, [mediaDuration, noteSeek, originalEnd, originalStart, player])

  const handleSave = useCallback(async () => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      await persistSelection()
    } catch (error) {
      appAlert('Could not save', error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }, [dirty, persistSelection, saving])

  const handleClose = useCallback(() => {
    if (!dirty) {
      router.back()
      return
    }
    appAlert('Discard changes?', 'Your adjusted clip range has not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      {
        text: 'Save',
        onPress: () => {
          void handleSave().then(() => router.back())
        }
      }
    ])
  }, [dirty, handleSave, router])

  async function runTranscribe() {
    if (!clip.project_id) return
    const allowed = await requireSubscription({
      context: 'Transcribe VOD',
      type: 'ai',
      aiOnly: true
    })
    if (!allowed) return

    setAiBusy(true)
    const pipeline = new AiPipeline(setAiProgress)
    aiPipelineRef.current = pipeline
    try {
      await pipeline.transcribeProject(clip.project_id)
      await onReload()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message === 'Cancelled') {
        setAiProgress({ stage: 'idle', progress: 0, message: 'Cancelled' })
      } else {
        setAiProgress({
          stage: 'error',
          progress: 0,
          message: 'Transcription failed',
          error: message
        })
      }
    } finally {
      aiPipelineRef.current = null
      setAiBusy(false)
    }
  }

  const captionsEnabled = Boolean(subtitleSettings.enabled)
  const framingConfig = vodPresetConfig?.framingConfig ?? null
  const displayRatio = editedPreview ? creatorSkill?.editedAspectRatio ?? previewRatio : previewRatio
  const showFramedPreview = !editedPreview && displayRatio === '9:16' && hasVisibleFraming(framingConfig)
  const previewAspect = displayRatio === '9:16' ? 9 / 16 : 16 / 9
  const previewMaxHeight =
    displayRatio === '9:16' ? Math.min(windowHeight * 0.35, 320) : Math.min(windowHeight * 0.31, 280)
  const previewWidth = Math.min(windowWidth - 40, previewMaxHeight * previewAspect)
  const previewHeight = previewWidth / previewAspect

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="min-h-[60px] flex-row items-center gap-1 px-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={handleClose}
            className="min-h-10 justify-center px-2 active:opacity-60"
          >
            <Text className="text-sm font-medium text-accent">← Back</Text>
          </Pressable>
          <Text className="flex-1 px-1 text-sm font-semibold text-foreground" numberOfLines={1}>
            {clip.name || project?.name || 'Clip'}
          </Text>
          {dirty ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save"
              disabled={saving}
              onPress={() => void handleSave()}
              className={`min-h-10 justify-center rounded-lg bg-accent px-3 ${
                saving ? 'opacity-40' : 'active:opacity-70'
              }`}
            >
              <Text className="text-sm font-semibold text-primary-foreground">{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          ) : null}
        </View>

        {completedBuildPath ? (
          <View className="mx-5 flex-row items-center gap-4 py-2">
            <Text className="text-xs text-muted">Clip version</Text>
            {(['raw', 'edited'] as const).map(version => (
              <Pressable key={version} accessibilityRole="button" accessibilityState={{ selected: selectedVersion === version }}
                onPress={() => void selectVersion(version)} className="min-h-11 justify-center px-2">
                <Text className={selectedVersion === version ? 'font-semibold text-accent' : 'text-muted'}>{version === 'raw' ? 'Raw' : 'Edited'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {!creatorSkill && clip.detection_session_id ? <Pressable accessibilityRole="button" disabled={skillRetrying} onPress={() => void chooseSkillProfile()} className="mx-5 rounded-xl border border-border bg-surface px-3 py-2"><Text className="text-sm font-semibold text-accent">{skillRetrying ? 'Preparing Clippster Skill…' : 'Pre-edit this Raw clip using Clippster Skill'}</Text></Pressable> : null}
        {creatorSkill ? (
          <ScrollView className="mx-5 max-h-40 rounded-xl border border-border bg-surface p-3" nestedScrollEnabled>
            <Text className="text-sm font-semibold text-foreground">Clippster Skill · {creatorSkill.status.replace('_', ' ')}</Text>
            {creatorSkill.status === 'failed' ? <Pressable accessibilityRole="button" disabled={skillRetrying} onPress={() => void requestSkillEdit(true)}><Text className="mt-1 text-xs font-semibold text-accent">{skillRetrying ? 'Retrying…' : 'Retry AI edit'}</Text></Pressable> : null}
            {creatorSkill.reviewItems.map((item, index) => <Text key={`review-${index}`} className="mt-1 text-xs text-muted">{item}</Text>)}
            {creatorSkill.status === 'needs_review' && creatorSkill.playbookPackage ? <Pressable accessibilityRole="button" onPress={() => void saveSkillDelivery()}><Text className="mt-1 text-xs font-semibold text-accent">Download full dated delivery ZIP with checksums to this device</Text></Pressable> : null}
            {creatorSkill.status === 'needs_review' && creatorSkill.playbookPackage ? <Pressable accessibilityRole="button" onPress={() => void shareSkillDelivery()}><Text className="mt-1 text-xs font-semibold text-accent">Share full delivery ZIP</Text></Pressable> : null}
            {deliveryArchivePath ? <Text className="mt-1 text-xs text-muted">Saved in app documents: {deliveryArchivePath}</Text> : null}
            {creatorSkill.contactSheetAvailable ? <Pressable accessibilityRole="button" onPress={() => void shareSkillContactSheet()}><Text className="mt-1 text-xs font-semibold text-accent">Share visual contact sheet</Text></Pressable> : null}
            {creatorSkill.phonePreviewAvailable ? <Pressable accessibilityRole="button" onPress={() => void shareSkillPhonePreview()}><Text className="mt-1 text-xs font-semibold text-accent">Share phone preview</Text></Pressable> : null}
            {creatorSkill.noMusicAvailable ? <Pressable accessibilityRole="button" onPress={() => void shareSkillNoMusic()}><Text className="mt-1 text-xs font-semibold text-accent">Share no-music edit</Text></Pressable> : null}
            {creatorSkill.tiktokSafeAvailable ? <Pressable accessibilityRole="button" onPress={() => void shareSkillTikTokCut()}><Text className="mt-1 text-xs font-semibold text-accent">Share TikTok cut before sponsor read</Text></Pressable> : null}
            {creatorSkill.tiktokCaptionsAvailable ? <Pressable accessibilityRole="button" onPress={() => void shareSkillTikTokCaptions()}><Text className="mt-1 text-xs font-semibold text-accent">Share TikTok cut captions</Text></Pressable> : null}
            {creatorSkill.sourceCaptures?.map(capture => <Pressable key={`source-${capture.index}`} accessibilityRole="button" onPress={() => void shareSkillSourceCapture(capture.index)}><Text className="mt-1 text-xs font-semibold text-accent">Share public {capture.kind} page: {capture.title}</Text></Pressable>)}
            {creatorSkill.sourceCaptures?.filter(capture => capture.screenshotAvailable).map(capture => <Pressable key={`source-image-${capture.index}`} accessibilityRole="button" onPress={() => void shareSkillSourceScreenshot(capture.index)}><Text className="mt-1 text-xs font-semibold text-accent">Share static screenshot: {capture.title}</Text></Pressable>)}
            {creatorSkill.sourceCaptures?.filter(capture => capture.pagePublishedAt).map(capture => <Text key={`source-date-${capture.index}`} className="text-xs text-muted">{capture.title} · Page-advertised publication date: {capture.pagePublishedAt} (check against the live page)</Text>)}
            {creatorSkill.playbookPackage ? (
              <View className="mt-2 gap-2">
                <View className="flex-row flex-wrap gap-2">
                  {CREATOR_SKILL_DOCUMENT_NAMES.map(name => (
                    <Pressable key={name} accessibilityRole="button" onPress={() => void shareSkillDocument(name)}><Text className="text-xs font-semibold text-accent">Share {name}</Text></Pressable>
                  ))}
                </View>
                <Text className="text-xs font-semibold text-foreground">Funnel: {creatorSkill.playbookPackage.funnel.stage.replace('_', ' ')}</Text>
                <Text className="text-xs text-muted">{creatorSkill.playbookPackage.funnel.reason} · Measure: {creatorSkill.playbookPackage.funnel.metric}{creatorSkill.playbookPackage.funnel.bridge ? ` · Bridge: ${creatorSkill.playbookPackage.funnel.bridge}` : ''}</Text>
                <Text className="text-xs font-semibold text-foreground">Claims and source cards</Text>
                {creatorSkill.playbookPackage.claims.map((claim, index) => {
                  const review = creatorSkill.playbookPackage?.claimReviews?.find(entry => entry.claimIndex === index)
                  const evidence = creatorSkill.claimEvidence?.find(entry => entry.claimIndex === index)
                  return <View key={`claim-${index}`} className="mt-1 gap-1"><Text className="text-xs text-muted">{claim.time.toFixed(1)}s · {claim.text} · {claim.verdict}{claim.publishedAt ? ` · Proposed date: ${claim.publishedAt}` : ''}{claim.sourceUrl ? ` · ${creatorSkill.sourceCaptures?.some(capture => capture.url === claim.sourceUrl) ? 'Page captured for review' : 'Page not captured'}` : ''}</Text>{claim.sourceUrl ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(claim.sourceUrl!)}><Text className="text-xs font-semibold text-accent">Open cited source</Text></Pressable> : null}
                    {evidence ? <Text className="text-xs text-muted">Captured text candidate (not verified): {evidence.excerpt}</Text> : null}
                    {review ? <Text className="text-xs text-muted">Human review: {review.decision.replace('_', ' ')} · {review.note}</Text> : null}
                    <TextInput accessibilityLabel={`Claim ${index + 1} review note`} value={claimReviewNotes[index] ?? review?.note ?? ''} onChangeText={note => setClaimReviewNotes(current => ({ ...current, [index]: note }))} placeholder="Review note (at least 10 characters)" multiline className="rounded border border-border px-2 py-1 text-xs text-foreground" />
                    <View className="flex-row gap-3"><Pressable accessibilityRole="button" disabled={claimReviewSaving || !claim.sourceUrl} onPress={() => void saveClaimReview(index, 'source_checked')}><Text className="text-xs font-semibold text-accent">Record source check</Text></Pressable>{['unconfirmed', 'rumor', 'not_found'].includes(claim.verdict) && claim.onScreenLabel ? <Pressable accessibilityRole="button" disabled={claimReviewSaving} onPress={() => void saveClaimReview(index, 'label_checked')}><Text className="text-xs font-semibold text-accent">Record neutral-label check</Text></Pressable> : null}<Pressable accessibilityRole="button" disabled={claimReviewSaving} onPress={() => void saveClaimReview(index, 'needs_changes')}><Text className="text-xs font-semibold text-accent">Needs changes</Text></Pressable></View>
                  </View>
                })}
                <Text className="text-xs font-semibold text-foreground">Footage and privacy crop proposals</Text>
                {creatorSkill.playbookPackage.footageReview?.length ? creatorSkill.playbookPackage.footageReview.map((entry, index) => {
                  const review = creatorSkill.playbookPackage?.footageReviews?.find(value => value.footageIndex === index)
                  return <View key={`footage-${index}`} className="mt-1 gap-1"><Text className="text-xs text-muted">{entry.start.toFixed(1)}–{entry.end.toFixed(1)}s · Show {entry.show} · Hide {entry.hide.join(', ') || 'none noted'} · Crop {entry.crop ? `${entry.crop.x}, ${entry.crop.y}, ${entry.crop.width}, ${entry.crop.height}` : 'not proposed'} · {entry.note}</Text>{review ? <Text className="text-xs text-muted">Human review: {review.decision.replace('_', ' ')} · {review.note}</Text> : null}<TextInput accessibilityLabel={`Footage ${index + 1} review note`} value={footageReviewNotes[index] ?? review?.note ?? ''} onChangeText={note => setFootageReviewNotes(current => ({ ...current, [index]: note }))} placeholder="Frames checked or changes needed (at least 10 characters)" multiline className="rounded border border-border px-2 py-1 text-xs text-foreground" /><View className="flex-row gap-3"><Pressable accessibilityRole="button" disabled={claimReviewSaving} onPress={() => void saveFootageReview(index, 'frame_checked')}><Text className="text-xs font-semibold text-accent">Record frame check</Text></Pressable><Pressable accessibilityRole="button" disabled={claimReviewSaving} onPress={() => void saveFootageReview(index, 'needs_changes')}><Text className="text-xs font-semibold text-accent">Needs changes</Text></Pressable></View></View>
                }) : <Text className="text-xs text-muted">No clip-specific crops were proposed. Review the full source and edit.</Text>}
                <Text className="text-xs font-semibold text-foreground">Independent reviewer findings</Text>
                <Text className="text-xs text-muted">A reviewer who did not build this edit should watch the master against Raw. FIX FIRST blocks web publishing; the same reviewer can record OK at the same output time after rechecking a false alarm.</Text>
                {creatorSkill.playbookPackage.independentReview?.map((entry, index) => <Text key={`independent-${index}`} className="text-xs text-muted">{entry.severity.replace('_', ' ').toUpperCase()} · {entry.outputTime.toFixed(2)}s · {entry.finding} · {entry.reviewer}{entry.masterMd5 !== creatorSkill.masterMd5 ? ' · Stale: master changed' : ''}</Text>)}
                {creatorSkill.playbookPackage.independentSignoff ? <Text className="text-xs text-muted">Full-master signoff: {creatorSkill.playbookPackage.independentSignoff.reviewer} · {creatorSkill.playbookPackage.independentSignoff.note}{creatorSkill.playbookPackage.independentSignoff.masterMd5 !== creatorSkill.masterMd5 ? ' · Stale: master changed' : ''}</Text> : null}
                <TextInput accessibilityLabel="Independent reviewer name" value={reviewerName} onChangeText={setReviewerName} placeholder="Reviewer name" className="rounded border border-border px-2 py-1 text-xs text-foreground" />
                <View className="flex-row gap-3">{(['fix_first', 'should_fix', 'ok'] as const).map(severity => <Pressable key={severity} accessibilityRole="button" onPress={() => setReviewSeverity(severity)}><Text className="text-xs font-semibold text-accent">{reviewSeverity === severity ? '✓ ' : ''}{severity.replace('_', ' ').toUpperCase()}</Text></Pressable>)}</View>
                <TextInput accessibilityLabel="Reviewer output time in seconds" value={reviewOutputTime} onChangeText={setReviewOutputTime} keyboardType="decimal-pad" placeholder="Output time (seconds)" className="rounded border border-border px-2 py-1 text-xs text-foreground" />
                <TextInput accessibilityLabel="Reviewer finding and correction" value={reviewFinding} onChangeText={setReviewFinding} placeholder="Evidence and correction" multiline className="rounded border border-border px-2 py-1 text-xs text-foreground" />
                <Pressable accessibilityRole="button" disabled={claimReviewSaving} onPress={() => void saveIndependentFinding()}><Text className="text-xs font-semibold text-accent">Save reviewer finding</Text></Pressable>
                <TextInput accessibilityLabel="Full-master review note" value={reviewSignoffNote} onChangeText={setReviewSignoffNote} placeholder="Full-master review of speech, sources, privacy, captions, audio, sponsors, and thumbnails" multiline className="rounded border border-border px-2 py-1 text-xs text-foreground" />
                <Pressable accessibilityRole="button" disabled={claimReviewSaving} onPress={() => void saveIndependentSignoff()}><Text className="text-xs font-semibold text-accent">Sign off after full review</Text></Pressable>
                <Text className="text-xs font-semibold text-foreground">Public brand references</Text>
                {creatorSkill.playbookPackage.brandReferences?.map((brand, index) => <Text key={`brand-${index}`} className="text-xs text-muted">{brand.name}: {brand.colors.join(', ')} · {brand.notes} · {brand.sourceUrl}</Text>)}
                <Text className="text-xs font-semibold text-foreground">Sponsor review</Text>
                {creatorSkill.playbookPackage.sponsors.map((sponsor, index) => <Text key={`sponsor-${index}`} className="text-xs text-muted">{sponsor.name} · {sponsor.confirmed ? 'Saved in profile' : 'Unconfirmed'} · {sponsor.review}</Text>)}
                <Text className="text-xs font-semibold text-foreground">Thumbnail concepts</Text>
                {creatorSkill.playbookPackage.thumbnailConcepts.map((concept, index) => <Text key={`thumb-${index}`} className="text-xs text-muted">{concept}</Text>)}
                {creatorSkill.thumbnailCandidates?.map(candidate => <Pressable key={`candidate-${candidate.index}`} accessibilityRole="button" onPress={() => void shareSkillThumbnailCandidate(candidate.index)}><Text className="text-xs font-semibold text-accent">Share VOD frame {candidate.index + 1} at {candidate.sourceTime.toFixed(1)}s</Text></Pressable>)}
                {creatorSkill.thumbnailVariants?.map(variant => <Pressable key={`variant-${variant.index}`} accessibilityRole="button" onPress={() => void shareSkillThumbnail(variant.index)}><Text className="text-xs font-semibold text-accent">Share thumbnail draft {String.fromCharCode(65 + variant.index)}: {variant.headline}</Text></Pressable>)}
                <Text className="text-xs font-semibold text-foreground">Platform copy</Text>
                {creatorSkill.playbookPackage.platformCopy.map((copy, index) => <Text key={`copy-${index}`} className="text-xs text-muted">{copy.platform}: {copy.title} · {copy.description} · Pinned comment: {copy.pinnedComment}</Text>)}
              </View>
            ) : null}
          </ScrollView>
        ) : null}
        {!editedPreview ? <View className="px-5 py-[10px]">
          <Tabs
            items={[
              { key: '16:9', label: '16:9 Landscape' },
              { key: '9:16', label: '9:16 Portrait' }
            ]}
            value={previewRatio}
            onChange={(ratio) => setPreviewRatio(ratio as '16:9' | '9:16')}
          />
        </View> : null}

        <ScrollView ref={scrollRef} className="flex-1" contentContainerClassName="flex-grow pb-2" bounces={false}>
          <View className="min-h-[180px] items-center justify-center px-5 py-2">
            <View
              className="overflow-hidden rounded-lg bg-black"
              style={{ width: previewWidth, height: previewHeight }}
            >
              {editedPreview && completedBuildPath ? <ExportPreview key={completedBuildPath} path={completedBuildPath} width={previewWidth} height={previewHeight} /> : <View
                className="relative h-full w-full"
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout
                  if (width > 0 && height > 0) {
                    setPreviewSize({ width, height })
                  }
                }}
              >
                {showFramedPreview && framingConfig ? (
                  <FramedVideoPreview
                    config={framingConfig}
                    targetRatio="9:16"
                    videoPath={videoPath}
                    currentTime={clipRelativeTime}
                    videoTime={currentTime}
                    playing={player.playing}
                    width={previewWidth}
                    height={previewHeight}
                  />
                ) : (
                  <VideoView
                    player={player}
                    style={{ width: '100%', height: '100%' }}
                    contentFit={previewRatio === '9:16' ? 'cover' : 'contain'}
                    nativeControls={false}
                    surfaceType="textureView"
                  />
                )}
                {captionsEnabled ? (
                  <SubtitleOverlay
                    settings={subtitleSettings}
                    words={subtitleWords}
                    currentTime={clipRelativeTime}
                    targetRatio={previewRatio}
                    frameWidth={previewSize.width}
                    frameHeight={previewSize.height}
                    sampleFallback
                  />
                ) : null}
              </View>}
            </View>
          </View>

          {!editedPreview ? <View className="h-12 items-center justify-center bg-background">
            <Text className="absolute left-4 font-mono text-xs text-muted">
              {formatClock(currentTime)} / {formatClock(selectEnd - selectStart)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={player.playing ? 'Pause' : 'Play'}
              onPress={() => {
                void playbackEpoch
                if (player.playing) {
                  player.pause()
                  return
                }
                if (currentTime < selectStart || currentTime >= selectEnd - 0.05) {
                  player.currentTime = selectStart
                  noteSeek(selectStart)
                }
                player.play()
              }}
              className="min-h-11 min-w-11 items-center justify-center"
            >
              <AppIcon name={player.playing ? 'Pause' : 'Play'} size={28} color={tokens.colors.foreground} />
            </Pressable>
          </View> : <Text className="px-5 py-3 text-xs text-muted">This is the latest completed build. Switch to Raw to adjust the source clip.</Text>}

          {!editedPreview ? <View className="mx-5">
            <MenuRow
              icon="Scissors"
              title="Clip range"
              subtitle={`${formatClock(selectStart)} – ${formatClock(selectEnd)}`}
              onPress={() => {
                player.pause()
                setRangeVisible(true)
              }}
            />
          </View> : null}
          {!editedPreview ? <View className="mx-5">
            <MenuRow
              icon="Captions"
              title="Captions"
              subtitle={
                aiBusy
                  ? aiProgress?.message || 'Transcribing…'
                  : hasTranscript
                    ? captionsEnabled
                      ? 'On · Style and timing'
                      : 'Off · Style and timing'
                    : 'Generate a transcript'
              }
              onPress={() => {
                if (aiBusy) return
                if (hasTranscript) setShowSubtitleSheet(true)
                else void runTranscribe()
              }}
            />
            {clip.project_id ? (
              <MenuRow
                icon="Smartphone"
                title="Portrait framing"
                subtitle={hasVisibleFraming(framingConfig) ? 'Configured · 9:16' : 'Choose what stays in frame'}
                onPress={() =>
                  router.push({
                    pathname: '/framing/[projectId]',
                    params: {
                      projectId: clip.project_id!,
                      clipId,
                      clipStart: String(selectStart),
                      clipEnd: String(selectEnd),
                      ratio: '9:16'
                    }
                  })
                }
              />
            ) : null}
          </View> : null}

          {aiProgress && aiBusy ? (
            <View className="mx-4 mt-2 flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-xs text-muted">{aiProgress.message}</Text>
              <Pressable
                onPress={() => {
                  aiPipelineRef.current?.cancel()
                  setAiProgress({ stage: 'idle', progress: 0, message: 'Cancelling…' })
                }}
                className="rounded-lg border border-border px-3 py-1.5"
              >
                <Text className="text-xs font-semibold text-foreground">Cancel</Text>
              </Pressable>
            </View>
          ) : null}

          <View className="gap-3 px-5 pb-6 pt-[17px]">
            <Button title="Open editor" variant="accent" onPress={() => void openEditor()} />
            <Button title="Export" variant="outline" onPress={() => void openExport()} />
          </View>
        </ScrollView>
      </SafeAreaView>

      <BottomSheet visible={skillProfilePickerVisible} title="Creator profile for this edit" onClose={() => setSkillProfilePickerVisible(false)} primaryAction={{ title: 'Review AI edit cost', onPress: () => { setSkillProfilePickerVisible(false); void requestSkillEdit(false, skillProfileId) } }}>
        <Text className="text-sm text-muted">Optional. Saved branding, editing rules, sponsor details, and selected intro or outro assets for the clip&apos;s format are used only when a profile is chosen.</Text>
        {[{ id: null, name: 'No creator profile' }, ...skillProfiles].map(profile => <Pressable key={profile.id ?? 'none'} accessibilityRole="button" accessibilityState={{ selected: skillProfileId === profile.id }} onPress={() => setSkillProfileId(profile.id)} className={`mt-2 rounded-lg border px-3 py-2 ${skillProfileId === profile.id ? 'border-accent bg-accent/10' : 'border-border'}`}><Text className="text-sm text-foreground">{profile.name}</Text></Pressable>)}
      </BottomSheet>

      <BottomSheet
        visible={rangeVisible}
        title="Clip range"
        onClose={() => setRangeVisible(false)}
        primaryAction={{ title: 'Done', onPress: () => setRangeVisible(false) }}
      >
        <AdjustClipToolBar
          bufferStart={bufferStart}
          bufferEnd={bufferEnd}
          selectStart={selectStart}
          selectEnd={selectEnd}
          mediaDuration={mediaDuration}
          dirty={dirty}
          onExtend={handleExtend}
          onReset={handleReset}
        />

        <AdjustClipTimeline
          videoPath={videoPath}
          bufferStart={bufferStart}
          bufferEnd={bufferEnd}
          selectStart={selectStart}
          selectEnd={selectEnd}
          mediaDuration={mediaDuration}
          currentTime={currentTime}
          onSeek={seekTo}
          onSelectionChange={({ selectStart: nextStart, selectEnd: nextEnd }) => {
            setSelectStart(nextStart)
            setSelectEnd(nextEnd)
          }}
          onExtendBuffer={handleExtend}
        />
      </BottomSheet>

      <SubtitleSheet
        visible={showSubtitleSheet}
        settings={subtitleSettings}
        hasTranscript={hasTranscript}
        onClose={() => setShowSubtitleSheet(false)}
        onSave={(enabled, presetId, settings) => {
          const next = { ...settings, enabled, selectedPresetId: presetId }
          setSubtitleSettings(next)
          void (async () => {
            await updateClipSubtitleSettings(clipId, enabled, presetId, next)
            if (clip.project_id) {
              const { queueProjectSync } = await import('@/services/cloudSync')
              void queueProjectSync(clip.project_id)
            }
          })()
        }}
      />
      <ExportSheet
        visible={exportVisible}
        progress={exportProgress}
        title="Export clip"
        showRemux={false}
        onClose={() => setExportVisible(false)}
        onExport={({ ratios }) => startExport(ratios)}
      />
    </View>
  )
}

export default function ClipWorkspaceScreen() {
  const { id: clipId } = useLocalSearchParams<{ id: string }>()
  const [clip, setClip] = useState<Clip | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [mediaDuration, setMediaDuration] = useState(0)
  const [hasTranscript, setHasTranscript] = useState(false)
  const [transcriptJson, setTranscriptJson] = useState<string | null>(null)
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadClip = useCallback(async () => {
    if (!clipId) return
    setLoading(true)
    setError(null)
    try {
      const clipRow = await getClipById(clipId)
      if (!clipRow) {
        setClip(null)
        setError('Clip is missing from device storage.')
        return
      }
      const projectId = clipRow.project_id
      const [projectRow, rawVideo, transcript, subs] = await Promise.all([
        projectId ? getProject(projectId) : Promise.resolve(null),
        projectId ? getRawVideoByProjectId(projectId) : Promise.resolve(null),
        projectId ? getTranscriptByProjectId(projectId) : Promise.resolve(null),
        getClipSubtitleSettings(clipId)
      ])
      let nextPath = rawVideo?.file_path ?? clipRow.file_path
      if (!nextPath || nextPath.startsWith('pending://') || nextPath.startsWith('clip://')) {
        throw new Error('VOD file is missing from device storage.')
      }
      const playable = await ensurePlayableVideo(nextPath)
      if (playable !== nextPath && projectId) {
        await updateRawVideoFilePath(projectId, playable)
      }
      nextPath = playable

      const duration = Math.max(
        rawVideo?.duration ?? 0,
        clipRow.end_time ?? 0,
        (clipRow.start_time ?? 0) + (clipRow.duration ?? 0),
        1
      )

      setClip(clipRow)
      setProject(projectRow)
      setVideoPath(nextPath)
      setMediaDuration(duration)
      setHasTranscript(!!transcript)
      setTranscriptJson(transcript?.raw_json ?? null)
      setSubtitleSettings(subs)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
      setClip(null)
    } finally {
      setLoading(false)
    }
  }, [clipId])

  useEffect(() => {
    void loadClip()
  }, [loadClip])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.accent} />
        <Text className="mt-3 text-xs text-muted">Loading clip…</Text>
      </View>
    )
  }

  if (!clip || !videoPath || !clipId || error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-muted">{error ?? 'Clip is missing from device storage.'}</Text>
      </View>
    )
  }

  return (
    <ClipAdjustWorkspace
      clipId={clipId}
      clip={clip}
      project={project}
      videoPath={videoPath}
      mediaDuration={mediaDuration}
      hasTranscript={hasTranscript}
      transcriptJson={transcriptJson}
      initialSettings={subtitleSettings}
      onReload={loadClip}
    />
  )
}

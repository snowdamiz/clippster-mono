import { AppIcon } from '@/components/AppIcon'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, Switch, Text, View } from 'react-native'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { VodTimeRangePicker, type TimeRangeValue } from '@/components/download/VodTimeRangePicker'
import { CaptionPresetPicker } from '@/components/subtitles/CaptionPresetPicker'
import { DEFAULT_CAPTION_PRESET_ID } from '@/lib/captionPresets'
import { DEFAULT_DETECTION_PROMPTS, type DetectionPrompt } from '@/lib/detectionPrompts'
import { tokens } from '@/theme/tokens'
import { creatorSkillPolicy } from '@/services/creatorSkillWeb'
import { userBrandingApi } from '@/services/api'

export interface ClipDetectionPlan {
  prompt: DetectionPrompt
  startTime: number
  endTime: number
  enhanced: boolean
  subtitlesEnabled: boolean
  subtitlePresetId: string
  creatorSkillEnabled: boolean
  creatorProfileId: number | null
}

interface ClipDetectionSheetProps {
  visible: boolean
  videoDuration: number
  starting: boolean
  onClose: () => void
  onConfirm: (plan: ClipDetectionPlan) => void
}

export function ClipDetectionSheet({ visible, videoDuration, starting, onClose, onConfirm }: ClipDetectionSheetProps) {
  const total = Math.max(0, Math.floor(videoDuration))
  const [promptId, setPromptId] = useState(DEFAULT_DETECTION_PROMPTS[0].id)
  const [showPrompts, setShowPrompts] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRangeValue>({ startTime: 0, endTime: total })
  const [enhanced, setEnhanced] = useState(false)
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false)
  const [subtitlePresetId, setSubtitlePresetId] = useState(DEFAULT_CAPTION_PRESET_ID)
  const [creatorSkillEnabled, setCreatorSkillEnabled] = useState(false)
  const [creatorSkillCredits, setCreatorSkillCredits] = useState<number | null>(null)
  const [creatorProfiles, setCreatorProfiles] = useState<Array<{ id: number; name: string }>>([])
  const [creatorProfileId, setCreatorProfileId] = useState<number | null>(null)

  useEffect(() => {
    if (!visible) return
    setTimeRange({ startTime: 0, endTime: total })
    setShowPrompts(false)
    setCreatorSkillCredits(null)
    void userBrandingApi.getBundle().then(bundle => {
      setCreatorProfiles(bundle.success ? bundle.profiles.filter(profile => !profile.disabled).map(profile => ({ id: profile.id, name: profile.name })) : [])
    }).catch(() => setCreatorProfiles([]))
    void creatorSkillPolicy().then(policy => {
      if (!Number.isFinite(policy.credits.generate) || policy.credits.generate < 0) throw new Error('Invalid AI edit cost')
      setCreatorSkillCredits(policy.credits.generate)
    }).catch(() => { setCreatorSkillEnabled(false); setCreatorSkillCredits(null) })
  }, [visible, total])

  const selectedPrompt = useMemo(
    () => DEFAULT_DETECTION_PROMPTS.find((prompt) => prompt.id === promptId) ?? DEFAULT_DETECTION_PROMPTS[0],
    [promptId]
  )

  const selectedDuration = Math.max(0, timeRange.endTime - timeRange.startTime)
  const canConfirm = !starting && (total <= 0 || selectedDuration >= 10) && (!creatorSkillEnabled || creatorSkillCredits !== null)

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="page"
      title="Find clips with AI"
      primaryAction={{
        title: starting ? 'Detecting…' : 'Start detection',
        disabled: !canConfirm,
        onPress: () =>
          onConfirm({
            prompt: selectedPrompt,
            startTime: timeRange.startTime,
            endTime: timeRange.endTime,
            enhanced: false,
            subtitlesEnabled,
            subtitlePresetId,
            creatorSkillEnabled,
            creatorProfileId: creatorSkillEnabled ? creatorProfileId : null
          })
      }}
      secondaryAction={{ title: 'Cancel', onPress: onClose, disabled: starting }}
    >
      <View className="rounded-[18px] bg-surface px-3 py-2">
        <Text className="text-xs text-muted">Video duration</Text>
        <Text className="text-sm font-medium text-foreground">
          {Math.floor(total / 60)}m {total % 60}s
        </Text>
      </View>

      {creatorSkillEnabled && creatorProfiles.length ? (
        <View className="gap-2 rounded-[18px] bg-surface px-3 py-3">
          <Text className="text-sm font-medium text-foreground">Creator profile (optional)</Text>
          <Text className="text-xs text-muted">Use saved brand and sponsor preferences for these edits.</Text>
          {[{ id: null, name: 'No creator profile' }, ...creatorProfiles].map(profile => (
            <Pressable key={profile.id ?? 'none'} onPress={() => setCreatorProfileId(profile.id)} className={`rounded-lg border px-3 py-2 ${creatorProfileId === profile.id ? 'border-accent bg-accent/10' : 'border-border'}`}>
              <Text className="text-sm text-foreground">{profile.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {total > 0 ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Detection time range</Text>
          <View className="rounded-[18px] bg-surface p-3">
            <VodTimeRangePicker totalDuration={total} value={timeRange} onChange={setTimeRange} />
          </View>
        </View>
      ) : null}

      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Detection prompt</Text>
        <Pressable
          onPress={() => setShowPrompts((open) => !open)}
          className="flex-row items-center justify-between rounded-[18px] bg-surface px-3 py-3"
        >
          <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
            {selectedPrompt.name}
          </Text>
          <AppIcon name={showPrompts ? 'ChevronUp' : 'ChevronDown'} size={16} color={tokens.colors.muted} />
        </Pressable>
        {showPrompts
          ? DEFAULT_DETECTION_PROMPTS.map((prompt) => (
              <Pressable
                key={prompt.id}
                onPress={() => {
                  setPromptId(prompt.id)
                  setShowPrompts(false)
                }}
                className={`rounded-lg border px-3 py-2 ${
                  prompt.id === promptId ? 'border-accent bg-accent/10' : 'border-border bg-surface'
                }`}
              >
                <Text className="text-sm text-foreground">{prompt.name}</Text>
              </Pressable>
            ))
          : null}
      </View>

      <View className="rounded-[18px] bg-surface px-3 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-medium text-foreground">Enhanced detection</Text>
              <Text className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">2× credits</Text>
            </View>
            <Text className="mt-1 text-xs text-muted">
              Video + audio analysis is desktop-only. Mobile uses transcript detection.
            </Text>
          </View>
          <Switch
            value={enhanced}
            onValueChange={setEnhanced}
            disabled
            trackColor={{ false: tokens.colors.border, true: tokens.colors.accent }}
          />
        </View>
      </View>

      <View className="rounded-[18px] bg-surface px-3 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-sm font-medium text-foreground">Pre-edit clips using Clippster Skill</Text>
            <Text className="mt-1 text-xs text-muted">Uploads this downloaded VOD and its transcript to your private web workspace. Each detected clip then gets an AI edit and creator playbook. Raw stays available.</Text>
          </View>
          <Switch value={creatorSkillEnabled} onValueChange={setCreatorSkillEnabled} disabled={creatorSkillCredits === null} trackColor={{ false: tokens.colors.border, true: tokens.colors.accent }} />
        </View>
        <Text className="mt-2 text-xs text-muted">{creatorSkillCredits === null ? 'AI editing cost is unavailable right now.' : `${creatorSkillCredits} personal credits per detected clip, plus detection. You will review the exact total after detection before edits start. VOD stills have no separate thumbnail charge. Saved creator preferences, clip speech, and selected creator intro or outro files for each clip's format go to the AI editor. Finished audio from clips under 30 minutes goes to Clippster's transcription service for QA with no extra personal-credit charge if you approve.`}</Text>
      </View>

      <View className="rounded-[18px] bg-surface px-3 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-sm font-medium text-foreground">Include captions</Text>
            <Text className="mt-1 text-xs text-muted">Automatically add captions to all detected clips</Text>
          </View>
          <Switch
            value={subtitlesEnabled}
            onValueChange={setSubtitlesEnabled}
            trackColor={{ false: tokens.colors.border, true: tokens.colors.accent }}
          />
        </View>

        {subtitlesEnabled ? (
          <View className="mt-3 gap-2">
            <Text className="text-xs font-semibold text-muted">Subtitle style</Text>
            <CaptionPresetPicker selectedId={subtitlePresetId} onSelect={setSubtitlePresetId} />
          </View>
        ) : null}
      </View>

      <View className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-3">
        <Text className="text-sm font-medium text-foreground">Credit cost</Text>
        <Text className="mt-1 text-xs text-muted">
          Detection uses AI credits for the selected time range. Transcribe first if this VOD does not have a transcript
          yet.
        </Text>
      </View>
    </BottomSheet>
  )
}

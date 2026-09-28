import type { SubtitleSettings } from '@clippster/shared-types'
import { createDefaultSubtitleSettings } from '@clippster/shared-types'
import { useEffect, useState } from 'react'
import { Switch, Text, View } from 'react-native'

import { CaptionStylePanel } from '@/components/subtitles/CaptionStylePanel'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { MenuRow } from '@/components/navigation/MenuRow'
import { Button } from '@/components/ui/button'
import { CaptionPresetPicker } from './CaptionPresetPicker'
import { CAPTION_PRESETS, settingsFromPresetId } from '@/lib/captionPresets'
import { tokens } from '@/theme/tokens'

interface SubtitleSheetProps {
  visible: boolean
  settings: SubtitleSettings | null
  hasTranscript: boolean
  onEditWords?: () => void
  onClose: () => void
  onSave: (enabled: boolean, presetId: string, settings: SubtitleSettings) => void
}

export function SubtitleSheet({ visible, settings, hasTranscript, onClose, onSave, onEditWords }: SubtitleSheetProps) {
  const [draft, setDraft] = useState<SubtitleSettings>(settings ?? createDefaultSubtitleSettings())
  const [enabled, setEnabled] = useState(settings?.enabled ?? false)
  const [page, setPage] = useState<'captions' | 'presets' | 'style'>('captions')

  useEffect(() => {
    if (!visible) return
    setPage('captions')
    setDraft(settings ?? createDefaultSubtitleSettings())
    setEnabled(settings?.enabled ?? false)
  }, [visible, settings])

  function persist(nextEnabled: boolean, nextSettings: SubtitleSettings) {
    const presetId = nextSettings.selectedPresetId ?? 'tiktok-bold'
    onSave(nextEnabled, presetId, {
      ...nextSettings,
      enabled: nextEnabled,
      selectedPresetId: presetId
    })
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="sheet"
      title={page === 'presets' ? 'Caption presets' : page === 'style' ? 'Style & position' : 'Captions'}
      subtitle={hasTranscript ? undefined : 'Transcribe for timed captions. Styles still preview on sample text.'}
      scrollable
      maxHeightClassName="max-h-[88%]"
      primaryAction={{
        title: 'Done',
        variant: 'accent',
        onPress: () => {
          persist(enabled, draft)
          onClose()
        }
      }}
    >
      {!hasTranscript ? (
        <Text className="rounded-xl bg-surfaceMuted p-3 text-sm leading-5 text-muted">
          Transcribe first for timed captions. Styles still apply to sample text.
        </Text>
      ) : null}
      {page !== 'captions' ? (
        <Button title="‹ Captions" variant="ghost" onPress={() => setPage('captions')} />
      ) : (
        <>
          <View className="min-h-[60px] flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-foreground">Show captions</Text>
            <Switch
              accessibilityLabel="Show captions"
              value={enabled}
              onValueChange={(next) => {
                setEnabled(next)
                persist(next, draft)
              }}
              trackColor={{ true: tokens.colors.accent }}
            />
          </View>
          {hasTranscript && onEditWords ? <MenuRow icon="text-outline" title="Caption words" subtitle="Edit wording and timing" onPress={onEditWords} /> : null}
          <MenuRow
            icon="sparkles-outline"
            title="Preset"
            value={CAPTION_PRESETS.find((preset) => preset.id === draft.selectedPresetId)?.name}
            onPress={() => setPage('presets')}
          />
          <MenuRow
            icon="text-outline"
            title="Style & position"
            subtitle="Font, animation, colors, and placement"
            onPress={() => setPage('style')}
          />
        </>
      )}
      {page === 'presets' ? (
        <CaptionPresetPicker
          selectedId={draft.selectedPresetId ?? 'tiktok-bold'}
          onSelect={(presetId) => {
            const next = { ...settingsFromPresetId(presetId), enabled }
            setDraft(next)
            persist(enabled, next)
          }}
        />
      ) : null}
      {page === 'style' ? (
        <CaptionStylePanel
          enabled={enabled}
          settings={draft}
          onChange={(next) => {
            setEnabled(next.enabled)
            setDraft(next.settings)
            persist(next.enabled, next.settings)
          }}
        />
      ) : null}
    </BottomSheet>
  )
}

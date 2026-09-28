import type { TargetAspectRatio } from '@clippster/shared-types'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import { router } from 'expo-router'
import { useState } from 'react'
import { Switch, Text, View } from 'react-native'
import { appAlert } from '@/lib/appAlert'
import { PostSheet } from '@/components/schedule/PostSheet'
import { Button } from '@/components/ui/button'
import { ExportPreview } from './ExportPreview'
import { EmptyState } from '@/components/ui/EmptyState'
import { BottomSheet } from '@/components/ui/BottomSheet'

import type { EditorExportProgress as ClipBuildProgress } from '@/editor/export/exportProgress'
import { cancelFfmpeg } from '@/services/ffmpeg'

interface ExportSheetProps {
  visible: boolean
  progress: ClipBuildProgress | null
  onClose: () => void
  onExport: (options: { ratios: TargetAspectRatio[]; remuxOnly: boolean }) => void
  title?: string
  showRemux?: boolean
}

export function ExportSheet({
  visible,
  progress,
  onClose,
  onExport,
  title = 'Export clip',
  showRemux = true
}: ExportSheetProps) {
  const [ratio916, setRatio916] = useState(true)
  const [ratio169, setRatio169] = useState(false)
  const [remuxOnly, setRemuxOnly] = useState(false)
  const [saving, setSaving] = useState(false)
  const [postBuildId, setPostBuildId] = useState<string | null>(null)

  if (!visible && !postBuildId) return null

  const building = progress?.state === 'building'
  const completedPaths = progress?.state === 'complete' ? (progress.outputPaths ?? []) : []
  const canStart = ratio916 || ratio169

  function startExport() {
    const ratios: TargetAspectRatio[] = []
    if (ratio916) ratios.push('9:16')
    if (ratio169) ratios.push('16:9')
    if (ratios.length > 0) onExport({ ratios, remuxOnly })
  }

  async function saveToCameraRoll() {
    if (!completedPaths.length) return
    setSaving(true)
    try {
      const permission = await MediaLibrary.requestPermissionsAsync()
      if (!permission.granted) {
        appAlert('Permission needed', 'Allow photo library access to save exports.')
        return
      }
      for (const path of completedPaths) {
        await MediaLibrary.saveToLibraryAsync(path)
      }
      appAlert('Saved', 'Exported clip saved to your camera roll.')
    } catch (error) {
      appAlert('Save failed', error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  async function shareExport() {
    if (!completedPaths[0]) return
    try {
      if (!(await Sharing.isAvailableAsync())) {
        appAlert('Unavailable', 'Sharing is not available on this device.')
        return
      }
      await Sharing.shareAsync(completedPaths[0], { mimeType: 'video/mp4' })
    } catch (error) {
      appAlert('Share failed', error instanceof Error ? error.message : String(error))
    }
  }

  function openPost() {
    if (!progress?.buildIds?.length) return
    setPostBuildId(progress.buildIds[0])
    onClose()
  }

  return (
    <>
      {visible ? (
        <BottomSheet
          visible={visible}
          onClose={building ? () => undefined : onClose}
          variant={completedPaths.length ? 'page' : 'sheet'}
          title={
            building
              ? 'Exporting'
              : completedPaths.length
                ? 'Ready to share'
                : progress?.state === 'error'
                  ? 'Export needs attention'
                  : title
          }
          dismissOnBackdrop={!building}
          primaryAction={
            building
              ? { title: 'Cancel export', variant: 'outline', onPress: cancelFfmpeg }
              : completedPaths.length
                ? progress?.buildIds?.length
                  ? { title: 'Publish or schedule', onPress: openPost }
                  : undefined
                : {
                    title: progress?.state === 'error' ? 'Try export again' : 'Export selected formats',
                    onPress: startExport,
                    disabled: !canStart
                  }
          }
          secondaryAction={
            !building && !completedPaths.length
              ? { title: 'Back to editor', onPress: onClose, variant: 'ghost' }
              : undefined
          }
        >
          {completedPaths.length ? (
            <>
              <ExportPreview path={completedPaths[0]} />
              <Text className="self-start rounded-[7px] bg-surfaceMuted px-2 py-[5px] text-[11px] text-success">
                Export complete
              </Text>
              <Text className="text-sm text-muted">
                {completedPaths.length === 1
                  ? 'Your clip is ready to share.'
                  : `${completedPaths.length} formats are ready to share.`}
              </Text>
              <Button
                title={saving ? 'Saving…' : 'Save to Photos'}
                variant="outline"
                disabled={saving}
                onPress={() => void saveToCameraRoll()}
              />
              <Button title="Share…" variant="outline" onPress={() => void shareExport()} />
              <Button
                title="View Exports"
                variant="ghost"
                onPress={() => {
                  onClose()
                  router.push('/(tabs)/clips')
                }}
              />
              <Button title="Export again" variant="ghost" onPress={startExport} disabled={!canStart} />
            </>
          ) : building ? (
            <>
              <EmptyState
                icon="film-outline"
                title="Making your clip"
                subtitle="Keep Clippster open until the export finishes."
              />
              <Text accessibilityLiveRegion="polite" className="text-sm font-semibold text-foreground">
                {progress?.message}
              </Text>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round((progress?.progress ?? 0) * 100) }}
                className="h-2 overflow-hidden rounded-full bg-border"
              >
                <View
                  className="h-full bg-accent"
                  style={{ width: `${Math.max(0, Math.min(100, Math.round((progress?.progress ?? 0) * 100)))}%` }}
                />
              </View>
            </>
          ) : (
            <>
              {progress?.state === 'error' ? (
                <Text className="rounded-xl bg-destructive/10 p-4 text-sm leading-[21px] text-destructive">
                  {progress.error || progress.message || 'We couldn’t finish this export. Your draft is still saved.'}
                </Text>
              ) : null}
              <Text className="text-[17px] font-semibold text-foreground">Choose formats</Text>
              <View className="rounded-[18px] bg-surfaceMuted px-4">
                <View className="min-h-[60px] flex-row items-center justify-between border-b border-border">
                  <Text className="text-sm text-foreground">9:16 · Portrait</Text>
                  <Switch accessibilityLabel="Export portrait format" value={ratio916} onValueChange={setRatio916} />
                </View>
                <View className="min-h-[60px] flex-row items-center justify-between">
                  <Text className="text-sm text-foreground">16:9 · Landscape</Text>
                  <Switch accessibilityLabel="Export landscape format" value={ratio169} onValueChange={setRatio169} />
                </View>
              </View>
              {showRemux ? (
                <>
                  <View className="min-h-[60px] flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-sm text-foreground">Remux only · no overlays</Text>
                    <Switch
                      accessibilityLabel="Remux only without overlays"
                      value={remuxOnly}
                      onValueChange={setRemuxOnly}
                    />
                  </View>
                  <Text className="text-sm leading-[21px] text-muted">
                    Fast copy without overlays. Available only for compatible exports.
                  </Text>
                </>
              ) : (
                <Text className="text-sm leading-[21px] text-muted">
                  Export includes your clips, audio, images, and captions.
                </Text>
              )}
            </>
          )}
        </BottomSheet>
      ) : null}
      <PostSheet visible={postBuildId != null} buildId={postBuildId} onClose={() => setPostBuildId(null)} />
    </>
  )
}

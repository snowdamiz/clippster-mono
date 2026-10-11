import {
  createDefaultManualFramingConfig,
  createDefaultManualRegion,
  MAX_POI_REGIONS,
  type ActiveVodPresetConfig,
  type ManualRegion
} from '@clippster/shared-types'
import type { VideoPlayer } from 'expo-video'
import { useState } from 'react'
import { Pressable, ScrollView, Switch, Text, useWindowDimensions, View } from 'react-native'
import { AppIcon } from '@/components/AppIcon'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Tabs } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SeekBar } from '@/components/ui/seek-bar'
import { QuickAction } from '@/components/navigation/QuickAction'
import { appAlert } from '@/lib/appAlert'
import { formatClock } from '@/lib/formatTime'
import { VideoPlayerControls } from '@/components/editor/VideoPlayerControls'
import { tokens } from '@/theme/tokens'
import { SourcePanel } from './SourcePanel'
import { TargetPanel } from './TargetPanel'
import { FramedVideoPreview } from './FramedVideoPreview'
import { getActiveFramingRegions, replaceActiveFramingRegions } from './framingRegions'
import { useFramingHistory } from './useFramingHistory'
import { validateLayoutTiming } from './framingHistory'
import { pickFramingMedia } from '@/services/framingMedia'
import { createNativeEditorId } from '@/editor/model/nativeIds'

interface FramingEditorProps {
  config: ActiveVodPresetConfig
  currentTime: number
  videoTime: number
  player: VideoPlayer | null
  videoPath: string
  duration: number
  playing: boolean
  onSeek: (seconds: number) => void
  onTogglePlay: () => void
  onSave: (config: ActiveVodPresetConfig) => Promise<void>
}
const GUIDES = [
  { key: 'none', label: 'Off', left: 0, top: 0, right: 0, bottom: 0 },
  { key: 'tiktok', label: 'TikTok', left: 0.06, top: 0.1, right: 0.18, bottom: 0.2 },
  { key: 'reels', label: 'Instagram Reels', left: 0.06, top: 0.12, right: 0.06, bottom: 0.2 },
  { key: 'shorts', label: 'YouTube Shorts', left: 0.06, top: 0.1, right: 0.18, bottom: 0.18 }
]
export function FramingEditor({
  config,
  currentTime,
  videoTime,
  player,
  videoPath,
  duration,
  playing,
  onSeek,
  onTogglePlay,
  onSave
}: FramingEditorProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const history = useFramingHistory({
    ...(config.framingConfig ?? createDefaultManualFramingConfig('9:16')),
    targetAspectRatio: '9:16'
  })
  const framing = history.config
  const [tab, setTab] = useState<'source' | 'output'>('source')
  const [saving, setSaving] = useState(false)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(framing.regions[0]?.id ?? null)
  const [panel, setPanel] = useState<'region' | 'layouts' | 'background' | 'safe' | 'stack' | 'media' | null>(null)
  const [mediaBusy, setMediaBusy] = useState(false)
  const [brollStart, setBrollStart] = useState('0')
  const [brollEnd, setBrollEnd] = useState(String(Math.min(5, duration)))
  const [layoutId, setLayoutId] = useState<string | null>(null)
  const [timingStart, setTimingStart] = useState('')
  const [timingEnd, setTimingEnd] = useState('')
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [timingOpen, setTimingOpen] = useState(false)
  const [safeZone, setSafeZone] = useState('none')
  const selectedSegment = framing.segmentConfigs?.find((segment) => segment.segmentId === layoutId)
  const evaluationTime =
    playing || layoutId == null
      ? currentTime
      : layoutId === 'default'
        ? -1
        : selectedSegment
          ? selectedSegment.startTime
          : currentTime
  const { regions, segmentIndex } = getActiveFramingRegions(framing, evaluationTime)
  const selectedRegion = regions.find((region) => region.id === selectedRegionId)
  const activeSegment = segmentIndex >= 0 ? framing.segmentConfigs?.[segmentIndex] : undefined
  const sourceWidth = Math.min(windowWidth - 40, 480)
  const targetWidth = Math.min(windowWidth - 80, Math.max(180, ((windowHeight - 380) * 9) / 16), 280)
  const guide = safeZone === 'none' ? undefined : GUIDES.find((item) => item.key === safeZone)
  function closePanel() {
    history.end()
    setPanel(null)
  }
  function openPanel(next: typeof panel) {
    history.begin()
    setPanel(next)
  }
  function patchRegion(patch: Partial<ManualRegion>) {
    if (!selectedRegion) return
    history.change(
      replaceActiveFramingRegions(
        framing,
        segmentIndex,
        regions.map((region) => (region.id === selectedRegion.id ? { ...region, ...patch } : region))
      )
    )
  }
  function addRegion() {
    if (regions.length >= MAX_POI_REGIONS) {
      appAlert('Region limit', 'A layout can contain up to ' + MAX_POI_REGIONS + ' regions.')
      return
    }
    const region = {
      ...createDefaultManualRegion(regions.length),
      id: createNativeEditorId('region'),
      aspectRatioLocked: false
    }
    history.change(replaceActiveFramingRegions(framing, segmentIndex, [...regions, region]))
    setSelectedRegionId(region.id)
  }
  function removeRegion() {
    if (!selectedRegion) return
    history.change(
      replaceActiveFramingRegions(
        framing,
        segmentIndex,
        regions.filter((region) => region.id !== selectedRegion.id)
      )
    )
    setSelectedRegionId(null)
    closePanel()
  }
  async function addMedia(timed = false) {
    if (mediaBusy) return
    const start = Number(brollStart),
      end = Number(brollEnd)
    if (timed && (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration)) {
      appAlert('Check timing', 'Enter a start and end within this clip.')
      return
    }
    if (!timed && !selectedRegion && regions.length >= MAX_POI_REGIONS) {
      appAlert('Region limit', 'Select a region to replace its media.')
      return
    }
    setMediaBusy(true)
    try {
      const media = await pickFramingMedia()
      if (!media) return
      const region = {
        ...(selectedRegion ?? createDefaultManualRegion(regions.length)),
        id: timed || !selectedRegion ? createNativeEditorId('media') : selectedRegion.id,
        label: media.name,
        mediaAssetId: media.uri,
        mediaType: media.type,
        mediaSourceOffset: 0,
        source: { x: 0, y: 0, width: 1, height: 1 }
      }
      history.end()
      if (timed)
        history.change({
          ...framing,
          brollConfigs: [
            ...(framing.brollConfigs ?? []),
            { brollId: createNativeEditorId('broll'), startTime: start, endTime: end, region }
          ]
        })
      else {
        history.change(
          replaceActiveFramingRegions(
            framing,
            segmentIndex,
            selectedRegion
              ? regions.map((item) => (item.id === selectedRegion.id ? region : item))
              : [...regions, region]
          )
        )
        setSelectedRegionId(region.id)
      }
      closePanel()
    } catch (error) {
      appAlert('Could not add media', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setMediaBusy(false)
    }
  }
  function chooseLayout(id: string) {
    setLayoutId(id)
    setSelectedRegionId(null)
    setPanel(null)
    const segment = framing.segmentConfigs?.find((item) => item.segmentId === id)
    if (playing) onTogglePlay()
    if (segment) onSeek(segment.startTime)
  }
  function editTiming(id: string | null) {
    const segment = framing.segmentConfigs?.find((item) => item.segmentId === id)
    setEditingSegmentId(id)
    setTimingStart(String(segment?.startTime ?? Math.floor(currentTime)))
    setTimingEnd(String(segment?.endTime ?? Math.min(duration, Math.floor(currentTime) + 5)))
    setTimingOpen(true)
  }
  function saveTiming() {
    const start = Number(timingStart),
      end = Number(timingEnd)
    const error = validateLayoutTiming(framing, editingSegmentId, start, end, duration)
    if (error) {
      appAlert('Check timing', error)
      return
    }
    const id = editingSegmentId ?? createNativeEditorId('layout')
    const segments = [...(framing.segmentConfigs ?? [])]
    const index = segments.findIndex((segment) => segment.segmentId === id)
    if (index >= 0) segments[index] = { ...segments[index], startTime: start, endTime: end }
    else
      segments.push({
        segmentId: id,
        startTime: start,
        endTime: end,
        regions: regions.map((region) => ({ ...region, source: { ...region.source }, output: { ...region.output } }))
      })
    history.end()
    history.change({ ...framing, segmentConfigs: segments.sort((a, b) => a.startTime - b.startTime) })
    setTimingOpen(false)
    chooseLayout(id)
    onSeek(start)
  }
  async function save() {
    history.end()
    setSaving(true)
    try {
      await onSave({ ...config, targetAspectRatio: '9:16', framingConfig: framing })
    } catch (error) {
      appAlert('Could not save framing', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }
  const regionRows = (
    <View className="gap-2">
      {regions.map((region, index) => (
        <Pressable
          key={region.id}
          accessibilityRole="button"
          onPress={() => {
            setSelectedRegionId(region.id)
            openPanel('region')
          }}
          className="min-h-[48px] flex-row items-center gap-3 rounded-[14px] border border-border bg-surface px-3"
        >
          <View style={{ backgroundColor: region.color }} className="h-4 w-4 rounded-full" />
          <Text className="flex-1 text-sm text-foreground">{region.label ?? 'Region ' + (index + 1)}</Text>
          <AppIcon name="EllipsisVertical" size={20} color={tokens.colors.muted} />
        </Pressable>
      ))}
      <Button
        title={'＋ Add region (' + regions.length + ' of ' + MAX_POI_REGIONS + ')'}
        variant="outline"
        onPress={addRegion}
      />
    </View>
  )
  return (
    <View className="flex-1">
      <View className="gap-2 px-5 pb-3">
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              history.end()
              setPanel('layouts')
            }}
            className="min-h-11 flex-1 flex-row items-center justify-between rounded-[14px] border border-border bg-surfaceMuted px-3"
          >
            <Text className="text-sm text-foreground">
              {activeSegment
                ? formatClock(activeSegment.startTime) + ' – ' + formatClock(activeSegment.endTime)
                : 'Default layout'}
            </Text>
            <AppIcon name="ChevronDown" size={18} color={tokens.colors.muted} />
          </Pressable>
          <Pressable
            accessibilityLabel="Undo framing"
            disabled={!history.canUndo}
            onPress={history.undo}
            className="min-h-11 min-w-11 items-center justify-center"
          >
            <AppIcon name="Undo2" size={22} color={history.canUndo ? tokens.colors.foreground : tokens.colors.border} />
          </Pressable>
          <Pressable
            accessibilityLabel="Redo framing"
            disabled={!history.canRedo}
            onPress={history.redo}
            className="min-h-11 min-w-11 items-center justify-center"
          >
            <AppIcon name="Redo2" size={22} color={history.canRedo ? tokens.colors.foreground : tokens.colors.border} />
          </Pressable>
        </View>
        <Tabs
          items={[
            { key: 'source', label: 'Source' },
            { key: 'output', label: 'Output' }
          ]}
          value={tab}
          onChange={(value) => setTab(value as typeof tab)}
        />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-3 px-5 pb-4">
        {tab === 'source' ? (
          <>
            <SourcePanel
              config={framing}
              onChange={history.change}
              canvasWidth={sourceWidth}
              canvasHeight={sourceWidth / (16 / 9)}
              player={player}
              currentTime={evaluationTime}
              selectedRegionId={selectedRegionId}
              onSelectRegion={setSelectedRegionId}
            />
            <Text className="text-xs text-muted">Source (16:9) · drag corners to resize</Text>
            <Text className="text-xs text-muted">Composed preview (9:16)</Text>
            <View className="items-center overflow-hidden rounded-[14px] border border-border bg-black">
              <FramedVideoPreview
                config={framing}
                targetRatio="9:16"
                videoPath={videoPath}
                currentTime={evaluationTime}
                videoTime={videoTime}
                playing={playing}
                width={70}
                height={124}
              />
            </View>
          </>
        ) : (
          <>
            <TargetPanel
              config={framing}
              targetRatio="9:16"
              onChange={history.change}
              previewWidth={targetWidth}
              videoPath={videoPath}
              currentTime={evaluationTime}
              videoTime={videoTime}
              playing={playing}
              selectedRegionId={selectedRegionId}
              onSelectRegion={setSelectedRegionId}
              safeArea={guide}
            />
            <Text className="text-xs text-muted">Output (9:16) · drag layers to position</Text>
          </>
        )}
        <VideoPlayerControls
          player={player}
          currentTime={currentTime}
          duration={duration}
          playing={playing}
          onTogglePlay={onTogglePlay}
          onSeek={(seconds) => {
            setLayoutId(null)
            onSeek(seconds)
          }}
        />
        {tab === 'source' ? (
          regionRows
        ) : (
          <View className="flex-row gap-2">
            <QuickAction icon="Crop" title="Regions" onPress={() => openPanel('stack')} />
            <QuickAction icon="Layers" title="Stack" onPress={() => openPanel('stack')} />
            <QuickAction icon="Image" title="Background" onPress={() => openPanel('background')} />
            <QuickAction icon="Scan" title="Safe zones" onPress={() => openPanel('safe')} />
          </View>
        )}
      </ScrollView>
      <View className="border-t border-border px-5 py-3">
        <Button
          title={saving ? 'Saving…' : tab === 'source' ? 'Arrange output →' : 'Apply layout ✓'}
          variant={tab === 'source' ? 'default' : 'accent'}
          disabled={saving}
          onPress={() => (tab === 'source' ? setTab('output') : void save())}
        />
      </View>
      <BottomSheet
        visible={panel === 'region' && Boolean(selectedRegion)}
        onClose={closePanel}
        title={selectedRegion?.label ?? 'Region'}
        headerAccessory={
          <Pressable onPress={closePanel} className="min-h-11 justify-center px-2">
            <Text className="text-accent">Done</Text>
          </Pressable>
        }
      >
        <Text className="text-sm text-foreground">Name</Text>
        <Input
          value={selectedRegion?.label ?? ''}
          onChangeText={(label) => patchRegion({ label })}
          placeholder="Region name"
        />
        <Pressable
          onPress={() => openPanel('media')}
          className="min-h-[56px] flex-row items-center justify-between border-b border-border"
        >
          <Text className="text-sm text-foreground">Media</Text>
          <Text className="text-sm text-muted">
            {selectedRegion?.mediaAssetId ? 'Image / video →' : 'Source video →'}
          </Text>
        </Pressable>
        <View className="min-h-[56px] flex-row items-center justify-between">
          <Text className="text-sm text-foreground">Lock aspect ratio</Text>
          <Switch
            accessibilityLabel="Lock aspect ratio"
            value={selectedRegion?.aspectRatioLocked !== false}
            onValueChange={(value) => patchRegion({ aspectRatioLocked: value })}
            trackColor={{ true: tokens.colors.accent }}
          />
        </View>
        <View className="min-h-[56px] flex-row items-center justify-between">
          <Text className="text-sm text-foreground">Rounded corners</Text>
          <Switch
            accessibilityLabel="Rounded corners"
            value={Boolean(selectedRegion?.cornerRadiusEnabled)}
            onValueChange={(value) =>
              patchRegion({ cornerRadiusEnabled: value, cornerRadiusPx: selectedRegion?.cornerRadiusPx ?? 12 })
            }
            trackColor={{ true: tokens.colors.accent }}
          />
        </View>
        {selectedRegion?.cornerRadiusEnabled ? (
          <>
            <Text className="text-sm text-muted">Corner radius · {selectedRegion.cornerRadiusPx ?? 12}px</Text>
            <SeekBar
              minimumValue={0}
              maximumValue={200}
              value={selectedRegion.cornerRadiusPx ?? 12}
              onValueChange={(value) => patchRegion({ cornerRadiusPx: value })}
            />
          </>
        ) : null}
        <Button title="Remove region" variant="outline" textClassName="text-destructive" onPress={removeRegion} />
      </BottomSheet>
      <BottomSheet visible={panel === 'stack'} onClose={closePanel} title="Regions & layer stack">
        <Text className="text-sm text-muted">Layers lower in this list draw on top.</Text>
        {regionRows}
        {selectedRegion ? (
          <Button
            title="Bring selected region to front"
            variant="outline"
            onPress={() =>
              history.change(
                replaceActiveFramingRegions(framing, segmentIndex, [
                  ...regions.filter((region) => region.id !== selectedRegion.id),
                  selectedRegion
                ])
              )
            }
          />
        ) : null}
      </BottomSheet>
      <BottomSheet visible={panel === 'safe'} onClose={closePanel} title="Safe zones">
        <Text className="text-sm text-muted">
          Preview guides help keep faces and text clear of platform controls. They are not included in exports.
        </Text>
        {GUIDES.map((item) => (
          <Button
            key={item.key}
            title={item.label}
            variant={safeZone === item.key ? 'accent' : 'outline'}
            onPress={() => {
              setSafeZone(item.key)
              closePanel()
            }}
          />
        ))}
      </BottomSheet>
      <BottomSheet
        visible={panel === 'background'}
        onClose={closePanel}
        title="Background"
        primaryAction={{ title: 'Done', onPress: closePanel }}
      >
        <Tabs
          items={[
            { key: 'none', label: 'None' },
            { key: 'scale', label: 'Scale' },
            { key: 'use16x9', label: 'Full source' }
          ]}
          value={framing.sourceFrameMode ?? 'none'}
          onChange={(mode) => history.change({ ...framing, sourceFrameMode: mode as 'none' | 'scale' | 'use16x9' })}
        />
        {framing.sourceFrameMode !== 'none' ? (
          <>
            <Text className="text-sm text-muted">
              Background blur · {framing.blurEnabled ? (framing.blurAmount ?? 12) : 0}
            </Text>
            <SeekBar
              minimumValue={0}
              maximumValue={30}
              value={framing.blurEnabled ? (framing.blurAmount ?? 12) : 0}
              onValueChange={(amount) => history.change({ ...framing, blurEnabled: amount > 0, blurAmount: amount })}
            />
            <Text className="text-sm text-muted">
              Frame scale · {Math.round((framing.sourceTransform?.scale ?? 1) * 100)}%
            </Text>
            <SeekBar
              minimumValue={0.5}
              maximumValue={5}
              step={0.05}
              value={framing.sourceTransform?.scale ?? 1}
              onValueChange={(scale) =>
                history.change({ ...framing, sourceTransform: { x: 0, y: 0, ...framing.sourceTransform, scale } })
              }
            />
            <Button
              title="Reset position"
              variant="outline"
              onPress={() => history.change({ ...framing, sourceTransform: { scale: 1, x: 0, y: 0 } })}
            />
          </>
        ) : null}
      </BottomSheet>
      <BottomSheet
        visible={panel === 'layouts'}
        onClose={closePanel}
        variant="page"
        title="Timed layouts"
        primaryAction={{ title: 'Apply layout', onPress: () => void save(), disabled: saving }}
      >
        <Pressable
          onPress={() => chooseLayout('default')}
          className="min-h-[90px] justify-center gap-2 rounded-[18px] border border-border bg-surface p-4"
        >
          <Text className="text-[17px] font-semibold text-foreground">Default layout</Text>
          <Text className="text-sm text-muted">Portrait · 9:16</Text>
        </Pressable>
        {(framing.segmentConfigs ?? []).map((segment) => (
          <View
            key={segment.segmentId}
            className="flex-row items-center gap-2 rounded-[14px] border border-border bg-surface px-3"
          >
            <Pressable
              onPress={() => chooseLayout(segment.segmentId)}
              className="min-h-[68px] flex-1 justify-center gap-1"
            >
              <Text className="font-semibold text-foreground">
                {formatClock(segment.startTime)} – {formatClock(segment.endTime)}
              </Text>
              <Text className="text-xs text-muted">{segment.regions.length} regions · Edit regions</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Edit layout timing"
              onPress={() => editTiming(segment.segmentId)}
              className="min-h-11 min-w-11 items-center justify-center"
            >
              <AppIcon name="EllipsisVertical" size={22} color={tokens.colors.muted} />
            </Pressable>
          </View>
        ))}
        <Button title="＋ Add timed layout" variant="outline" onPress={() => editTiming(null)} />
        <Button title="Background" variant="outline" onPress={() => openPanel('background')} />
        <Button title="Safe zones" variant="outline" onPress={() => openPanel('safe')} />
        <Button title="Media & B-roll" variant="outline" onPress={() => openPanel('media')} />
      </BottomSheet>
      <BottomSheet
        visible={panel === 'media'}
        onClose={() => {
          if (!mediaBusy) closePanel()
        }}
        variant="page"
        title="Media & B-roll"
      >
        <Text className="text-sm leading-[21px] text-muted">
          Add images or videos from your phone. Media is stored with your local framing assets.
        </Text>
        <Button
          title={
            mediaBusy ? 'Adding media…' : selectedRegion ? 'Replace selected region media' : 'Add image / video region'
          }
          variant="accent"
          disabled={mediaBusy}
          onPress={() => void addMedia()}
        />
        {selectedRegion?.mediaAssetId ? (
          <Button
            title="Use source video"
            variant="outline"
            disabled={mediaBusy}
            onPress={() => {
              patchRegion({ mediaAssetId: undefined, mediaType: 'video-crop', mediaSourceOffset: 0 })
              closePanel()
            }}
          />
        ) : null}
        <Text className="text-[17px] font-semibold text-foreground">Timed B-roll</Text>
        <View className="flex-row gap-3">
          <View className="flex-1 gap-2">
            <Text className="text-xs text-muted">Start (seconds)</Text>
            <Input value={brollStart} onChangeText={setBrollStart} keyboardType="decimal-pad" editable={!mediaBusy} />
          </View>
          <View className="flex-1 gap-2">
            <Text className="text-xs text-muted">End (seconds)</Text>
            <Input value={brollEnd} onChangeText={setBrollEnd} keyboardType="decimal-pad" editable={!mediaBusy} />
          </View>
        </View>
        <Button
          title="Add timed image / video"
          variant="outline"
          disabled={mediaBusy}
          onPress={() => void addMedia(true)}
        />
        {(framing.brollConfigs ?? []).map((part) => (
          <View key={part.brollId} className="gap-2 rounded-[18px] border border-border bg-surface p-4">
            <Text className="text-sm font-semibold text-foreground">{part.region.label ?? 'B-roll'}</Text>
            <Text className="text-xs text-muted">
              {formatClock(part.startTime)} – {formatClock(part.endTime)}
            </Text>
            <Button
              title="Remove B-roll"
              variant="outline"
              textClassName="text-destructive"
              disabled={mediaBusy}
              onPress={() => {
                history.end()
                history.change({
                  ...framing,
                  brollConfigs: framing.brollConfigs?.filter((item) => item.brollId !== part.brollId)
                })
              }}
            />
          </View>
        ))}
        <Text className="text-xs text-muted">Up to 128 MB per asset.</Text>
      </BottomSheet>
      <BottomSheet
        visible={timingOpen}
        onClose={() => setTimingOpen(false)}
        title="Layout timing"
        primaryAction={{ title: 'Save timing', onPress: saveTiming }}
      >
        <Text className="text-sm text-muted">Enter seconds within this clip (0–{duration.toFixed(1)}).</Text>
        <View className="flex-row gap-3">
          <View className="flex-1 gap-2">
            <Text className="text-sm text-foreground">Start time</Text>
            <Input value={timingStart} onChangeText={setTimingStart} keyboardType="decimal-pad" />
          </View>
          <View className="flex-1 gap-2">
            <Text className="text-sm text-foreground">End time</Text>
            <Input value={timingEnd} onChangeText={setTimingEnd} keyboardType="decimal-pad" />
          </View>
        </View>
        {editingSegmentId ? (
          <Button
            title="Remove timed layout"
            variant="outline"
            textClassName="text-destructive"
            onPress={() => {
              history.end()
              history.change({
                ...framing,
                segmentConfigs: framing.segmentConfigs?.filter((segment) => segment.segmentId !== editingSegmentId)
              })
              setTimingOpen(false)
              setLayoutId(null)
            }}
          />
        ) : null}
      </BottomSheet>
    </View>
  )
}

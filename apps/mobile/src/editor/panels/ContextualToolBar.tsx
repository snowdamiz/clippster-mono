import { AppIcon, type AppIconName } from '@/components/AppIcon'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { tokens } from '@/theme/tokens'
import type { SelectionKind } from '../model/schema'
import { toolsForSelection, type EditorToolId } from './toolDefinitions'

const TOOL_ICONS: Record<EditorToolId, AppIconName> = {
  edit: 'Pencil',
  text: 'Type',
  captions: 'Captions',
  audio: 'Music2',
  overlay: 'Layers',
  effects: 'Sparkles',
  filters: 'WandSparkles',
  adjust: 'SlidersHorizontal',
  add: 'Plus',
  split: 'Scissors',
  speed: 'Gauge',
  volume: 'Volume2',
  crop: 'Crop',
  reframe: 'Move',
  rotate: 'RotateCw',
  replace: 'ArrowLeftRight',
  duplicate: 'Copy',
  delete: 'Trash2',
  style: 'Palette',
  font: 'Type',
  color: 'Palette',
  animation: 'Zap',
  duration: 'Clock',
  opacity: 'Droplets',
  fade: 'Activity',
  transition: 'ArrowLeftRight'
}

export function ContextualToolBar({
  selectionKind,
  onToolPress,
  onClearSelection,
  visibleCapabilityIds
}: {
  selectionKind: SelectionKind | null
  onToolPress: (tool: EditorToolId) => void
  onClearSelection: () => void
  visibleCapabilityIds?: ReadonlySet<string> | string[]
}) {
  const tools = toolsForSelection(selectionKind, visibleCapabilityIds)
  return (
    <View className="h-[82px] bg-background py-2">
      <ScrollView
        key={selectionKind ?? 'global'}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="items-center gap-1.5 px-4"
        bounces
        overScrollMode="never"
      >
        {selectionKind ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Deselect item"
            onPress={onClearSelection}
            className="h-16 min-w-[70px] items-center justify-center gap-1.5 rounded-[14px] border border-border bg-surface px-2"
          >
            <AppIcon name="ArrowLeft" size={22} color={tokens.colors.foreground} />
            <Text className="text-[11px] text-muted">Deselect</Text>
          </Pressable>
        ) : null}
        {tools.map((tool) => (
          <Pressable
            key={tool.id}
            accessibilityRole="button"
            accessibilityLabel={tool.label}
            onPress={() => onToolPress(tool.id)}
            className="h-16 min-w-[70px] items-center justify-center gap-1.5 rounded-[14px] border border-border bg-surface px-2 active:opacity-60"
          >
            <AppIcon
              name={TOOL_ICONS[tool.id]}
              size={22}
              color={tool.destructive ? tokens.colors.destructive : tokens.colors.foreground}
            />
            <Text className={`text-[11px] ${tool.destructive ? 'text-destructive' : 'text-foreground'}`}>
              {tool.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

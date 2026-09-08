import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { tokens } from '@/theme/tokens';
import type { SelectionKind } from '../model/schema';
import {
  toolsForSelection,
  type EditorToolId,
} from './toolDefinitions';

const TOOL_ICONS: Record<EditorToolId, keyof typeof Ionicons.glyphMap> = {
  edit: 'create-outline',
  text: 'text-outline',
  captions: 'chatbubble-ellipses-outline',
  audio: 'musical-notes-outline',
  overlay: 'layers-outline',
  effects: 'sparkles-outline',
  filters: 'color-filter-outline',
  adjust: 'options-outline',
  add: 'add-circle-outline',
  split: 'cut-outline',
  speed: 'speedometer-outline',
  volume: 'volume-high-outline',
  crop: 'crop-outline',
  reframe: 'move-outline',
  rotate: 'sync-outline',
  replace: 'swap-horizontal-outline',
  duplicate: 'copy-outline',
  delete: 'trash-outline',
  style: 'brush-outline',
  font: 'text-outline',
  color: 'color-palette-outline',
  animation: 'flash-outline',
  duration: 'time-outline',
  opacity: 'water-outline',
  fade: 'analytics-outline',
  transition: 'git-compare-outline',
};

export function ContextualToolBar({
  selectionKind,
  onToolPress,
  onClearSelection,
  visibleCapabilityIds,
}: {
  selectionKind: SelectionKind | null;
  onToolPress: (tool: EditorToolId) => void;
  onClearSelection: () => void;
  visibleCapabilityIds?: ReadonlySet<string> | string[];
}) {
  const tools = toolsForSelection(selectionKind, visibleCapabilityIds);
  return (
    <View className="h-[86px] border-t border-white/10 bg-black py-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="items-center gap-1 px-1"
      >
        {selectionKind ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to all tools"
            onPress={onClearSelection}
            className="h-[70px] w-12 items-center justify-center gap-1 rounded-lg bg-[#202023]"
          >
            <Ionicons name="chevron-back" size={21} color={tokens.colors.foreground} />
            <Text className="text-[10px] text-muted">Back</Text>
          </Pressable>
        ) : null}
        {tools.map((tool) => (
          <Pressable
            key={tool.id}
            accessibilityRole="button"
            accessibilityLabel={tool.label}
            onPress={() => onToolPress(tool.id)}
            className="h-[70px] min-w-[68px] items-center justify-center gap-2 rounded-lg bg-[#202023] px-2 active:opacity-60"
          >
            <Ionicons
              name={TOOL_ICONS[tool.id]}
              size={25}
              color={tool.destructive ? tokens.colors.destructive : tokens.colors.foreground}
            />
            <Text
              className={`text-xs ${tool.destructive ? 'text-destructive' : 'text-foreground'}`}
            >
              {tool.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

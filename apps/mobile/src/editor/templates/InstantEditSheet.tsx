import {
  BUILT_IN_VIDEO_TEMPLATES,
  templatePreviewLook,
  type TemplateManifest
} from '@clippster/template-schema'
import { useEffect, useMemo, useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { tokens } from '@/theme/tokens'

import { TemplatePreview } from './TemplatePreview'

/**
 * TikTok Instant Edit / Templates picker layout:
 * full-screen black chrome, category chips, dense 2-column 9:16 portrait grid,
 * labels on the media tiles, then a full-bleed Use CTA on selection.
 */
export function InstantEditSheet({
  visible,
  busy,
  mediaCount,
  onClose,
  onSelect
}: {
  visible: boolean
  busy: boolean
  mediaCount: number
  onClose: () => void
  onSelect: (manifest: TemplateManifest) => void
}) {
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [category, setCategory] = useState('For you')
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateManifest | null>(null)

  useEffect(() => {
    if (!visible) {
      setSelectedTemplate(null)
      setSearch('')
      setSearchOpen(false)
      setCategory('For you')
    }
  }, [visible])

  const categories = useMemo(() => {
    const fromCatalog = Array.from(
      new Set(
        BUILT_IN_VIDEO_TEMPLATES.filter((template) => template.compatibility.android).flatMap(
          (template) => template.categories
        )
      )
    )
    return ['For you', ...fromCatalog]
  }, [])

  const templates = useMemo(() => {
    const query = search.trim().toLowerCase()
    return BUILT_IN_VIDEO_TEMPLATES.filter((template) => {
      if (!template.compatibility.android) return false
      if (category !== 'For you' && !template.categories.includes(category)) return false
      if (!query) return true
      return (
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    })
  }, [category, search])

  const selectedLook = selectedTemplate ? templatePreviewLook(selectedTemplate) : null
  const gutter = 8
  const horizontalPad = 12
  const tileWidth = (windowWidth - horizontalPad * 2 - gutter) / 2
  const tileHeight = tileWidth * (16 / 9)

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => (selectedTemplate ? setSelectedTemplate(null) : onClose())}>
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        {selectedTemplate && selectedLook ? (
          <View className="flex-1">
            <View className="flex-row items-center justify-between px-3 pb-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to templates"
                hitSlop={12}
                disabled={busy}
                onPress={() => setSelectedTemplate(null)}
                className="min-h-10 min-w-10 items-center justify-center"
              >
                <Text className="text-2xl text-white">‹</Text>
              </Pressable>
              <Text className="text-base font-semibold text-white">Preview</Text>
              <View className="min-w-10" />
            </View>

            <View className="flex-1 items-center justify-center px-6">
              <View
                className="overflow-hidden rounded-2xl"
                style={{ width: Math.min(windowWidth - 48, 320), aspectRatio: 9 / 16 }}
              >
                <TemplatePreview manifest={selectedTemplate} featured showMeta={false} />
              </View>
              <Text className="mt-5 text-center text-xl font-bold text-white">{selectedTemplate.name}</Text>
              <Text className="mt-1 text-center text-sm text-white/70">
                {selectedLook.slotCount} clips · {selectedLook.durationLabel}
              </Text>
              <Text className="mt-2 px-4 text-center text-sm text-white/55">{selectedLook.actionLabel}</Text>
            </View>

            {mediaCount === 0 ? (
              <Text accessibilityRole="alert" className="mx-4 mb-3 rounded-xl bg-amber-500/15 px-3 py-2 text-center text-sm text-amber-200">
                Add at least one video or image before using Instant Edit.
              </Text>
            ) : null}

            <View style={{ paddingBottom: Math.max(insets.bottom, 16) }} className="px-4 pt-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Use ${selectedTemplate.name}`}
                disabled={busy || mediaCount === 0}
                onPress={() => onSelect(selectedTemplate)}
                className="min-h-12 items-center justify-center rounded-full bg-white disabled:opacity-40"
              >
                <Text className="text-base font-bold text-black">
                  {busy ? 'Preparing…' : 'Use template'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="flex-1">
            <View className="flex-row items-center gap-2 px-3 pb-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close Instant Edit"
                hitSlop={12}
                disabled={busy}
                onPress={onClose}
                className="min-h-10 min-w-10 items-center justify-center"
              >
                <Text className="text-2xl text-white">‹</Text>
              </Pressable>
              <Text accessibilityRole="header" className="flex-1 text-lg font-bold text-white">
                Templates
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={searchOpen ? 'Hide search' : 'Search templates'}
                hitSlop={12}
                onPress={() => setSearchOpen((open) => !open)}
                className="min-h-10 min-w-10 items-center justify-center"
              >
                <Text className="text-base text-white">{searchOpen ? 'Done' : 'Search'}</Text>
              </Pressable>
            </View>

            {searchOpen ? (
              <TextInput
                accessibilityLabel="Search Instant Edit templates"
                value={search}
                onChangeText={setSearch}
                autoFocus
                placeholder="Search templates"
                placeholderTextColor={tokens.colors.muted}
                className="mx-3 mb-2 min-h-11 rounded-full border border-white/10 bg-white/10 px-4 text-white"
              />
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: 10 }}
              className="grow-0"
            >
              {categories.map((item) => {
                const active = category === item
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setCategory(item)}
                    className={`rounded-full px-3.5 py-1.5 ${active ? 'bg-white' : 'bg-white/10'}`}
                  >
                    <Text className={`text-sm font-semibold ${active ? 'text-black' : 'text-white/80'}`}>
                      {item}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            {mediaCount === 0 ? (
              <Text accessibilityRole="alert" className="mx-3 mb-2 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-200">
                Add at least one video or image before using Instant Edit.
              </Text>
            ) : null}

            <FlatList
              data={templates}
              keyExtractor={(template) => template.versionId}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: horizontalPad,
                paddingBottom: Math.max(insets.bottom, 24),
                gap: gutter
              }}
              columnWrapperStyle={{ gap: gutter }}
              ListEmptyComponent={
                <Text className="mt-16 text-center text-sm text-white/50">No templates found</Text>
              }
              renderItem={({ item: template }) => {
                const look = templatePreviewLook(template)
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${template.name}. ${look.slotCount} clips. ${look.actionLabel}`}
                    accessibilityHint="Opens a full preview, then applies Instant Edit"
                    disabled={busy}
                    onPress={() => setSelectedTemplate(template)}
                    className="overflow-hidden rounded-xl bg-zinc-900 active:opacity-90"
                    style={{ width: tileWidth, height: tileHeight }}
                  >
                    <TemplatePreview manifest={template} />
                  </Pressable>
                )
              }}
            />
          </View>
        )}
      </View>
    </Modal>
  )
}

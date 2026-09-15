import { templatePreviewLook, type TemplateManifest } from '@clippster/template-schema'
import { Text, View } from 'react-native'

/**
 * TikTok Instant Edit / Templates-style portrait tile: 9:16 preview with
 * bottom scrim, name, and clip-count — labels live on the media, not under it.
 */
export function TemplatePreview({
  manifest,
  featured = false,
  showMeta = true
}: {
  manifest: TemplateManifest
  featured?: boolean
  showMeta?: boolean
}) {
  const look = templatePreviewLook(manifest)
  const titleTop = look.titlePosition === 'top' ? '14%' : look.titlePosition === 'bottom' ? '58%' : '40%'
  const plates = Array.from({ length: look.plateCount }, (_, index) => index)
  const clipLabel = `${look.slotCount} clip${look.slotCount === 1 ? '' : 's'}`

  return (
    <View className="flex-1 overflow-hidden" style={{ backgroundColor: look.gradientTo }}>
      <View className="absolute inset-0" style={{ backgroundColor: look.gradientFrom, opacity: 0.78 }} />
      <View
        className="absolute left-1/2 h-[42%] w-[42%] -translate-x-1/2 rounded-full"
        style={{ top: '16%', backgroundColor: `${look.accentColor}66` }}
      />
      <View className="absolute inset-x-[14%] bottom-[28%] h-[34%] rounded-t-[48px] bg-black/40" />
      {look.plateCount > 1 ? (
        <View className="absolute inset-x-2 top-[62%] h-1.5 flex-row gap-0.5">
          {plates.map((index) => (
            <View
              key={index}
              className="h-full flex-1 rounded-sm bg-white/30"
              style={{ opacity: 0.35 + (index + 1) * 0.12 }}
            />
          ))}
        </View>
      ) : null}
      {look.effectLabel === 'Vignette' ? <View className="absolute inset-0 bg-black/30" /> : null}
      <Text
        numberOfLines={1}
        className="absolute inset-x-2 text-center text-white"
        style={{
          top: titleTop,
          fontSize: featured ? 18 : 11,
          fontWeight: look.titleStyle === 'clean' ? '600' : '800',
          letterSpacing: look.titleStyle === 'documentary' ? 1.2 : 0,
          backgroundColor: look.titleStyle === 'label' ? look.accentColor : 'transparent',
          paddingHorizontal: look.titleStyle === 'label' ? 6 : 0,
          overflow: 'hidden'
        }}
      >
        {look.titleText}
      </Text>
      {showMeta ? (
        <>
          <View className="absolute inset-x-0 bottom-0 h-[42%] bg-black/55" />
          <View className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-6">
            <Text numberOfLines={1} className="text-[11px] font-semibold text-white">
              {look.name}
            </Text>
            <Text numberOfLines={1} className="mt-0.5 text-[10px] text-white/75">
              {clipLabel} · {look.durationLabel}
            </Text>
          </View>
          <View className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5">
            <Text className="text-[9px] font-semibold text-white/90">{clipLabel}</Text>
          </View>
        </>
      ) : null}
    </View>
  )
}

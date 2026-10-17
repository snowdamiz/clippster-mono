import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

export function SectionCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      {title ? <Text className="text-xs font-medium uppercase tracking-wide text-muted">{title}</Text> : null}
      <View className="overflow-hidden rounded-[18px] border border-border bg-surface px-4">{children}</View>
    </View>
  )
}

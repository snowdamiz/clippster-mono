import { ScrollView, View } from 'react-native'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SharedClipLibrary } from '@/components/inbox/SharedClipLibrary'
export default function InboxScreen() {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Shared clips" showBack />
      <ScrollView contentContainerClassName="px-5 py-3 pb-8">
        <SharedClipLibrary />
      </ScrollView>
    </View>
  )
}

import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { AppIcon } from '@/components/AppIcon'
import { useMessaging } from '@/context/MessagingContext'
import { tokens } from '@/theme/tokens'

export function WorkspaceActions() {
  const { totalUnread } = useMessaging()
  return (
    <View className="flex-row">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={totalUnread ? `Messages, ${totalUnread} unread` : 'Messages'}
        onPress={() => router.push('/(tabs)/messages')}
        className="h-11 w-11 items-center justify-center"
      >
        <AppIcon name="MessageSquare" size={21} color={tokens.colors.foreground} />
        {totalUnread > 0 ? (
          <View className="absolute right-0 top-0 min-w-4 items-center rounded-full bg-accent px-1">
            <Text className="text-[10px] text-primary-foreground">{totalUnread > 99 ? '99+' : totalUnread}</Text>
          </View>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={() => router.push('/(tabs)/settings?section=notifications')}
        className="h-11 w-11 items-center justify-center"
      >
        <AppIcon name="Bell" size={21} color={tokens.colors.foreground} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => router.push('/(tabs)/settings')}
        className="h-11 w-11 items-center justify-center"
      >
        <AppIcon name="Settings" size={21} color={tokens.colors.foreground} />
      </Pressable>
    </View>
  )
}

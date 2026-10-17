import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs'
import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppIcon, type AppIconName } from '@/components/AppIcon'
import { tokens } from '@/theme/tokens'

const ITEMS = [
  { route: 'projects', title: 'Home', icon: 'House' },
  { route: 'editor', title: 'Editor', icon: 'Scissors' },
  { route: 'download', title: 'Add media', icon: 'Plus' },
  { route: 'clips', title: 'Exports', icon: 'Download' },
  { route: 'profile', title: 'Me', icon: 'UserRound' }
] as const satisfies readonly { route: string; title: string; icon: AppIconName }[]

export function MainTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const current = state.routes[state.index]?.name
  if (current === 'editor') return null
  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      className="flex-row border-t border-border bg-background px-2 pt-2"
    >
      {ITEMS.map((item) => {
        const add = item.route === 'download'
        const active =
          !add &&
          (current === item.route ||
            (item.route === 'profile' && ['messages', 'campaigns', 'settings', 'inbox'].includes(current)))
        return (
          <Pressable
            key={item.route}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityState={{ selected: active }}
            testID={`tab-${item.route}`}
            onPress={() => {
              if (add) {
                router.push('/(tabs)/download')
                return
              }
              const route = state.routes.find((entry) => entry.name === item.route)
              if (!route) return
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!event.defaultPrevented) navigation.navigate(route.name, route.params)
            }}
            className="min-h-[56px] flex-1 items-center justify-center gap-1"
          >
            {add ? (
              <View className="h-12 w-12 items-center justify-center rounded-full bg-accent">
                <AppIcon name="Plus" size={28} color={tokens.colors.primaryForeground} />
              </View>
            ) : (
              <>
                <AppIcon name={item.icon} size={23} color={active ? tokens.colors.accent : tokens.colors.muted} />
                <Text className={`text-[11px] font-medium ${active ? 'text-accent' : 'text-muted'}`}>{item.title}</Text>
              </>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

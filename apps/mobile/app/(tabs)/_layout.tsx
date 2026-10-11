import { Redirect, Tabs } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { MainTabBar } from '@/components/navigation/MainTabBar'
import { useAccount } from '@/context/AccountContext'
import { useAuth } from '@/context/AuthContext'
import { tokens } from '@/theme/tokens'
export default function TabsLayout() {
  const { authChecked, isAuthenticated } = useAuth()
  const { requiresPlanGate, accountReady } = useAccount()
  if (!authChecked || (isAuthenticated && !accountReady))
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.accent} />
      </View>
    )
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />
  if (requiresPlanGate) return <Redirect href="/billing" />
  return (
    <Tabs tabBar={(props) => <MainTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="projects" options={{ title: 'Home' }} />
      <Tabs.Screen name="editor" options={{ title: 'Editor' }} />
      <Tabs.Screen name="download" options={{ href: null, title: 'Add media' }} />
      <Tabs.Screen name="clips" options={{ title: 'Exports' }} />
      <Tabs.Screen name="profile" options={{ title: 'Me' }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="campaigns" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="inbox" options={{ href: null }} />
    </Tabs>
  )
}

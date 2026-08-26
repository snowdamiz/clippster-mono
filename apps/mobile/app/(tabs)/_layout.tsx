import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { tokens } from '@/theme/tokens';

export default function TabsLayout() {
  const { authChecked, isAuthenticated } = useAuth();

  if (!authChecked) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: tokens.colors.background,
          borderTopColor: tokens.colors.border,
        },
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: tokens.colors.muted,
      }}
    >
      <Tabs.Screen name="download" options={{ title: 'Download' }} />
      <Tabs.Screen name="projects" options={{ title: 'Projects' }} />
      <Tabs.Screen name="campaigns" options={{ title: 'Campaigns' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="settings" options={{ title: 'More' }} />
      <Tabs.Screen name="inbox" options={{ href: null }} />
      <Tabs.Screen name="posts" options={{ href: null }} />
      <Tabs.Screen name="accounts" options={{ href: null }} />
    </Tabs>
  );
}

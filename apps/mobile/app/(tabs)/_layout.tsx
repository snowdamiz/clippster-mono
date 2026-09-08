import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { useAccount } from '@/context/AccountContext';
import { useAuth } from '@/context/AuthContext';
import { useMessaging } from '@/context/MessagingContext';
import { tokens } from '@/theme/tokens';

import type { ColorValue } from 'react-native';

type TabRouteName = 'projects' | 'editor' | 'clips' | 'messages' | 'profile';

function tabBarIcon(name: TabRouteName) {
  function TabIcon({ color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <TabBarIcon name={name} color={String(color)} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { authChecked, isAuthenticated } = useAuth();
  const { requiresPlanGate, accountReady } = useAccount();
  const { totalUnread } = useMessaging();

  if (!authChecked || (isAuthenticated && !accountReady)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.accent} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (requiresPlanGate) {
    return <Redirect href={'/billing' as never} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: tokens.colors.background,
          borderTopColor: tokens.colors.border,
        },
        tabBarActiveTintColor: tokens.colors.accent,
        tabBarInactiveTintColor: tokens.colors.muted,
      }}
    >
      <Tabs.Screen
        name="projects"
        options={{ title: 'Home', tabBarIcon: tabBarIcon('projects') }}
      />
      <Tabs.Screen
        name="download"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="editor"
        options={{ title: 'Editor', tabBarIcon: tabBarIcon('editor') }}
      />
      <Tabs.Screen
        name="clips"
        options={{ title: 'Exports', tabBarIcon: tabBarIcon('clips') }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: tabBarIcon('messages'),
          tabBarBadge: totalUnread > 0 ? (totalUnread > 99 ? '99+' : totalUnread) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: tokens.colors.accent,
            color: '#fff',
            fontSize: 10,
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Me', tabBarIcon: tabBarIcon('profile') }}
      />
      <Tabs.Screen name="campaigns" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="inbox" options={{ href: null }} />
    </Tabs>
  );
}

import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAccount } from '@/context/AccountContext';
import { useAuth } from '@/context/AuthContext';
import { tokens } from '@/theme/tokens';

export default function IndexScreen() {
  const { authChecked, isAuthenticated } = useAuth();
  const { accountReady, requiresPlanGate } = useAccount();

  if (!authChecked || (isAuthenticated && !accountReady)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    if (requiresPlanGate) {
      return <Redirect href={'/billing' as never} />;
    }
    return <Redirect href="/(tabs)/projects" />;
  }

  return <Redirect href="/(auth)/login" />;
}

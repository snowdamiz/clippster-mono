import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { tokens } from '@/theme/tokens';

export default function IndexScreen() {
  const { authChecked, isAuthenticated } = useAuth();

  if (!authChecked) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/projects" />;
  }

  return <Redirect href="/(auth)/login" />;
}

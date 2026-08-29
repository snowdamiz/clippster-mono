import { router } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { tokens } from '@/theme/tokens';

export default function StripeCancelScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/billing');
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-center text-lg font-semibold text-foreground">Checkout cancelled</Text>
      <Text className="mt-2 text-center text-sm text-muted" style={{ color: tokens.colors.muted }}>
        No charge was made. You can pick a plan again anytime.
      </Text>
    </View>
  );
}

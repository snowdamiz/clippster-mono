import { router } from 'expo-router';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';

export default function NotFoundScreen() {
  return <View className="flex-1 justify-center bg-background px-5"><EmptyState icon="search-outline" title="Page not found" subtitle="This screen is no longer available." action={<Button title="Go to Home" onPress={() => router.replace('/')} />} /></View>;
}

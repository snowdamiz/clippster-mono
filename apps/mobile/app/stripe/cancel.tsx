import { router } from 'expo-router';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';

export default function StripeCancelScreen() {
  return <View className="flex-1 justify-center bg-background px-5"><EmptyState icon="card-outline" title="Checkout canceled" subtitle="You haven’t completed a plan purchase. You can choose a plan again." action={<Button title="Back to plans" onPress={() => router.replace('/billing')} />} /></View>;
}

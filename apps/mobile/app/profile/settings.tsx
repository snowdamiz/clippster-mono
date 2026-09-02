import { AccountSettingsPanel } from '@/components/account/AccountSettingsPanel';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ScrollView, View } from 'react-native';

export default function CloudSettingsScreen() {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Cloud & sync" showBack />
      <ScrollView contentContainerClassName="gap-4 px-4 py-4 pb-10">
        <AccountSettingsPanel />
      </ScrollView>
    </View>
  );
}

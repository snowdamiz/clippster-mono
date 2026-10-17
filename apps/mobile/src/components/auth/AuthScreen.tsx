import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';

/** Auth layout from the approved A-series mockups; scrolls when the keyboard opens. */
export function AuthScreen({ title, children, back = true }: { title: string; children: ReactNode; back?: boolean }) {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={title} showBack={back} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 }}>
          <View className="w-full max-w-lg self-center gap-[17px]">{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

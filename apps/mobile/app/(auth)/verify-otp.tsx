import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

export default function VerifyOtpScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { verifyEmailOtp, resendVerificationEmail, pendingVerificationEmail, loading, error, clearError } =
    useAuth();
  const email = emailParam ?? pendingVerificationEmail ?? '';
  const [otp, setOtp] = useState('');

  async function handleVerify() {
    clearError();
    const result = await verifyEmailOtp(email, otp.trim());
    if (result.success) {
      router.replace('/(tabs)/projects');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background px-6 py-8">
      <View className="mb-8">
        <Text className="text-3xl font-bold text-foreground">Verify email</Text>
        <Text className="mt-2 text-muted">Enter the code sent to {email || 'your email'}</Text>
      </View>

      <Card className="gap-4">
        <View className="gap-2">
          <Label>Verification code</Label>
          <Input value={otp} onChangeText={setOtp} keyboardType="number-pad" placeholder="123456" />
        </View>

        {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

        <Button title="Verify" onPress={handleVerify} disabled={loading || otp.length < 4 || !email} />
        <Button
          title="Resend code"
          variant="outline"
          onPress={() => email && resendVerificationEmail(email)}
          disabled={loading || !email}
        />
      </Card>
    </SafeAreaView>
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@/theme/tokens';
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
    <AuthScreen title="Verify email">
      <View className="items-center gap-[18px] px-3 py-[50px]">
        <View className="h-[70px] w-[70px] items-center justify-center rounded-[23px] bg-surfaceMuted"><Ionicons name="mail-outline" size={30} color={tokens.colors.accent} /></View>
        <Text className="text-3xl font-bold text-foreground">Check your inbox</Text>
        <Text className="text-center text-sm leading-5 text-muted">Enter the code sent to {email || 'your email'}</Text>
      </View>

      <Card className="gap-[17px]" style={{ padding: 0, backgroundColor: 'transparent' }}>
        <View className="gap-2">
          <Label>Verification code</Label>
          <Input value={otp} onChangeText={setOtp} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="123456" style={{ textAlign: 'center', letterSpacing: 12, fontSize: 24, color: tokens.colors.foreground, minHeight: 64, backgroundColor: tokens.colors.surface, borderRadius: 12 }} />
        </View>

        {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

        <Button title="Verify email" variant="accent" onPress={handleVerify} disabled={loading || otp.length < 4 || !email} />
        <Button
          title="Resend code"
          variant="outline"
          onPress={() => email && resendVerificationEmail(email)}
          disabled={loading || !email}
        />
        <Button title="Use a different email" variant="ghost" onPress={() => router.replace('/(auth)/register')} />
      </Card>
    </AuthScreen>
  );
}

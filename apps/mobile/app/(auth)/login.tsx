import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClippsterLogo } from '@/components/ClippsterLogo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { loginWithEmail, authenticateWithGoogle, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin() {
    clearError();
    const result = await loginWithEmail(email.trim(), password);
    if (result.success) {
      router.replace('/(tabs)/projects');
      return;
    }
    if (result.needsVerification) {
      router.push({ pathname: '/(auth)/verify-otp', params: { email } });
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-8">
          <View className="mb-8 items-center">
            <ClippsterLogo />
            <Text className="mt-2 text-muted">Sign in to your account</Text>
          </View>

          <Card>
            <View className="gap-4">
              <View className="gap-2">
                <Label>Email</Label>
                <Input
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                />
              </View>

              <View className="gap-2">
                <Label>Password</Label>
                <Input
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                />
                <Link href={"/(auth)/forgot-password" as any} className="text-sm text-primary">
                  Forgot password?
                </Link>
              </View>

              {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

              <Button title="Sign in" onPress={handleLogin} disabled={loading || !email || !password} />

              <Separator />

              <Button
                title="Continue with Google"
                variant="google"
                onPress={() => {
                  // Must invoke immediately from the press gesture (no awaits before
                  // startGoogleAuth) or web browsers block the OAuth redirect/popup.
                  void authenticateWithGoogle().then((result) => {
                    if (result.success) {
                      router.replace('/(tabs)/projects');
                    }
                  });
                }}
                disabled={loading}
              />
            </View>
          </Card>

          <Text className="mt-6 text-center text-sm text-muted">
            No account?{' '}
            <Link href="/(auth)/register" className="text-primary">
              Create one
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

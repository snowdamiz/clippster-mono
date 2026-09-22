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
import { tokens } from '@/theme/tokens';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, paddingVertical: 40 }}>
          <View style={{ width: '100%', maxWidth: 420 }}>
          <View style={{ marginBottom: 32, alignItems: 'center' }}>
            <View style={{ marginBottom: 28 }}><ClippsterLogo iconSize={40} wordmarkHeight={28} /></View>
            <Text style={{ color: tokens.colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 12 }}>YOUR CREATIVE WORKSPACE</Text>
            <Text style={{ color: tokens.colors.foreground, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1, textAlign: 'center' }}>Your next great clip{'\n'}starts here.</Text>
            <Text className="mt-2 text-muted" style={{ marginTop: 8, color: tokens.colors.muted, fontSize: 15 }}>
              Sign in to your account
            </Text>
          </View>

          <Card style={{ padding: 0, backgroundColor: 'transparent' }}>
            <View style={{ gap: 20 }}>
              <View style={{ gap: 9 }}>
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

              <View style={{ gap: 9 }}>
                <Label>Password</Label>
                <Input
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                />
                <Link href={"/(auth)/forgot-password" as any} style={{ alignSelf: 'flex-end', paddingVertical: 6, color: tokens.colors.accent, fontSize: 13 }}>
                  Forgot password?
                </Link>
              </View>

              {error ? <Text className="text-sm text-red-400" style={{ color: tokens.colors.destructive, fontSize: 14 }}>{error}</Text> : null}

              <Button
                title="Sign in"
                variant="accent"
                onPress={handleLogin}
                disabled={loading || !email || !password}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ flex: 1 }}><Separator /></View>
                <Text style={{ color: tokens.colors.muted, fontSize: 12 }}>or continue with</Text>
                <View style={{ flex: 1 }}><Separator /></View>
              </View>

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

          <Text className="mt-6 text-center text-sm text-muted" style={{ marginTop: 24, textAlign: 'center', color: tokens.colors.muted, fontSize: 14 }}>
            New to Clippster?{' '}
            <Link href="/(auth)/register" className="text-primary" style={{ color: tokens.colors.accent }}>
              Create an account
            </Link>
          </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

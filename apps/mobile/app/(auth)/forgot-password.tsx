import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/services/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await authApi.forgotPassword(email.trim());
      if (!result.success) {
        setError(result.error ?? result.message ?? 'Could not send reset email');
        return;
      }
      setMessage(result.message ?? 'If an account exists for that email, a reset link was sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
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
            <Text className="text-3xl font-bold text-foreground">Reset password</Text>
            <Text className="mt-2 text-center text-muted">
              Enter your account email and we will send a reset link.
            </Text>
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

              {error ? <Text className="text-sm text-red-400">{error}</Text> : null}
              {message ? <Text className="text-sm text-green-400">{message}</Text> : null}

              <Button
                title={loading ? 'Sending…' : 'Send reset link'}
                onPress={() => void handleSubmit()}
                disabled={loading || !email.trim()}
              />
              <Button title="Back to sign in" variant="outline" onPress={() => router.back()} />
            </View>
          </Card>

          <Text className="mt-6 text-center text-sm text-muted">
            Remembered it?{' '}
            <Link href="/(auth)/login" className="text-primary">
              Sign in
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

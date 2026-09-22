import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AuthScreen } from '@/components/auth/AuthScreen';
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
    <AuthScreen title="Reset password">
          <View className="gap-2">
            <Text className="text-[28px] font-bold tracking-tight text-foreground">Forgot your{'\n'}password?</Text>
            <Text className="text-sm leading-5 text-muted">
              We’ll email you a link to reset it.
            </Text>
          </View>

          <Card style={{ backgroundColor: 'transparent', padding: 0 }}>
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
                title={loading ? 'Sending…' : 'Send reset link'} variant="accent"
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
    </AuthScreen>
  );
}

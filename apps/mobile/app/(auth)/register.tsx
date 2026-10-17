import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

export default function RegisterScreen() {
  const { registerWithEmail, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleRegister() {
    clearError();
    const result = await registerWithEmail(email.trim(), password);
    if (result.success) {
      router.push({ pathname: '/(auth)/verify-otp', params: { email } });
    }
  }

  return (
    <AuthScreen title="Create account">
          <View className="gap-2">
            <Text className="text-[28px] font-bold tracking-tight text-foreground">Let’s make{'\n'}something great.</Text>
            <Text className="mt-2 text-muted">Use your existing Clippster email to keep your workspace together.</Text>
          </View>

          <Card className="gap-[17px]" style={{ backgroundColor: 'transparent', padding: 0 }}>
            <View className="gap-2">
              <Label>Email</Label>
              <Input
                autoCapitalize="none"
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
                placeholder="At least 8 characters"
              />
            </View>

            {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

            <Button
              title="Create account"
              variant="accent"
              onPress={handleRegister}
              disabled={loading || !email || password.length < 8}
            />
          </Card>

          <Text className="mt-6 text-center text-sm text-muted">
            Already have an account?{' '}
            <Link href="/(auth)/login" className="text-primary">
              Sign in
            </Link>
          </Text>
    </AuthScreen>
  );
}

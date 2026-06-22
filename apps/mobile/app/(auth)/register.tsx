import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-8">
          <View className="mb-8 items-center">
            <Text className="text-3xl font-bold text-foreground">Create account</Text>
            <Text className="mt-2 text-muted">Use the same email as desktop Clippster</Text>
          </View>

          <Card className="gap-4">
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

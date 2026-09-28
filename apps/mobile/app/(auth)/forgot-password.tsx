import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/services/api'
import { tokens } from '@/theme/tokens'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const result = await authApi.forgotPassword(email.trim())
      if (!result.success) {
        setError(result.error ?? result.message ?? 'Could not send reset email')
        return
      }
      setMessage(result.message ?? 'If an account exists for that email, a reset link was sent.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (message) {
    return (
      <AuthScreen title="Check your email">
        <View className="items-center gap-[18px] px-3 py-[50px]">
          <View className="h-[70px] w-[70px] items-center justify-center rounded-[23px] bg-surfaceMuted">
            <Ionicons name="mail-outline" size={30} color={tokens.colors.accent} />
          </View>
          <Text className="text-[28px] font-bold tracking-tight text-foreground">Check your email</Text>
          <Text className="text-center text-sm leading-[21px] text-muted">
            {message} Follow the link to choose a new password.
          </Text>
        </View>
        <Button title="Back to sign in" variant="accent" onPress={() => router.replace('/(auth)/login')} />
      </AuthScreen>
    )
  }

  return (
    <AuthScreen title="Reset password">
      <View className="gap-2">
        <Text className="text-[28px] font-bold tracking-tight text-foreground">Forgot your{'\n'}password?</Text>
        <Text className="text-sm leading-5 text-muted">We’ll email you a link to reset it.</Text>
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

          <Button
            title={loading ? 'Sending…' : 'Send reset link'}
            variant="accent"
            onPress={() => void handleSubmit()}
            disabled={loading || !email.trim()}
          />
          <Button title="Back to sign in" variant="ghost" onPress={() => router.replace('/(auth)/login')} />
        </View>
      </Card>
    </AuthScreen>
  )
}

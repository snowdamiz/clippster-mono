import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '@/theme/tokens'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'

export default function VerifyOtpScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>()
  const { verifyEmailOtp, resendVerificationEmail, pendingVerificationEmail, loading, error, clearError } = useAuth()
  const email = emailParam ?? pendingVerificationEmail ?? ''
  const [otp, setOtp] = useState('')

  async function handleVerify() {
    clearError()
    const result = await verifyEmailOtp(email, otp.trim())
    if (result.success) {
      router.replace('/(tabs)/projects')
    }
  }

  return (
    <AuthScreen title="Verify email">
      <View className="items-center gap-[18px] px-3 py-[50px]">
        <View className="h-[70px] w-[70px] items-center justify-center rounded-[23px] bg-surfaceMuted">
          <Ionicons name="mail-outline" size={30} color={tokens.colors.accent} />
        </View>
        <Text className="text-3xl font-bold text-foreground">Check your inbox</Text>
        <Text className="text-center text-sm leading-5 text-muted">Enter the code sent to {email || 'your email'}</Text>
      </View>

      <Card className="gap-[17px]" style={{ padding: 0, backgroundColor: 'transparent' }}>
        <View className="relative">
          <View
            className="flex-row gap-2"
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <View
                key={index}
                className={`h-14 flex-1 items-center justify-center rounded-xl border bg-surface ${index === otp.length ? 'border-accent' : 'border-border'}`}
              >
                <Text className="text-2xl font-semibold text-foreground">{otp[index] ?? ''}</Text>
              </View>
            ))}
          </View>
          <Input
            accessibilityLabel="Six-digit verification code"
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            caretHidden
            selectionColor="transparent"
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.02,
              color: 'transparent',
              backgroundColor: 'transparent',
              borderWidth: 0
            }}
          />
        </View>

        {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

        <Button
          title="Verify email"
          variant="accent"
          onPress={handleVerify}
          disabled={loading || otp.length !== 6 || !email}
        />
        <Button
          title="Resend code"
          variant="ghost"
          onPress={() => email && resendVerificationEmail(email)}
          disabled={loading || !email}
        />
        <Button title="Use a different email" variant="ghost" onPress={() => router.replace('/(auth)/register')} />
      </Card>
    </AuthScreen>
  )
}

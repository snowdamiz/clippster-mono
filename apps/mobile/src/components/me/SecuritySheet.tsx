import { useState } from 'react'
import { Text, View } from 'react-native'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { appAlert } from '@/lib/appAlert'
import { accountApi } from '@/services/api'

interface SecuritySheetProps {
  visible: boolean
  onClose: () => void
}

export function SecuritySheet({ visible, onClose }: SecuritySheetProps) {
  const { user, authProvider } = useAuth()
  const isOAuth = authProvider === 'google' || Boolean(user && 'provider' in user)

  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpRequired, setOtpRequired] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)

  if (!visible) return null

  async function handleChangeEmail() {
    if (!newEmail.trim()) {
      appAlert('Email required', 'Enter the new email address.')
      return
    }
    setBusy(true)
    try {
      const result = await accountApi.changeEmail(newEmail.trim(), {
        password: emailPassword || undefined
      })
      if (!result.success) {
        appAlert('Could not change email', result.error ?? result.message ?? 'Try again')
        return
      }
      if (result.otp_required) {
        setOtpRequired(true)
        appAlert('Check your inbox', 'Enter the code sent to your new email.')
        return
      }
      appAlert('Email updated', result.message ?? 'Your email was changed.')
      setNewEmail('')
      setEmailPassword('')
    } catch (error) {
      appAlert('Could not update account', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) return
    setBusy(true)
    try {
      const result = await accountApi.verifyEmailChangeOtp(otp.trim())
      if (!result.success) {
        appAlert('Invalid code', result.error ?? result.message ?? 'Try again')
        return
      }
      appAlert('Email updated', 'Your email was verified.')
      setOtpRequired(false)
      setOtp('')
      setNewEmail('')
      setEmailPassword('')
    } catch (error) {
      appAlert('Could not update account', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      appAlert('Invalid password', 'Use your current password and a new password of at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      const result = await accountApi.changePassword(currentPassword, newPassword)
      if (!result.success) {
        appAlert('Could not change password', result.error ?? result.message ?? 'Try again')
        return
      }
      appAlert('Password updated', 'Use your new password next time you sign in.')
      setCurrentPassword('')
      setNewPassword('')
    } catch (error) {
      appAlert('Could not update account', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        if (!busy) onClose()
      }}
      variant="page"
      title={otpRequired ? 'Verify new email' : 'Email & password'}
      headerIcon="shield-checkmark-outline"
      scrollable
      keyboardAvoiding
      maxHeightClassName="max-h-[92%]"
    >
      {otpRequired ? (
        <View className="gap-[17px]">
          <EmptyState
            icon="mail-outline"
            title="Verify your new email"
            subtitle={`Enter the code sent to ${newEmail.trim()}.`}
          />
          <Label>Verification code</Label>
          <Input
            accessibilityLabel="Verification code"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/\D/g, ''))}
            editable={!busy}
          />
          <Button
            title={busy ? 'Verifying…' : 'Verify email change'}
            onPress={() => void handleVerifyOtp()}
            disabled={busy || otp.length !== 6}
          />
          <Button
            title="Change email address"
            variant="outline"
            disabled={busy}
            onPress={() => {
              setOtpRequired(false)
              setOtp('')
            }}
          />
        </View>
      ) : (
        <View className="gap-7">
          <View className="gap-3">
            <Text className="text-[17px] font-semibold text-foreground">Change email</Text>
            <Text className="text-sm text-muted">Current: {user?.email ?? '—'}</Text>
            <Label>New email</Label>
            <Input
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              value={newEmail}
              onChangeText={setNewEmail}
              editable={!busy}
            />
            {!isOAuth ? (
              <>
                <Label>Current password</Label>
                <Input
                  secureTextEntry
                  autoComplete="current-password"
                  value={emailPassword}
                  onChangeText={setEmailPassword}
                  editable={!busy}
                />
              </>
            ) : null}
            <Button
              title={busy ? 'Sending…' : 'Request email change'}
              onPress={() => void handleChangeEmail()}
              disabled={busy || !newEmail.trim() || (!isOAuth && !emailPassword)}
            />
          </View>
          {!isOAuth ? (
            <View className="gap-3">
              <Text className="text-[17px] font-semibold text-foreground">Change password</Text>
              <Label>Current password</Label>
              <Input
                secureTextEntry
                autoComplete="current-password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                editable={!busy}
              />
              <Label>New password</Label>
              <Input
                secureTextEntry
                autoComplete="new-password"
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!busy}
              />
              <Text className="text-sm text-muted">Use at least 8 characters.</Text>
              <Button
                title={busy ? 'Saving…' : 'Update password'}
                variant="outline"
                onPress={() => void handleChangePassword()}
                disabled={busy || !currentPassword || newPassword.length < 8}
              />
            </View>
          ) : (
            <Text className="text-sm text-muted">
              You sign in with Google. Manage your password in your Google account.
            </Text>
          )}
        </View>
      )}
    </BottomSheet>
  )
}

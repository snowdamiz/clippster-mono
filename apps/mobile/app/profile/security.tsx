import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { accountApi } from '@/services/api';
import { appAlert } from '@/lib/appAlert';

export default function AccountSecurityScreen() {
  const { user, authProvider } = useAuth();
  const isOAuth = authProvider === 'google' || Boolean(user && 'provider' in user);

  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleChangeEmail() {
    if (!newEmail.trim()) {
      appAlert('Email required', 'Enter the new email address.');
      return;
    }
    setBusy(true);
    try {
      const result = await accountApi.changeEmail(newEmail.trim(), {
        password: emailPassword || undefined,
      });
      if (!result.success) {
        appAlert('Could not change email', result.error ?? result.message ?? 'Try again');
        return;
      }
      if (result.otp_required) {
        setOtpRequired(true);
        appAlert('Check your inbox', 'Enter the code sent to your new email.');
        return;
      }
      appAlert('Email updated', result.message ?? 'Your email was changed.');
      setNewEmail('');
      setEmailPassword('');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) return;
    setBusy(true);
    try {
      const result = await accountApi.verifyEmailChangeOtp(otp.trim());
      if (!result.success) {
        appAlert('Invalid code', result.error ?? result.message ?? 'Try again');
        return;
      }
      appAlert('Email updated', 'Your email was verified.');
      setOtpRequired(false);
      setOtp('');
      setNewEmail('');
      setEmailPassword('');
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      appAlert('Invalid password', 'Use your current password and a new password of at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const result = await accountApi.changePassword(currentPassword, newPassword);
      if (!result.success) {
        appAlert('Could not change password', result.error ?? result.message ?? 'Try again');
        return;
      }
      appAlert('Password updated', 'Use your new password next time you sign in.');
      setCurrentPassword('');
      setNewPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Account security" showBack />
      <ScrollView contentContainerClassName="gap-6 px-4 py-4 pb-10">
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Change email</Text>
          <Text className="text-sm text-muted">Current: {user?.email ?? '—'}</Text>
          <TextInput
            className="rounded-lg border border-border bg-surface px-3 py-3 text-foreground"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="New email"
            placeholderTextColor="#71717a"
            value={newEmail}
            onChangeText={setNewEmail}
          />
          {!isOAuth ? (
            <TextInput
              className="rounded-lg border border-border bg-surface px-3 py-3 text-foreground"
              secureTextEntry
              placeholder="Current password"
              placeholderTextColor="#71717a"
              value={emailPassword}
              onChangeText={setEmailPassword}
            />
          ) : null}
          {otpRequired ? (
            <>
              <TextInput
                className="rounded-lg border border-border bg-surface px-3 py-3 text-foreground"
                keyboardType="number-pad"
                placeholder="Verification code"
                placeholderTextColor="#71717a"
                value={otp}
                onChangeText={setOtp}
              />
              <Button title={busy ? 'Verifying…' : 'Verify code'} onPress={() => void handleVerifyOtp()} disabled={busy} />
            </>
          ) : (
            <Button title={busy ? 'Sending…' : 'Request email change'} onPress={() => void handleChangeEmail()} disabled={busy} />
          )}
        </View>

        {!isOAuth ? (
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Change password</Text>
            <TextInput
              className="rounded-lg border border-border bg-surface px-3 py-3 text-foreground"
              secureTextEntry
              placeholder="Current password"
              placeholderTextColor="#71717a"
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TextInput
              className="rounded-lg border border-border bg-surface px-3 py-3 text-foreground"
              secureTextEntry
              placeholder="New password"
              placeholderTextColor="#71717a"
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <Button title={busy ? 'Saving…' : 'Update password'} onPress={() => void handleChangePassword()} disabled={busy} />
          </View>
        ) : (
          <Text className="text-sm text-muted">
            You signed in with Google. Password changes aren’t available for OAuth accounts.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { ScreenHeader } from '@/components/ScreenHeader'
import { MenuRow } from '@/components/navigation/MenuRow'
import { Button } from '@/components/ui/button'
import { SecuritySheet } from '@/components/me/SecuritySheet'
import { PreferencesSheet } from '@/components/me/PreferencesSheet'
import { useAuth } from '@/context/AuthContext'
import { confirmAccountDeletion } from '@/lib/confirmAccountDeletion'
import { AboutSheet } from '@/components/me/AboutSheet'
import { appAlert } from '@/lib/appAlert'
import { authApi } from '@/services/api'

export default function SettingsScreen() {
  const { logout } = useAuth()
  const [deleting, setDeleting] = useState(false)

  const [openSheet, setOpenSheet] = useState<'security' | 'preferences' | 'about' | null>(null)
  async function handleLogout() {
    await logout()
    router.replace('/(auth)/login')
  }

  function handleDeleteAccount() {
    confirmAccountDeletion(() => {
      void (async () => {
        setDeleting(true)
        try {
          const result = await authApi.deleteAccount()
          if (!result.success) {
            appAlert('Error', result.error ?? result.message ?? 'Could not delete account')
            return
          }
          await logout()
          router.replace('/(auth)/login')
        } finally {
          setDeleting(false)
        }
      })()
    })
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Settings" showBack />
      <ScrollView contentContainerClassName="gap-[17px] px-5 pb-6 pt-[10px]">
        <MenuRow icon="shield-checkmark-outline" title="Email & password" onPress={() => setOpenSheet('security')} />
        <MenuRow icon="options-outline" title="Preferences" onPress={() => setOpenSheet('preferences')} />
        <MenuRow
          icon="information-circle-outline"
          title="About Clippster"
          subtitle="Version, updates, licenses, privacy, terms"
          onPress={() => setOpenSheet('about')}
        />
        <Button title="Sign out" variant="outline" onPress={handleLogout} />
        <Button
          title={deleting ? 'Deleting…' : 'Delete account'}
          variant="destructive"
          disabled={deleting}
          onPress={handleDeleteAccount}
        />
      </ScrollView>
      <AboutSheet visible={openSheet === 'about'} onClose={() => setOpenSheet(null)} />
      <SecuritySheet visible={openSheet === 'security'} onClose={() => setOpenSheet(null)} />
      <PreferencesSheet visible={openSheet === 'preferences'} onClose={() => setOpenSheet(null)} />
    </View>
  )
}

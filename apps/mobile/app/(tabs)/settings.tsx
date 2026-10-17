import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
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
import { SectionCard } from '@/components/ui/SectionCard'
import { BillingSheet } from '@/components/me/BillingSheet'

export default function SettingsScreen() {
  const { logout } = useAuth()
  const [deleting, setDeleting] = useState(false)

  const { section } = useLocalSearchParams<{ section?: string }>()
  const [openSheet, setOpenSheet] = useState<'security' | 'notifications' | 'time' | 'billing' | 'about' | null>(null)
  useEffect(() => {
    if (section === 'notifications') setOpenSheet('notifications')
  }, [section])
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
        <SectionCard title="Account">
          <MenuRow icon="ShieldCheck" title="Email & password" onPress={() => setOpenSheet('security')} />
          <MenuRow icon="CreditCard" title="Plans & billing" onPress={() => setOpenSheet('billing')} />
        </SectionCard>
        <SectionCard title="Preferences">
          <MenuRow icon="Bell" title="Notifications" onPress={() => setOpenSheet('notifications')} />
          <MenuRow icon="Clock" title="Time format" onPress={() => setOpenSheet('time')} />
        </SectionCard>
        <SectionCard title="About">
          <MenuRow
            icon="Info"
            title="About Clippster"
            subtitle="Updates, licenses & legal"
            onPress={() => setOpenSheet('about')}
          />
        </SectionCard>
        <Button title="Sign out" variant="outline" onPress={handleLogout} />
        <View className="rounded-[14px] border border-destructive/20 bg-destructive/10 px-4">
          <MenuRow
            icon="Trash2"
            title={deleting ? 'Deleting…' : 'Delete account'}
            destructive
            onPress={() => {
              if (!deleting) handleDeleteAccount()
            }}
          />
        </View>
      </ScrollView>
      <AboutSheet visible={openSheet === 'about'} onClose={() => setOpenSheet(null)} />
      <SecuritySheet visible={openSheet === 'security'} onClose={() => setOpenSheet(null)} />
      <PreferencesSheet
        visible={openSheet === 'notifications' || openSheet === 'time'}
        mode={openSheet === 'time' ? 'time' : 'notifications'}
        onClose={() => setOpenSheet(null)}
      />
      <BillingSheet visible={openSheet === 'billing'} onClose={() => setOpenSheet(null)} />
    </View>
  )
}

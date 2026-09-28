import { useState } from 'react'
import { router } from 'expo-router'
import { Text } from 'react-native'
import { MenuRow } from '@/components/navigation/MenuRow'
import { AboutSheet } from './AboutSheet'
import { BottomSheet } from '@/components/ui/BottomSheet'

interface CloudSyncSheetProps {
  visible: boolean
  onClose: () => void
}

export function CloudSyncSheet({ visible, onClose }: CloudSyncSheetProps) {
  const [aboutVisible, setAboutVisible] = useState(false)
  if (!visible) return null

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="page"
      title="Cloud & shared work"
      headerIcon="cloud-outline"
      scrollable
      maxHeightClassName="max-h-[92%]"
    >
      <MenuRow
        icon="file-tray-outline"
        title="Shared clips"
        subtitle="Import clips from your organizations"
        onPress={() => {
          onClose()
          router.push('/(tabs)/inbox')
        }}
      />
      <Text className="text-sm leading-[21px] text-muted">
        Shared work and project conflicts, in one place. You’ll be prompted to review any sync conflicts when they
        occur.
      </Text>
      <MenuRow
        icon="information-circle-outline"
        title="About Clippster"
        subtitle="App version and licenses"
        onPress={() => setAboutVisible(true)}
      />
      <AboutSheet visible={aboutVisible} onClose={() => setAboutVisible(false)} />
    </BottomSheet>
  )
}

import { useEffect, useState } from 'react'
import { Linking, Text, View } from 'react-native'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { MenuRow } from '@/components/navigation/MenuRow'
import { useAuth } from '@/context/AuthContext'
import { getAppVersion } from '@/lib/config'
import { getFfmpegVersion } from '@/services/ffmpeg'
import { checkAndApplyUpdates, getUpdateDebugLabel } from '@/services/appUpdates'

export function AboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { authProvider } = useAuth()
  const [ffmpegVersion, setFfmpegVersion] = useState('Loading…')
  const [checking, setChecking] = useState(false)
  useEffect(() => {
    if (!visible) return
    let active = true
    void getFfmpegVersion()
      .then((value) => {
        if (active) setFfmpegVersion(value)
      })
      .catch(() => {
        if (active) setFfmpegVersion('Version unavailable')
      })
    return () => {
      active = false
    }
  }, [visible])
  return (
    <BottomSheet visible={visible} onClose={onClose} variant="page" title="About Clippster">
      <EmptyState icon="Film" title="Clippster" subtitle="Your mobile creative workspace." />
      <MenuRow icon="Info" title="App version" value={getAppVersion()} onPress={() => {}} trailing={<View />} />
      <MenuRow
        icon="CloudDownload"
        title={checking ? 'Checking for updates…' : 'Check for updates'}
        subtitle={getUpdateDebugLabel()}
        onPress={() => {
          if (checking) return
          setChecking(true)
          void checkAndApplyUpdates({ interactive: true }).finally(() => setChecking(false))
        }}
      />
      <MenuRow
        icon="FileText"
        title="FFmpeg · LGPL"
        subtitle={ffmpegVersion}
        onPress={() => void Linking.openURL('https://ffmpeg.org/legal.html')}
      />
      <Text className="text-xs leading-5 text-muted">
        This app uses FFmpeg licensed under LGPL. Open FFmpeg for source and license notices.
      </Text>
      <MenuRow
        icon="ShieldCheck"
        title="Privacy Policy"
        onPress={() => void Linking.openURL('https://clippster.app/privacy')}
      />
      <MenuRow
        icon="File"
        title="Terms of Service"
        onPress={() => void Linking.openURL('https://clippster.app/terms')}
      />
      <Text className="text-sm text-muted">Signed in via {authProvider ?? 'email'}</Text>
    </BottomSheet>
  )
}

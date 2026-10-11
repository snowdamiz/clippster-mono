import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native'
import type { UserPreferences } from '@clippster/api-client'
import { AppIcon, type AppIconName } from '@/components/AppIcon'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { SectionCard } from '@/components/ui/SectionCard'
import { Tabs } from '@/components/ui/tabs'
import { userPreferencesApi } from '@/services/api'
import { appAlert } from '@/lib/appAlert'
import { tokens } from '@/theme/tokens'

const ROWS: { key: keyof UserPreferences; label: string; icon: AppIconName }[] = [
  { key: 'notify_livestream', label: 'Livestream alerts', icon: 'Radio' },
  { key: 'notify_clips', label: 'Clip alerts', icon: 'Scissors' },
  { key: 'notify_downloads', label: 'Download alerts', icon: 'Download' },
  { key: 'notify_projects', label: 'Project alerts', icon: 'FolderOpen' },
  { key: 'notify_social', label: 'Social alerts', icon: 'Share2' },
  { key: 'notify_organization', label: 'Organization alerts', icon: 'Building2' },
  { key: 'notify_system', label: 'System alerts', icon: 'Settings' },
  { key: 'toast_enabled', label: 'Toasts enabled', icon: 'MessageSquare' },
  { key: 'toast_sound_enabled', label: 'Toast sound', icon: 'Volume2' }
]

export function PreferencesSheet({
  visible,
  onClose,
  mode = 'notifications'
}: {
  visible: boolean
  onClose: () => void
  mode?: 'notifications' | 'time'
}) {
  const [prefs, setPrefs] = useState<UserPreferences>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const result = await userPreferencesApi.get()
      if (!result.success || !result.preferences) throw new Error(result.error ?? 'Could not load preferences')
      setPrefs(result.preferences)
    } catch (error) {
      setLoadError(true)
      appAlert('Could not load', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    if (visible) void load()
  }, [visible, load])
  async function save() {
    if (saving || loading || loadError) return
    setSaving(true)
    try {
      const result = await userPreferencesApi.update(prefs)
      if (!result.success) throw new Error(result.error ?? 'Could not save preferences')
      if (result.preferences) setPrefs(result.preferences)
      onClose()
    } catch (error) {
      appAlert('Could not save', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }
  const renderRow = (row: (typeof ROWS)[number]) => (
    <View key={row.key} className="min-h-[60px] flex-row items-center gap-3 border-b border-border py-3">
      <AppIcon name={row.icon} size={24} color={tokens.colors.foreground} />
      <Text className="flex-1 text-sm text-foreground">{row.label}</Text>
      <Switch
        accessibilityLabel={row.label}
        value={Boolean(prefs[row.key])}
        onValueChange={(value) => setPrefs((prev) => ({ ...prev, [row.key]: value }))}
        trackColor={{ false: tokens.colors.border, true: tokens.colors.accent }}
        disabled={loading || saving || loadError}
      />
    </View>
  )
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="page"
      title={mode === 'time' ? 'Time format' : 'Notifications'}
      headerAccessory={
        <Pressable
          accessibilityRole="button"
          disabled={saving || loading || loadError}
          onPress={() => void save()}
          className="min-h-11 justify-center px-2"
        >
          <Text className="font-semibold text-accent">{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      }
    >
      <Text className="text-sm leading-[21px] text-muted">
        {mode === 'time'
          ? 'Choose how times appear across your Clippster account.'
          : 'Choose what you’d like to be notified about. You can change these at any time.'}
      </Text>
      {loading ? (
        <ActivityIndicator color={tokens.colors.accent} />
      ) : loadError ? (
        <Pressable onPress={() => void load()} className="min-h-11 justify-center">
          <Text className="text-accent">Retry loading preferences</Text>
        </Pressable>
      ) : mode === 'time' ? (
        <Tabs
          items={[
            { key: '12h', label: '12-hour' },
            { key: '24h', label: '24-hour' }
          ]}
          value={prefs.time_format_preference ?? '12h'}
          onChange={(value) => setPrefs((prev) => ({ ...prev, time_format_preference: value as '12h' | '24h' }))}
        />
      ) : (
        <>
          <SectionCard>{ROWS.slice(0, 7).map(renderRow)}</SectionCard>
          <SectionCard title="Toasts">{ROWS.slice(7).map(renderRow)}</SectionCard>
        </>
      )}
    </BottomSheet>
  )
}

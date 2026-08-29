import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import type { UserPreferences } from '@clippster/api-client';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { userPreferencesApi } from '@/services/api';
import { appAlert } from '@/lib/appAlert';
import { tokens } from '@/theme/tokens';

export default function PreferencesScreen() {
  const [prefs, setPrefs] = useState<UserPreferences>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await userPreferencesApi.get();
      if (result.success && result.preferences) {
        setPrefs(result.preferences);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(key: keyof UserPreferences, value: boolean) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const result = await userPreferencesApi.update(prefs);
      if (!result.success) {
        appAlert('Could not save', result.error ?? 'Try again');
        return;
      }
      if (result.preferences) setPrefs(result.preferences);
      appAlert('Saved', 'Preferences synced to your account.');
    } finally {
      setSaving(false);
    }
  }

  const rows: { key: keyof UserPreferences; label: string }[] = [
    { key: 'notify_livestream', label: 'Livestream alerts' },
    { key: 'notify_clips', label: 'Clip alerts' },
    { key: 'notify_downloads', label: 'Download alerts' },
    { key: 'notify_projects', label: 'Project alerts' },
    { key: 'notify_social', label: 'Social alerts' },
    { key: 'notify_organization', label: 'Organization alerts' },
    { key: 'notify_system', label: 'System alerts' },
    { key: 'toast_enabled', label: 'Toasts enabled' },
    { key: 'toast_sound_enabled', label: 'Toast sound' },
  ];

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Preferences" showBack />
      <ScrollView contentContainerClassName="gap-4 px-4 py-4 pb-10">
        <Text className="text-sm text-muted">
          These settings sync with your Clippster account on desktop and mobile.
        </Text>

        <View className="overflow-hidden rounded-xl border border-border bg-surface">
          <Pressable
            className="flex-row items-center justify-between border-b border-border px-4 py-3"
            onPress={() =>
              setPrefs((prev) => ({
                ...prev,
                time_format_preference:
                  prev.time_format_preference === '24h' ? '12h' : '24h',
              }))
            }
          >
            <Text className="text-foreground">Time format</Text>
            <Text className="text-muted">
              {prefs.time_format_preference === '24h' ? '24-hour' : '12-hour'}
            </Text>
          </Pressable>

          {rows.map((row, index) => (
            <View
              key={row.key}
              className={`flex-row items-center justify-between px-4 py-3 ${
                index < rows.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <Text className="text-foreground">{row.label}</Text>
              <Switch
                value={Boolean(prefs[row.key])}
                onValueChange={(value) => toggle(row.key, value)}
                trackColor={{ true: tokens.colors.accent }}
                disabled={loading}
              />
            </View>
          ))}
        </View>

        <Button title={saving ? 'Saving…' : 'Save preferences'} onPress={() => void save()} disabled={saving || loading} />
      </ScrollView>
    </View>
  );
}

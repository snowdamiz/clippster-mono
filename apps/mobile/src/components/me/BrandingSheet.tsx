import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/button';
import { appAlert } from '@/lib/appAlert';
import { userBrandingApi } from '@/services/api';
import {
  listCachedUserProfiles,
  syncPersonalBrandingFromCloud,
  type CachedUserCreatorProfile,
} from '@/services/userBrandingSync';
import { tokens } from '@/theme/tokens';

interface BrandingSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function BrandingSheet({ visible, onClose }: BrandingSheetProps) {
  const [profiles, setProfiles] = useState<CachedUserCreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    setProfiles(await listCachedUserProfiles());
  }, []);

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      setLoading(true);
      try {
        await syncPersonalBrandingFromCloud();
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, refresh]);

  if (!visible) return null;

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncPersonalBrandingFromCloud();
      await refresh();
      appAlert(
        'Synced',
        `${result.profiles} profiles · ${result.assets} assets${result.failed ? ` · ${result.failed} failed` : ''}`,
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleUploadAsset(assetType: 'watermark' | 'intro' | 'outro') {
    const picked = await DocumentPicker.getDocumentAsync({
      type: assetType === 'watermark' ? ['image/*'] : ['video/*', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const file = picked.assets[0];
    setUploading(true);
    try {
      const result = await userBrandingApi.uploadAsset({
        assetType,
        name: file.name,
        file: {
          uri: file.uri,
          name: file.name,
          type: file.mimeType ?? 'application/octet-stream',
        },
      });
      if (!result.success) {
        appAlert('Upload failed', result.error ?? 'Could not upload asset');
        return;
      }
      await syncPersonalBrandingFromCloud();
      await refresh();
      appAlert('Uploaded', `${assetType} is in your cloud branding library.`);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateProfile() {
    setUploading(true);
    try {
      const result = await userBrandingApi.upsertProfile({
        name: `Profile ${new Date().toLocaleDateString()}`,
        scope: 'personal_studio',
        client_id: `mobile-${Date.now()}`,
      });
      if (!result.success) {
        appAlert('Could not create profile', result.error ?? 'Try again');
        return;
      }
      await syncPersonalBrandingFromCloud();
      await refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="sheet"
      title="Creator branding"
      subtitle="Intros, outros, watermarks — synced with desktop"
      headerIcon="color-palette-outline"
      scrollable
      maxHeightClassName="max-h-[92%]"
    >
      <Text className="text-sm text-muted">
        Personal intros, outros, watermarks, and creator profiles sync with desktop via the same
        cloud asset system used for organizations.
      </Text>

      <View className="flex-row flex-wrap gap-2">
        <Button
          title={syncing ? 'Syncing…' : 'Sync now'}
          onPress={() => void handleSync()}
          disabled={syncing}
        />
        <Button
          title="New profile"
          variant="outline"
          onPress={() => void handleCreateProfile()}
          disabled={uploading}
        />
      </View>

      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
          Upload assets
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Button
            title="Watermark"
            variant="outline"
            onPress={() => void handleUploadAsset('watermark')}
            disabled={uploading}
          />
          <Button
            title="Intro"
            variant="outline"
            onPress={() => void handleUploadAsset('intro')}
            disabled={uploading}
          />
          <Button
            title="Outro"
            variant="outline"
            onPress={() => void handleUploadAsset('outro')}
            disabled={uploading}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={tokens.colors.accent} />
      ) : profiles.length === 0 ? (
        <Text className="text-sm text-muted">
          No personal branding profiles yet. Create one or sync from desktop.
        </Text>
      ) : (
        <View className="overflow-hidden rounded-xl border border-border bg-surface">
          {profiles.map((profile, index) => (
            <Pressable
              key={profile.server_id}
              className={`px-4 py-3 ${index < profiles.length - 1 ? 'border-b border-border' : ''}`}
            >
              <Text className="font-semibold text-foreground">{profile.name}</Text>
              <Text className="text-xs text-muted">
                {profile.scope}
                {profile.disabled ? ' · disabled' : ''}
                {profile.watermark_id ? ' · watermark' : ''}
                {profile.intro_id ? ' · intro' : ''}
                {profile.outro_id ? ' · outro' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

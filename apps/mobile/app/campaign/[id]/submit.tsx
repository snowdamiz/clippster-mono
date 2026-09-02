import type { SocialPlatform, UserSocialAccount } from '@clippster/api-client';
import { getPlatformDisplayName } from '@clippster/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DISTRIBUTION_PLATFORMS } from '@/config/distributionPlatforms';
import { analyticsApi, campaignApi, userSocialApi } from '@/services/api';
import { getCompletedClipBuilds, type ClipBuildRow } from '@/services/database/clips';
import { uploadMediaWithProgress } from '@/services/mediaUpload';
import { tokens } from '@/theme/tokens';
import { appAlert } from '@/lib/appAlert';

export default function CampaignSubmitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(id);
  const [builds, setBuilds] = useState<ClipBuildRow[]>([]);
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<UserSocialAccount[]>([]);
  const [platform, setPlatform] = useState<string>('tiktok');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const load = useCallback(async () => {
    const [buildRows, accountResponse, campaignResponse] = await Promise.all([
      getCompletedClipBuilds(30),
      userSocialApi.listAccounts(),
      campaignApi.getCampaign(campaignId),
    ]);
    setBuilds(buildRows);
    if (buildRows.length > 0) setSelectedBuildId(buildRows[0].id);
    setAccounts(accountResponse.social_accounts ?? accountResponse.accounts ?? []);
    if (campaignResponse.success && campaignResponse.campaign?.allowed_platforms[0]) {
      setPlatform(campaignResponse.campaign.allowed_platforms[0]);
    }
  }, [campaignId]);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const platformAccounts = useMemo(
    () => accounts.filter((a) => a.platform === platform && a.is_active),
    [accounts, platform],
  );

  useEffect(() => {
    if (platformAccounts.length > 0) {
      setAccountId(platformAccounts[0].id);
    } else {
      setAccountId(null);
    }
  }, [platformAccounts]);

  async function handleSubmit() {
    const build = builds.find((b) => b.id === selectedBuildId);
    if (!build) {
      appAlert('Select export', 'Choose a completed export to submit.');
      return;
    }
    if (!accountId) {
      appAlert('Connect account', 'Connect a social account for the selected platform first.');
      return;
    }

    setSubmitting(true);
    try {
      const upload = await uploadMediaWithProgress(
        { uri: build.file_path, name: `campaign_${build.id}.mp4`, type: 'video/mp4' },
        undefined,
        (p) => setUploadProgress(p.fraction),
      );
      if (!upload.success || !upload.media_url) {
        appAlert('Upload failed', upload.error ?? 'Could not upload clip');
        return;
      }

      const response = await campaignApi.submitClip(
        campaignId,
        upload.media_url,
        platform,
        accountId,
      );
      if (response.success) {
        void analyticsApi.trackEvent({
          event_type: 'campaign_submitted',
          metadata: { campaign_id: campaignId },
        });
        appAlert('Submitted', 'Your clip has been submitted for review.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        appAlert('Error', response.error ?? 'Submission failed');
      }
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Submit clip" showBack />
      <ScrollView contentContainerClassName="gap-4 px-4 py-4 pb-10">
        <Card className="gap-3">
          <Text className="font-semibold text-foreground">Select export</Text>
          {builds.length === 0 ? (
            <Text className="text-muted">No completed exports. Export a clip from a project first.</Text>
          ) : (
            builds.map((build) => (
              <Pressable
                key={build.id}
                onPress={() => setSelectedBuildId(build.id)}
                className={`rounded-lg border p-3 ${selectedBuildId === build.id ? 'border-primary bg-primary/10' : 'border-border'}`}
              >
                <Text className="text-foreground">Build #{build.build_number}</Text>
                <Text className="text-sm text-muted" numberOfLines={1}>
                  {build.file_path.split('/').pop()}
                </Text>
              </Pressable>
            ))
          )}
        </Card>

        <Card className="gap-3">
          <Text className="font-semibold text-foreground">Platform</Text>
          <View className="flex-row flex-wrap gap-2">
            {DISTRIBUTION_PLATFORMS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setPlatform(p.id)}
                className={`rounded-full border px-3 py-1.5 ${platform === p.id ? 'border-primary bg-primary/10' : 'border-border'}`}
              >
                <Text className={platform === p.id ? 'text-primary' : 'text-foreground'}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card className="gap-3">
          <Text className="font-semibold text-foreground">Connected account</Text>
          {platformAccounts.length === 0 ? (
            <Text className="text-muted">No {getPlatformDisplayName(platform)} account connected.</Text>
          ) : (
            platformAccounts.map((account) => (
              <Pressable
                key={account.id}
                onPress={() => setAccountId(account.id)}
                className={`rounded-lg border p-3 ${accountId === account.id ? 'border-primary bg-primary/10' : 'border-border'}`}
              >
                <Text className="text-foreground">@{account.username}</Text>
              </Pressable>
            ))
          )}
        </Card>

        {submitting && uploadProgress > 0 ? (
          <Text className="text-center text-muted">Uploading {Math.round(uploadProgress * 100)}%</Text>
        ) : null}

        <Button
          title={submitting ? 'Submitting...' : 'Submit to campaign'}
          disabled={submitting || builds.length === 0}
          onPress={handleSubmit}
        />
      </ScrollView>
    </View>
  );
}

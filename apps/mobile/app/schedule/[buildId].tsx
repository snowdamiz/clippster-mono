import type { SocialPlatform, UserSocialAccount } from '@clippster/api-client';
import type { Campaign, Organization, ServerOrganizationCreatorProfile } from '@clippster/api-client';
import {
  formatScheduleDate,
  getMinScheduleTime,
  isValidScheduleTime,
} from '@clippster/api-client';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DISTRIBUTION_PLATFORMS } from '@/config/distributionPlatforms';
import {
  analyticsApi,
  campaignApi,
  organizationProfilesApi,
  organizationsApi,
  schedulingApi,
  userSocialApi,
} from '@/services/api';
import { getClipBuildById, getClipById, type ClipBuildRow } from '@/services/database/clips';
import { uploadMediaWithProgress } from '@/services/mediaUpload';
import { tokens } from '@/theme/tokens';

function parseAspectRatios(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

type PostingContext = 'personal' | 'organization' | 'campaign';

export default function ScheduleScreen() {
  const { buildId } = useLocalSearchParams<{ buildId: string }>();
  const [build, setBuild] = useState<ClipBuildRow | null>(null);
  const [clipName, setClipName] = useState('');
  const [accounts, setAccounts] = useState<UserSocialAccount[]>([]);
  const [platform, setPlatform] = useState<SocialPlatform>('tiktok');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [postNow, setPostNow] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [postingContext, setPostingContext] = useState<PostingContext>('personal');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [creatorProfiles, setCreatorProfiles] = useState<ServerOrganizationCreatorProfile[]>([]);
  const [creatorProfileId, setCreatorProfileId] = useState<number | null>(null);
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [orgAccounts, setOrgAccounts] = useState<UserSocialAccount[]>([]);

  const loadData = useCallback(async () => {
    if (!buildId) return;
    const buildRow = await getClipBuildById(buildId);
    if (!buildRow || buildRow.status !== 'completed') {
      Alert.alert('Export not found', 'This export is not available for scheduling.');
      router.back();
      return;
    }
    setBuild(buildRow);
    const clip = await getClipById(buildRow.clip_id);
    setClipName(clip?.name ?? 'Clip');

    const minTime = getMinScheduleTime();
    setScheduledAt(minTime.toISOString().slice(0, 16));

    const response = await userSocialApi.listAccounts();
    setAccounts(response.social_accounts ?? response.accounts ?? []);

    const orgResponse = await organizationsApi.listMyOrganizations();
    if (orgResponse.success && orgResponse.organizations.length > 0) {
      setOrganizations(orgResponse.organizations);
      setOrgId(orgResponse.organizations[0].id);
    }

    const profilesResponse = await organizationProfilesApi.getMyAssignedCreatorProfiles();
    if (profilesResponse.success) {
      setCreatorProfiles(profilesResponse.profiles.filter((p) => !p.disabled));
    }

    const campaignsResponse = await campaignApi.listMyCampaigns();
    if (campaignsResponse.success) {
      setMyCampaigns(campaignsResponse.campaigns);
    }
  }, [buildId]);

  useEffect(() => {
    void (async () => {
      try {
        await loadData();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadData]);

  const platformAccounts = useMemo(() => {
    const source = postingContext === 'personal' ? accounts : orgAccounts;
    return source.filter((a) => a.platform === platform && a.is_active);
  }, [accounts, orgAccounts, platform, postingContext]);

  useEffect(() => {
    if (!orgId || postingContext === 'personal') {
      setOrgAccounts([]);
      return;
    }
    void userSocialApi.listOrgAccounts(orgId, platform as SocialPlatform).then((response) => {
      setOrgAccounts(response.social_accounts ?? response.accounts ?? []);
    });
  }, [orgId, platform, postingContext]);

  useEffect(() => {
    if (platformAccounts.length > 0 && !platformAccounts.some((a) => a.id === accountId)) {
      setAccountId(platformAccounts[0].id);
    } else if (platformAccounts.length === 0) {
      setAccountId(null);
    }
  }, [platformAccounts, accountId]);

  const aspectRatios = parseAspectRatios(build?.aspect_ratios ?? null);
  const selectedPlatform = DISTRIBUTION_PLATFORMS.find((p) => p.id === platform);
  const aspectWarning =
    selectedPlatform &&
    aspectRatios.length > 0 &&
    selectedPlatform.preferredAspectRatio !== 'any' &&
    !aspectRatios.includes(selectedPlatform.preferredAspectRatio);

  async function handleSchedule() {
    if (!build || !accountId) {
      Alert.alert('Missing account', 'Connect a social account for this platform first.');
      return;
    }
    if (postingContext !== 'personal' && !orgId) {
      Alert.alert('Missing organization', 'Select an organization for this post.');
      return;
    }

    setSubmitting(true);
    try {
      const fileInfo = await FileSystem.getInfoAsync(build.file_path);
      if (!fileInfo.exists) {
        Alert.alert('File missing', 'The exported clip file could not be found.');
        return;
      }

      setUploadProgress(0);
      const uploadResult = await uploadMediaWithProgress(
        {
          uri: build.file_path,
          name: `${build.id}.mp4`,
          type: 'video/mp4',
        },
        build.thumbnail_path
          ? {
              uri: build.thumbnail_path,
              name: `${build.id}_thumb.jpg`,
              type: 'image/jpeg',
            }
          : undefined,
        (p) => setUploadProgress(p.fraction),
      );

      if (!uploadResult.success || !uploadResult.media_url) {
        Alert.alert('Upload failed', uploadResult.error ?? 'Could not upload clip.');
        return;
      }

      void analyticsApi.trackEvent({
        event_type: 'clip_uploaded_for_post',
        metadata: { clip_id: build.clip_id, platform },
      });

      let scheduleTime: Date;
      if (postNow) {
        scheduleTime = new Date();
        scheduleTime.setMinutes(scheduleTime.getMinutes() + 1);
      } else {
        scheduleTime = new Date(scheduledAt);
        if (!isValidScheduleTime(scheduleTime)) {
          Alert.alert('Invalid time', 'Schedule at least 5 minutes in the future.');
          return;
        }
      }

      const mediaType =
        platform === 'instagram' || platform === 'tiktok' ? 'reel' : 'video';

      const response = await schedulingApi.schedulePost({
        platform,
        media_url: uploadResult.media_url,
        thumbnail_url: uploadResult.thumbnail_url,
        caption: caption.trim() || undefined,
        scheduled_at: formatScheduleDate(scheduleTime),
        clip_id: build.clip_id,
        media_type: mediaType,
        ...(postingContext === 'personal'
          ? { user_social_account_id: accountId }
          : {
              organization_id: orgId ?? undefined,
              social_account_id: accountId ?? undefined,
              creator_profile_id: creatorProfileId ?? undefined,
              campaign_id: postingContext === 'campaign' ? (campaignId ?? undefined) : undefined,
            }),
      });

      if (!response.success) {
        const message = response.error ?? 'Failed to schedule post';
        if (message.toLowerCase().includes('subscription') || message.includes('403')) {
          Alert.alert('Subscription required', 'Scheduling requires an active subscription.');
        } else {
          Alert.alert('Schedule failed', message);
        }
        return;
      }

      void analyticsApi.trackEvent({
        event_type: 'post_scheduled',
        metadata: { platform, post_id: response.post?.id },
      });

      Alert.alert('Scheduled', postNow ? 'Post is publishing soon.' : 'Post scheduled successfully.', [
        { text: 'View posts', onPress: () => router.replace('/(tabs)/posts') },
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setSubmitting(false);
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
      <AppHeader title="Schedule post" showBack />
      <ScrollView contentContainerClassName="gap-4 px-4 py-4">
        <View className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-3">
          {build?.thumbnail_path ? (
            <Image source={{ uri: build.thumbnail_path }} className="h-16 w-12 rounded bg-surfaceMuted" />
          ) : (
            <View className="h-16 w-12 items-center justify-center rounded bg-surfaceMuted">
              <Ionicons name="videocam" size={24} color={tokens.colors.muted} />
            </View>
          )}
          <View className="flex-1">
            <Text className="font-semibold text-foreground">{clipName}</Text>
            {build?.duration ? (
              <Text className="text-sm text-muted">{Math.round(build.duration)}s</Text>
            ) : null}
            {aspectRatios.length > 0 ? (
              <Text className="text-xs text-muted">{aspectRatios.join(', ')}</Text>
            ) : null}
          </View>
        </View>

        <Text className="text-sm font-semibold text-foreground">Posting as</Text>
        <View className="flex-row flex-wrap gap-2">
          {(['personal', 'organization', 'campaign'] as PostingContext[]).map((ctx) => (
            <Pressable
              key={ctx}
              onPress={() => setPostingContext(ctx)}
              className={`rounded-lg border px-3 py-2 capitalize ${
                postingContext === ctx ? 'border-primary bg-primary/10' : 'border-border bg-surface'
              }`}
            >
              <Text className={postingContext === ctx ? 'text-primary' : 'text-foreground'}>{ctx}</Text>
            </Pressable>
          ))}
        </View>

        {postingContext !== 'personal' && organizations.length > 0 ? (
          <>
            <Text className="text-sm font-semibold text-foreground">Organization</Text>
            <View className="flex-row flex-wrap gap-2">
              {organizations.map((org) => (
                <Pressable
                  key={org.id}
                  onPress={() => setOrgId(org.id)}
                  className={`rounded-lg border px-3 py-2 ${
                    orgId === org.id ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                  }`}
                >
                  <Text className={orgId === org.id ? 'text-primary' : 'text-foreground'}>{org.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {postingContext !== 'personal' && creatorProfiles.length > 0 ? (
          <>
            <Text className="text-sm font-semibold text-foreground">Creator profile</Text>
            <View className="flex-row flex-wrap gap-2">
              {creatorProfiles
                .filter((p) => !orgId || p.organization_id === orgId)
                .map((profile) => (
                  <Pressable
                    key={profile.id}
                    onPress={() => setCreatorProfileId(profile.id)}
                    className={`rounded-lg border px-3 py-2 ${
                      creatorProfileId === profile.id ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                    }`}
                  >
                    <Text
                      className={creatorProfileId === profile.id ? 'text-primary' : 'text-foreground'}
                    >
                      {profile.name}
                    </Text>
                  </Pressable>
                ))}
            </View>
          </>
        ) : null}

        {postingContext === 'campaign' && myCampaigns.length > 0 ? (
          <>
            <Text className="text-sm font-semibold text-foreground">Campaign</Text>
            <View className="gap-2">
              {myCampaigns.map((campaign) => (
                <Pressable
                  key={campaign.id}
                  onPress={() => setCampaignId(campaign.id)}
                  className={`rounded-lg border px-3 py-2 ${
                    campaignId === campaign.id ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                  }`}
                >
                  <Text className={campaignId === campaign.id ? 'text-primary' : 'text-foreground'}>
                    {campaign.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text className="text-sm font-semibold text-foreground">Platform</Text>
        <View className="flex-row flex-wrap gap-2">
          {DISTRIBUTION_PLATFORMS.map((p) => {
            const active = platform === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPlatform(p.id)}
                className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 ${
                  active ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                }`}
              >
                <Ionicons
                  name={p.icon}
                  size={18}
                  color={active ? tokens.colors.primary : tokens.colors.muted}
                />
                <Text className={active ? 'text-primary' : 'text-foreground'}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {aspectWarning ? (
          <Text className="text-xs text-warning">
            {selectedPlatform?.name} works best with {selectedPlatform?.preferredAspectRatio} clips.
          </Text>
        ) : null}

        <Text className="text-sm font-semibold text-foreground">Account</Text>
        {platformAccounts.length === 0 ? (
          <Pressable
            onPress={() => router.push('/(tabs)/accounts')}
            className="rounded-lg border border-dashed border-border px-4 py-3"
          >
            <Text className="text-center text-primary">Connect a {selectedPlatform?.name} account</Text>
          </Pressable>
        ) : (
          platformAccounts.map((account) => {
            const active = accountId === account.id;
            return (
              <Pressable
                key={account.id}
                onPress={() => setAccountId(account.id)}
                className={`mb-2 rounded-lg border px-4 py-3 ${
                  active ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                }`}
              >
                <Text className="text-foreground">@{account.username}</Text>
              </Pressable>
            );
          })
        )}

        <Text className="text-sm font-semibold text-foreground">Caption</Text>
        <Input
          value={caption}
          onChangeText={setCaption}
          multiline
          numberOfLines={4}
          placeholder="Write a caption..."
          className="min-h-[100px]"
        />

        <View className="flex-row items-center justify-between rounded-lg bg-surface px-4 py-3">
          <Text className="text-foreground">Post now</Text>
          <Switch
            value={postNow}
            onValueChange={setPostNow}
            trackColor={{ true: tokens.colors.primary }}
          />
        </View>

        {!postNow ? (
          <>
            <Text className="text-sm font-semibold text-foreground">Schedule time (local)</Text>
            <Input
              value={scheduledAt}
              onChangeText={setScheduledAt}
              placeholder="YYYY-MM-DDTHH:mm"
            />
          </>
        ) : null}

        {submitting && uploadProgress > 0 && uploadProgress < 1 ? (
          <View className="rounded-lg bg-surface px-4 py-3">
            <Text className="text-sm text-foreground">
              Uploading... {Math.round(uploadProgress * 100)}%
            </Text>
            <View className="mt-2 h-2 overflow-hidden rounded bg-border">
              <View
                className="h-full bg-primary"
                style={{ width: `${Math.round(uploadProgress * 100)}%` }}
              />
            </View>
          </View>
        ) : null}

        <Button
          title={submitting ? 'Scheduling...' : postNow ? 'Publish now' : 'Schedule post'}
          disabled={submitting || !accountId}
          onPress={() => void handleSchedule()}
        />
      </ScrollView>
    </View>
  );
}

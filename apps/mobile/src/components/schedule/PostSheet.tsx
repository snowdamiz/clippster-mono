import type { SocialPlatform, UserSocialAccount } from '@clippster/api-client';
import type { Campaign, Organization, ServerOrganizationCreatorProfile } from '@clippster/api-client';
import {
  formatScheduleDate,
  filterCampaignsOpenForPosting,
  getMinScheduleTime,
  isValidScheduleTime,
} from '@clippster/api-client';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Switch, Text, View } from 'react-native';
import {
  formatScheduleLabel,
  ScheduleTimeSheet,
  toLocalScheduleValue,
} from '@/components/schedule/ScheduleTimeSheet';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/input';
import { AccountsSheet } from '@/components/me/AccountsSheet';
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
import { appAlert } from '@/lib/appAlert';

function parseAspectRatios(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

type PostingContext = 'personal' | 'organization' | 'campaign';

interface PostSheetProps {
  visible: boolean;
  buildId: string | null;
  onClose: () => void;
}

export function PostSheet({ visible, buildId, onClose }: PostSheetProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [build, setBuild] = useState<ClipBuildRow | null>(null);
  const [clipName, setClipName] = useState('');
  const [accounts, setAccounts] = useState<UserSocialAccount[]>([]);
  const [platform, setPlatform] = useState<SocialPlatform>('tiktok');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [postNow, setPostNow] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(false);
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
  const [showAccountsSheet, setShowAccountsSheet] = useState(false);

  const resetForm = useCallback(() => {
    setBuild(null);
    setClipName('');
    setAccounts([]);
    setPlatform('tiktok');
    setAccountId(null);
    setCaption('');
    setPostNow(false);
    setScheduledAt('');
    setSchedulePickerOpen(false);
    setUploadProgress(0);
    setSubmitting(false);
    setLoading(true);
    setPostingContext('personal');
    setOrganizations([]);
    setOrgId(null);
    setCreatorProfiles([]);
    setCreatorProfileId(null);
    setMyCampaigns([]);
    setCampaignId(null);
    setOrgAccounts([]);
    setShowAccountsSheet(false);
  }, []);

  const loadData = useCallback(async (id: string) => {
    const buildRow = await getClipBuildById(id);
    if (!buildRow || buildRow.status !== 'completed') {
      appAlert('Export not found', 'This export is not available for scheduling.');
      onCloseRef.current();
      return;
    }
    setBuild(buildRow);
    const clip = await getClipById(buildRow.clip_id);
    setClipName(clip?.name ?? 'Clip');

    setScheduledAt(toLocalScheduleValue(getMinScheduleTime()));

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

    const campaignsResponse = await campaignApi.listMyCampaigns('active');
    if (campaignsResponse.success) {
      setMyCampaigns(filterCampaignsOpenForPosting(campaignsResponse.campaigns));
    }
  }, []);

  useEffect(() => {
    if (!visible || !buildId) {
      if (!visible) resetForm();
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await loadData(buildId);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, buildId, loadData, resetForm]);

  const platformAccounts = useMemo(() => {
    const source = postingContext === 'personal' ? accounts : orgAccounts;
    return source.filter((a) => a.platform === platform && a.is_active);
  }, [accounts, orgAccounts, platform, postingContext]);

  useEffect(() => {
    if (!visible || !orgId || postingContext === 'personal') {
      setOrgAccounts([]);
      return;
    }
    void userSocialApi.listOrgAccounts(orgId, platform as SocialPlatform).then((response) => {
      setOrgAccounts(response.social_accounts ?? response.accounts ?? []);
    });
  }, [visible, orgId, platform, postingContext]);

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
      appAlert('Missing account', 'Connect a social account for this platform first.');
      return;
    }
    if (postingContext !== 'personal' && !orgId) {
      appAlert('Missing organization', 'Select an organization for this post.');
      return;
    }

    setSubmitting(true);
    try {
      const fileInfo = await FileSystem.getInfoAsync(build.file_path);
      if (!fileInfo.exists) {
        appAlert('File missing', 'The exported clip file could not be found.');
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
        appAlert('Upload failed', uploadResult.error ?? 'Could not upload clip.');
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
          appAlert('Invalid time', 'Schedule at least 5 minutes in the future.');
          return;
        }
      }

      const mediaType = platform === 'instagram' || platform === 'tiktok' ? 'reel' : 'video';

      if (platform === 'tokend' && postingContext === 'personal' && postNow) {
        const { tokendApi } = await import('@/services/api');
        const publish = await tokendApi.publish({
          account_id: accountId,
          media_url: uploadResult.media_url,
          thumbnail_url: uploadResult.thumbnail_url,
          caption: caption.trim() || undefined,
          media_type: mediaType,
        });
        if (!publish.success) {
          appAlert('Publish failed', publish.message ?? publish.error ?? 'Failed to publish to Tokend');
          return;
        }
        void analyticsApi.trackEvent({
          event_type: 'post_scheduled',
          metadata: { platform, provider: 'tokend', immediate: true },
        });
        appAlert('Published', 'Clip published to Tokend.');
        onClose();
        router.replace('/(tabs)/profile?sheet=posts');
        return;
      }

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
          appAlert('Subscription required', 'Scheduling requires an active subscription.');
        } else {
          appAlert('Schedule failed', message);
        }
        return;
      }

      void analyticsApi.trackEvent({
        event_type: 'post_scheduled',
        metadata: { platform, post_id: response.post?.id },
      });

      appAlert('Scheduled', postNow ? 'Post is publishing soon.' : 'Post scheduled successfully.', [
        {
          text: 'View posts',
          onPress: () => {
            onClose();
            router.replace('/(tabs)/profile?sheet=posts');
          },
        },
        { text: 'OK', onPress: onClose },
      ]);
    } catch (error) {
      appAlert('Error', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  const contextOptions = useMemo(() => {
    const options: PostingContext[] = ['personal', 'organization'];
    if (myCampaigns.length > 0) options.push('campaign');
    return options;
  }, [myCampaigns.length]);

  useEffect(() => {
    if (postingContext === 'campaign' && myCampaigns.length === 0) {
      setPostingContext('personal');
      setCampaignId(null);
    }
  }, [myCampaigns.length, postingContext]);

  const contextLabel: Record<PostingContext, string> = {
    personal: 'Personal',
    organization: 'Organization',
    campaign: 'Campaign',
  };

  const durationLabel = build?.duration ? `${Math.round(build.duration)}s` : null;
  const subtitleParts = [clipName, durationLabel].filter(Boolean);

  if (!visible) return null;

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={submitting ? () => undefined : onClose}
        variant="sheet"
        title="Publish Clip"
        subtitle={subtitleParts.length > 0 ? subtitleParts.join(' • ') : undefined}
        headerIcon="rocket-outline"
        headerAccessory={
          build?.thumbnail_path ? (
            <Image
              source={{ uri: build.thumbnail_path }}
              className="h-10 w-10 rounded-lg border border-accent/40 bg-accent/15"
            />
          ) : null
        }
        dismissOnBackdrop={!submitting}
        scrollable
        keyboardAvoiding
        maxHeightClassName="max-h-[92%]"
        primaryAction={
          loading
            ? undefined
            : {
                title: submitting ? 'Scheduling...' : postNow ? 'Publish now' : 'Schedule post',
                onPress: () => void handleSchedule(),
                disabled: submitting || !accountId,
              }
        }
      >
        {loading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={tokens.colors.accent} />
          </View>
        ) : (
          <>
            {aspectRatios.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {aspectRatios.map((ratio) => (
                  <View
                    key={ratio}
                    className="rounded-md border border-accent/40 bg-accent/15 px-2.5 py-1"
                  >
                    <Text className="text-xs font-semibold text-accent">{ratio}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">Post For</Text>
              <View className="flex-row gap-1.5 rounded-lg border border-border bg-white/5 p-1">
                {contextOptions.map((ctx) => {
                  const active = postingContext === ctx;
                  return (
                    <Pressable
                      key={ctx}
                      onPress={() => setPostingContext(ctx)}
                      className={`flex-1 items-center rounded-md px-2 py-2.5 ${
                        active ? 'bg-surface' : ''
                      }`}
                    >
                      <Text
                        className={`text-[13px] font-medium ${active ? 'text-accent' : 'text-muted'}`}
                      >
                        {contextLabel[ctx]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {postingContext !== 'personal' && organizations.length > 0 ? (
              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Organization</Text>
                <View className="flex-row flex-wrap gap-2">
                  {organizations.map((org) => {
                    const active = orgId === org.id;
                    return (
                      <Pressable
                        key={org.id}
                        onPress={() => setOrgId(org.id)}
                        className={`rounded-md border px-3 py-2 ${
                          active ? 'border-accent bg-accent/10' : 'border-border bg-white/5'
                        }`}
                      >
                        <Text className={active ? 'text-accent' : 'text-foreground'}>{org.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {postingContext !== 'personal' && creatorProfiles.length > 0 ? (
              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Creator profile</Text>
                <View className="flex-row flex-wrap gap-2">
                  {creatorProfiles
                    .filter((p) => !orgId || p.organization_id === orgId)
                    .map((profile) => {
                      const active = creatorProfileId === profile.id;
                      return (
                        <Pressable
                          key={profile.id}
                          onPress={() => setCreatorProfileId(profile.id)}
                          className={`rounded-md border px-3 py-2 ${
                            active ? 'border-accent bg-accent/10' : 'border-border bg-white/5'
                          }`}
                        >
                          <Text className={active ? 'text-accent' : 'text-foreground'}>
                            {profile.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                </View>
              </View>
            ) : null}

            {postingContext === 'campaign' && myCampaigns.length > 0 ? (
              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Campaign</Text>
                <View className="gap-2">
                  {myCampaigns.map((campaign) => {
                    const active = campaignId === campaign.id;
                    return (
                      <Pressable
                        key={campaign.id}
                        onPress={() => setCampaignId(campaign.id)}
                        className={`rounded-md border px-3 py-2.5 ${
                          active ? 'border-accent bg-accent/10' : 'border-border bg-white/5'
                        }`}
                      >
                        <Text
                          className={
                            active ? 'text-sm font-medium text-accent' : 'text-sm text-foreground'
                          }
                        >
                          {campaign.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">Platforms</Text>
              <View className="flex-row flex-wrap gap-2.5">
                {DISTRIBUTION_PLATFORMS.map((p) => {
                  const active = platform === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setPlatform(p.id)}
                      className={`min-w-[46%] flex-1 flex-row items-center gap-2 rounded-md border px-3.5 py-2.5 ${
                        active ? 'border-accent bg-accent/10' : 'border-border bg-white/5'
                      }`}
                    >
                      <Ionicons
                        name={p.icon}
                        size={16}
                        color={active ? tokens.colors.accent : tokens.colors.foreground}
                      />
                      <Text
                        className={`text-[13px] ${active ? 'font-medium text-accent' : 'text-foreground'}`}
                      >
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {aspectWarning ? (
                <Text className="text-xs text-warning">
                  {selectedPlatform?.name} works best with {selectedPlatform?.preferredAspectRatio}{' '}
                  clips.
                </Text>
              ) : null}
            </View>

            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">Account</Text>
              {platformAccounts.length === 0 ? (
                <Pressable
                  onPress={() => setShowAccountsSheet(true)}
                  className="rounded-lg border border-dashed border-accent/40 bg-accent/5 px-4 py-3"
                >
                  <Text className="text-center text-sm font-medium text-accent">
                    Connect a {selectedPlatform?.name} account
                  </Text>
                </Pressable>
              ) : (
                platformAccounts.map((account) => {
                  const active = accountId === account.id;
                  return (
                    <Pressable
                      key={account.id}
                      onPress={() => setAccountId(account.id)}
                      className={`rounded-lg border px-4 py-3 ${
                        active ? 'border-accent bg-accent/10' : 'border-border bg-white/5'
                      }`}
                    >
                      <Text className={active ? 'font-medium text-accent' : 'text-foreground'}>
                        @{account.username}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>

            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">Caption</Text>
              <Input
                value={caption}
                onChangeText={setCaption}
                multiline
                numberOfLines={4}
                placeholder="Add a caption for your post..."
                className="min-h-[100px]"
                maxLength={2200}
                textAlignVertical="top"
              />
              <Text className="text-right text-xs text-muted">{caption.length} / 2200</Text>
            </View>

            <View className="flex-row items-center justify-between rounded-lg border border-border bg-white/5 px-4 py-3">
              <Text className="text-sm font-medium text-foreground">Post now</Text>
              <Switch
                value={postNow}
                onValueChange={setPostNow}
                trackColor={{ false: tokens.colors.border, true: tokens.colors.accent }}
                thumbColor={tokens.colors.foreground}
              />
            </View>

            {!postNow ? (
              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Schedule time (local)</Text>
                <Pressable
                  onPress={() => setSchedulePickerOpen(true)}
                  className="flex-row items-center justify-between rounded-md border border-border bg-white/5 px-4 py-3"
                >
                  <Text className="text-sm text-foreground">
                    {scheduledAt ? formatScheduleLabel(scheduledAt) : 'Select date and time'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={tokens.colors.accent} />
                </Pressable>
              </View>
            ) : null}

            {submitting && uploadProgress > 0 && uploadProgress < 1 ? (
              <View className="rounded-lg border border-border bg-white/5 px-4 py-3">
                <Text className="text-sm text-foreground">
                  Uploading... {Math.round(uploadProgress * 100)}%
                </Text>
                <View className="mt-2 h-2 overflow-hidden rounded bg-border">
                  <View
                    className="h-full bg-accent"
                    style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                  />
                </View>
              </View>
            ) : null}
          </>
        )}
      </BottomSheet>

      <ScheduleTimeSheet
        visible={schedulePickerOpen}
        value={scheduledAt}
        onClose={() => setSchedulePickerOpen(false)}
        onConfirm={setScheduledAt}
      />
      <AccountsSheet
        visible={showAccountsSheet}
        onClose={() => {
          setShowAccountsSheet(false);
          if (orgId && postingContext !== 'personal') {
            void userSocialApi.listOrgAccounts(orgId, platform as SocialPlatform).then((response) => {
              setOrgAccounts(response.social_accounts ?? response.accounts ?? []);
            });
          } else {
            void userSocialApi.listAccounts().then((response) => {
              setAccounts(response.social_accounts ?? response.accounts ?? []);
            });
          }
        }}
      />
    </>
  );
}

import {
  filterCampaignsOpenForPosting,
  formatScheduleDate,
  getMinScheduleTime,
  isValidScheduleTime,
  type Campaign,
  type Organization,
  type ServerOrganizationCreatorProfile,
  type SocialPlatform,
  type UserSocialAccount
} from '@clippster/api-client'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as FileSystem from 'expo-file-system/legacy'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native'
import { formatScheduleLabel, ScheduleTimeSheet, toLocalScheduleValue } from '@/components/schedule/ScheduleTimeSheet'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Input } from '@/components/ui/input'
import { AccountsSheet } from '@/components/me/AccountsSheet'
import { getDistributionPlatforms } from '@/config/distributionPlatforms'
import { Tabs } from '@/components/ui/tabs'
import { MenuRow } from '@/components/navigation/MenuRow'
import { useFeatureFlags } from '@/context/FeatureFlagsContext'
import { useAuth } from '@/context/AuthContext'
import {
  analyticsApi,
  campaignApi,
  organizationProfilesApi,
  organizationsApi,
  schedulingApi,
  userSocialApi
} from '@/services/api'
import { getClipBuildById, getClipById, type ClipBuildRow } from '@/services/database/clips'
import { uploadMediaWithProgress } from '@/services/mediaUpload'
import { tokens } from '@/theme/tokens'
import { appAlert } from '@/lib/appAlert'
import { canAccessTokend } from '@/lib/tokendAccess'

function parseAspectRatios(raw: string | null): string[] {
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

type PostingContext = 'personal' | 'organization' | 'campaign'

interface PostSheetProps {
  visible: boolean
  buildId: string | null
  onClose: () => void
}

export function PostSheet({ visible, buildId, onClose }: PostSheetProps) {
  const { user } = useAuth()
  const { canAccessCampaigns } = useFeatureFlags()
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const tokendAllowed = canAccessTokend(user)
  const availablePlatforms = useMemo(() => getDistributionPlatforms({ includeTokend: tokendAllowed }), [tokendAllowed])
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const [build, setBuild] = useState<ClipBuildRow | null>(null)
  const [clipName, setClipName] = useState('')
  const [accounts, setAccounts] = useState<UserSocialAccount[]>([])
  const [platform, setPlatform] = useState<SocialPlatform>('tiktok')
  const [accountId, setAccountId] = useState<number | null>(null)
  const [caption, setCaption] = useState('')
  const [postNow, setPostNow] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [postingContext, setPostingContext] = useState<PostingContext>('personal')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [orgId, setOrgId] = useState<number | null>(null)
  const [creatorProfiles, setCreatorProfiles] = useState<ServerOrganizationCreatorProfile[]>([])
  const [creatorProfileId, setCreatorProfileId] = useState<number | null>(null)
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([])
  const [campaignId, setCampaignId] = useState<number | null>(null)
  const [orgAccounts, setOrgAccounts] = useState<UserSocialAccount[]>([])
  const [showAccountsSheet, setShowAccountsSheet] = useState(false)

  const resetForm = useCallback(() => {
    setStep(0)
    setBuild(null)
    setClipName('')
    setAccounts([])
    setPlatform('tiktok')
    setAccountId(null)
    setCaption('')
    setPostNow(false)
    setScheduledAt('')
    setSchedulePickerOpen(false)
    setUploadProgress(0)
    setSubmitting(false)
    setLoading(true)
    setPostingContext('personal')
    setOrganizations([])
    setOrgId(null)
    setCreatorProfiles([])
    setCreatorProfileId(null)
    setMyCampaigns([])
    setCampaignId(null)
    setOrgAccounts([])
    setShowAccountsSheet(false)
  }, [])

  const loadData = useCallback(
    async (id: string) => {
      const buildRow = await getClipBuildById(id)
      if (!buildRow || buildRow.status !== 'completed') {
        appAlert('Export not found', 'This export is not available for scheduling.')
        onCloseRef.current()
        return
      }
      setBuild(buildRow)
      const clip = await getClipById(buildRow.clip_id)
      setClipName(clip?.name ?? 'Clip')

      setScheduledAt(toLocalScheduleValue(getMinScheduleTime()))

      const response = await userSocialApi.listAccounts()
      setAccounts(response.social_accounts ?? response.accounts ?? [])

      const orgResponse = await organizationsApi.listMyOrganizations()
      if (orgResponse.success && orgResponse.organizations.length > 0) {
        setOrganizations(orgResponse.organizations)
        setOrgId(orgResponse.organizations[0].id)
      }

      const profilesResponse = await organizationProfilesApi.getMyAssignedCreatorProfiles()
      if (profilesResponse.success) {
        setCreatorProfiles(profilesResponse.profiles.filter((p) => !p.disabled))
      }

      if (canAccessCampaigns) {
        const campaignsResponse = await campaignApi.listMyCampaigns('active')
        if (campaignsResponse.success) setMyCampaigns(filterCampaignsOpenForPosting(campaignsResponse.campaigns))
      } else setMyCampaigns([])
    },
    [canAccessCampaigns]
  )

  useEffect(() => {
    if (!visible || !buildId) {
      if (!visible) resetForm()
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        await loadData(buildId)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visible, buildId, loadData, resetForm])

  const platformAccounts = useMemo(() => {
    const source = postingContext === 'personal' ? accounts : orgAccounts
    return source.filter((a) => a.platform === platform && a.is_active)
  }, [accounts, orgAccounts, platform, postingContext])

  useEffect(() => {
    if (!visible || !orgId || postingContext === 'personal') {
      setOrgAccounts([])
      return
    }
    void userSocialApi.listOrgAccounts(orgId, platform as SocialPlatform).then((response) => {
      setOrgAccounts(response.social_accounts ?? response.accounts ?? [])
    })
  }, [visible, orgId, platform, postingContext])

  useEffect(() => {
    if (platformAccounts.length > 0 && !platformAccounts.some((a) => a.id === accountId)) {
      setAccountId(platformAccounts[0].id)
    } else if (platformAccounts.length === 0) {
      setAccountId(null)
    }
  }, [platformAccounts, accountId])

  const aspectRatios = parseAspectRatios(build?.aspect_ratios ?? null)
  const selectedPlatform = availablePlatforms.find((p) => p.id === platform)
  const aspectWarning =
    selectedPlatform &&
    aspectRatios.length > 0 &&
    selectedPlatform.preferredAspectRatio !== 'any' &&
    !aspectRatios.includes(selectedPlatform.preferredAspectRatio)

  function advance() {
    if (step === 0) {
      if (!platformAccounts.some((account) => account.id === accountId) || (postingContext !== 'personal' && !orgId))
        return
      if (postingContext === 'campaign' && (!canAccessCampaigns || !campaignId)) return
      setStep(1)
    } else if (step === 1) {
      if (!postNow && !isValidScheduleTime(new Date(scheduledAt))) {
        appAlert('Invalid time', 'Schedule at least 5 minutes in the future.')
        return
      }
      setStep(2)
    } else void handleSchedule()
  }

  async function handleSchedule() {
    if (!build || !accountId || !platformAccounts.some((account) => account.id === accountId)) {
      appAlert('Missing account', 'Connect a social account for this platform first.')
      return
    }
    if (postingContext !== 'personal' && !orgId) {
      appAlert('Missing organization', 'Select an organization for this post.')
      return
    }

    if (postingContext === 'campaign' && (!canAccessCampaigns || !campaignId)) {
      appAlert('Choose a campaign', 'Select an available campaign for this post.')
      return
    }
    if (!postNow && !isValidScheduleTime(new Date(scheduledAt))) {
      appAlert('Invalid time', 'Schedule at least 5 minutes in the future.')
      return
    }
    setSubmitting(true)
    try {
      const fileInfo = await FileSystem.getInfoAsync(build.file_path)
      if (!fileInfo.exists) {
        appAlert('File missing', 'The exported clip file could not be found.')
        return
      }

      setUploadProgress(0)
      const uploadResult = await uploadMediaWithProgress(
        {
          uri: build.file_path,
          name: `${build.id}.mp4`,
          type: 'video/mp4'
        },
        build.thumbnail_path
          ? {
              uri: build.thumbnail_path,
              name: `${build.id}_thumb.jpg`,
              type: 'image/jpeg'
            }
          : undefined,
        (p) => setUploadProgress(p.fraction)
      )

      if (!uploadResult.success || !uploadResult.media_url) {
        appAlert('Upload failed', uploadResult.error ?? 'Could not upload clip.')
        return
      }

      void analyticsApi.trackEvent({
        event_type: 'clip_uploaded_for_post',
        metadata: { clip_id: build.clip_id, platform }
      })

      let scheduleTime: Date
      if (postNow) {
        scheduleTime = new Date()
        scheduleTime.setMinutes(scheduleTime.getMinutes() + 1)
      } else {
        scheduleTime = new Date(scheduledAt)
        if (!isValidScheduleTime(scheduleTime)) {
          appAlert('Invalid time', 'Schedule at least 5 minutes in the future.')
          return
        }
      }

      const mediaType = platform === 'instagram' || platform === 'tiktok' ? 'reel' : 'video'

      if (platform === 'tokend' && postingContext === 'personal' && postNow) {
        const { tokendApi } = await import('@/services/api')
        const publish = await tokendApi.publish({
          account_id: accountId,
          media_url: uploadResult.media_url,
          thumbnail_url: uploadResult.thumbnail_url,
          caption: caption.trim() || undefined,
          media_type: mediaType
        })
        if (!publish.success) {
          appAlert('Publish failed', publish.message ?? publish.error ?? 'Failed to publish to Tokend')
          return
        }
        void analyticsApi.trackEvent({
          event_type: 'post_scheduled',
          metadata: { platform, provider: 'tokend', immediate: true }
        })
        appAlert('Published', 'Clip published to Tokend.')
        onClose()
        router.replace('/(tabs)/profile?sheet=posts')
        return
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
              campaign_id: postingContext === 'campaign' ? (campaignId ?? undefined) : undefined
            })
      })

      if (!response.success) {
        const message = response.error ?? 'Failed to schedule post'
        if (message.toLowerCase().includes('subscription') || message.includes('403')) {
          appAlert('Subscription required', 'Scheduling requires an active subscription.')
        } else {
          appAlert('Schedule failed', message)
        }
        return
      }

      void analyticsApi.trackEvent({
        event_type: 'post_scheduled',
        metadata: { platform, post_id: response.post?.id }
      })

      appAlert('Scheduled', postNow ? 'Post is publishing soon.' : 'Post scheduled successfully.', [
        {
          text: 'View posts',
          onPress: () => {
            onClose()
            router.replace('/(tabs)/profile?sheet=posts')
          }
        },
        { text: 'OK', onPress: onClose }
      ])
    } catch (error) {
      appAlert('Error', error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const contextOptions = useMemo(() => {
    const options: PostingContext[] = ['personal', 'organization']
    if (canAccessCampaigns && myCampaigns.length > 0) options.push('campaign')
    return options
  }, [canAccessCampaigns, myCampaigns.length])

  useEffect(() => {
    if (postingContext === 'campaign' && (!canAccessCampaigns || myCampaigns.length === 0)) {
      setPostingContext('personal')
      setCampaignId(null)
    }
  }, [canAccessCampaigns, myCampaigns.length, postingContext])

  const contextLabel: Record<PostingContext, string> = {
    personal: 'Personal',
    organization: 'Organization',
    campaign: 'Campaign'
  }

  const durationLabel = build?.duration ? `${Math.round(build.duration)}s` : null
  const subtitleParts = [clipName, durationLabel].filter(Boolean)

  if (!visible) return null

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={submitting ? () => undefined : step > 0 ? () => setStep(step === 2 ? 1 : 0) : onClose}
        variant="page"
        title={['Post destinations', 'Caption & timing', 'Review post'][step]}
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
                title: submitting
                  ? 'Publishing…'
                  : step === 0
                    ? 'Continue'
                    : step === 1
                      ? 'Review post'
                      : postNow
                        ? 'Publish now'
                        : 'Schedule post',
                onPress: advance,
                disabled:
                  submitting ||
                  !accountId ||
                  (postingContext !== 'personal' && !orgId) ||
                  (postingContext === 'campaign' && (!canAccessCampaigns || !campaignId))
              }
        }
        secondaryAction={
          step > 0
            ? {
                title: step === 2 ? 'Edit caption' : 'Back',
                onPress: () => setStep(step === 2 ? 1 : 0),
                disabled: submitting,
                variant: 'ghost'
              }
            : undefined
        }
      >
        <View className="flex-row gap-2" accessibilityLabel={`Step ${step + 1} of 3`}>
          {['Destinations', 'Caption & timing', 'Review'].map((label, index) => (
            <View key={label} className="flex-1 gap-2">
              <View className={`h-1 rounded-full ${index <= step ? 'bg-accent' : 'bg-border'}`} />
              <Text className={`text-[11px] ${index === step ? 'text-foreground' : 'text-muted'}`}>{label}</Text>
            </View>
          ))}
        </View>
        {loading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={tokens.colors.accent} />
          </View>
        ) : (
          <View pointerEvents={submitting ? 'none' : 'auto'} className="gap-[17px]">
            {step === 0 ? (
              <>
                {aspectRatios.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2">
                    {aspectRatios.map((ratio) => (
                      <View key={ratio} className="rounded-md border border-accent/40 bg-accent/15 px-2.5 py-1">
                        <Text className="text-xs font-semibold text-accent">{ratio}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Post For</Text>
                  <View className="flex-row gap-1.5 rounded-lg border border-border bg-white/5 p-1">
                    {contextOptions.map((ctx) => {
                      const active = postingContext === ctx
                      return (
                        <Pressable
                          key={ctx}
                          onPress={() => setPostingContext(ctx)}
                          className={`flex-1 items-center rounded-md px-2 py-2.5 ${active ? 'bg-surface' : ''}`}
                        >
                          <Text className={`text-[13px] font-medium ${active ? 'text-accent' : 'text-muted'}`}>
                            {contextLabel[ctx]}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>

                {postingContext !== 'personal' && organizations.length > 0 ? (
                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">Organization</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {organizations.map((org) => {
                        const active = orgId === org.id
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
                        )
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
                          const active = creatorProfileId === profile.id
                          return (
                            <Pressable
                              key={profile.id}
                              onPress={() => setCreatorProfileId(profile.id)}
                              className={`rounded-md border px-3 py-2 ${
                                active ? 'border-accent bg-accent/10' : 'border-border bg-white/5'
                              }`}
                            >
                              <Text className={active ? 'text-accent' : 'text-foreground'}>{profile.name}</Text>
                            </Pressable>
                          )
                        })}
                    </View>
                  </View>
                ) : null}

                {postingContext === 'campaign' && myCampaigns.length > 0 ? (
                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">Campaign</Text>
                    <View className="gap-2">
                      {myCampaigns.map((campaign) => {
                        const active = campaignId === campaign.id
                        return (
                          <Pressable
                            key={campaign.id}
                            onPress={() => setCampaignId(campaign.id)}
                            className={`rounded-md border px-3 py-2.5 ${
                              active ? 'border-accent bg-accent/10' : 'border-border bg-white/5'
                            }`}
                          >
                            <Text className={active ? 'text-sm font-medium text-accent' : 'text-sm text-foreground'}>
                              {campaign.title}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>
                ) : null}

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Platforms</Text>
                  <View className="flex-row flex-wrap gap-2.5">
                    {availablePlatforms.map((p) => {
                      const active = platform === p.id
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
                          <Text className={`text-[13px] ${active ? 'font-medium text-accent' : 'text-foreground'}`}>
                            {p.name}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                  {aspectWarning ? (
                    <Text className="text-xs text-warning">
                      {selectedPlatform?.name} works best with {selectedPlatform?.preferredAspectRatio} clips.
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
                      const active = accountId === account.id
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
                      )
                    })
                  )}
                </View>

                <MenuRow
                  icon="link-outline"
                  title="Connected accounts"
                  subtitle="Add or reconnect a destination"
                  onPress={() => setShowAccountsSheet(true)}
                />
              </>
            ) : null}
            {step === 1 ? (
              <>
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

                <Tabs
                  items={[
                    { key: 'now', label: 'Post now' },
                    { key: 'schedule', label: 'Schedule' }
                  ]}
                  value={postNow ? 'now' : 'schedule'}
                  onChange={(value) => setPostNow(value === 'now')}
                />

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

                <Text className="rounded-xl bg-surface p-4 text-sm leading-5 text-muted">
                  You can review your destination before publishing.
                </Text>
              </>
            ) : null}
            {step === 2 ? (
              <>
                {build?.thumbnail_path ? (
                  <Image
                    source={{ uri: build.thumbnail_path }}
                    className="h-[180px] w-full rounded-[14px] bg-surface"
                    resizeMode="cover"
                  />
                ) : null}
                <Text className="self-start rounded-[7px] bg-surfaceMuted px-2 py-[5px] text-[11px] text-success">
                  {postNow ? 'Ready to publish' : 'Ready to schedule'}
                </Text>
                <MenuRow
                  icon="person-outline"
                  title="Posting as"
                  subtitle={
                    postingContext === 'personal'
                      ? 'Personal'
                      : (organizations.find((org) => org.id === orgId)?.name ?? 'Organization')
                  }
                  onPress={() => setStep(0)}
                />
                <MenuRow
                  icon="send-outline"
                  title="Destination"
                  subtitle={`${selectedPlatform?.name ?? platform} · @${platformAccounts.find((account) => account.id === accountId)?.username ?? ''}`}
                  onPress={() => setStep(0)}
                />
                <MenuRow
                  icon="calendar-outline"
                  title="Scheduled for"
                  subtitle={postNow ? 'Publishing now' : formatScheduleLabel(scheduledAt)}
                  onPress={() => setStep(1)}
                />
                {caption ? <Text className="text-sm leading-[21px] text-muted">{caption}</Text> : null}
              </>
            ) : null}

            {submitting && uploadProgress > 0 && uploadProgress < 1 ? (
              <View className="rounded-lg border border-border bg-white/5 px-4 py-3">
                <Text className="text-sm text-foreground">Uploading... {Math.round(uploadProgress * 100)}%</Text>
                <View className="mt-2 h-2 overflow-hidden rounded bg-border">
                  <View className="h-full bg-accent" style={{ width: `${Math.round(uploadProgress * 100)}%` }} />
                </View>
              </View>
            ) : null}
          </View>
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
          setShowAccountsSheet(false)
          if (orgId && postingContext !== 'personal') {
            void userSocialApi.listOrgAccounts(orgId, platform as SocialPlatform).then((response) => {
              setOrgAccounts(response.social_accounts ?? response.accounts ?? [])
            })
          } else {
            void userSocialApi.listAccounts().then((response) => {
              setAccounts(response.social_accounts ?? response.accounts ?? [])
            })
          }
        }}
      />
    </>
  )
}

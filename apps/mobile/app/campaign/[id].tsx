import type { Campaign, CampaignSubmission } from '@clippster/api-client'
import { getPlatformDisplayName } from '@clippster/api-client'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { MenuRow } from '@/components/navigation/MenuRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { ScreenHeader } from '@/components/ScreenHeader'
import { CampaignAccessGate } from '@/components/campaign/CampaignAccessGate'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { analyticsApi, campaignApi } from '@/services/api'
import { tokens } from '@/theme/tokens'
import { appAlert } from '@/lib/appAlert'
import { campaignDeadlineLabel, campaignPaymentLabel } from '@/lib/campaignPresentation'
import { SectionCard } from '@/components/ui/SectionCard'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function CampaignDetailScreen() {
  return (
    <CampaignAccessGate>
      <CampaignDetailContent />
    </CampaignAccessGate>
  )
}

function CampaignDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const campaignId = Number(id)
  const insets = useSafeAreaInsets()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [participation, setParticipation] = useState<{ status: string } | null>(null)
  const [submissions, setSubmissions] = useState<CampaignSubmission[]>([])
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [guidelinesOpen, setGuidelinesOpen] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<CampaignSubmission | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [applicationNote, setApplicationNote] = useState('')

  const load = useCallback(async () => {
    const [detail, subs] = await Promise.all([
      campaignApi.getCampaign(campaignId),
      campaignApi.listMySubmissions(campaignId)
    ])
    if (!detail.success || !detail.campaign) throw new Error('Campaign could not be loaded.')
    if (detail.success && detail.campaign) {
      setCampaign(detail.campaign)
      setParticipation(detail.participation ?? null)
    }
    if (subs.success) {
      setSubmissions(subs.submissions)
    }
  }, [campaignId])

  useEffect(() => {
    void (async () => {
      try {
        await load()
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Could not load campaign.')
      } finally {
        setLoading(false)
      }
    })()
  }, [load])

  async function handleJoin() {
    setJoining(true)
    try {
      const response = await campaignApi.applyToCampaign(
        campaignId,
        campaign?.join_type === 'application_required' ? applicationNote : undefined
      )
      if (response.success) {
        void analyticsApi.trackEvent({
          event_type: 'campaign_joined',
          metadata: { campaign_id: campaignId }
        })
        appAlert('Success', response.message ?? 'You have joined this campaign.')
        await load()
      } else {
        appAlert('Error', response.error ?? 'Failed to join campaign')
      }
    } catch (error) {
      appAlert('Unable to join', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setJoining(false)
    }
  }

  if (!loading && !campaign)
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Campaign" showBack />
        <EmptyState
          icon="AlertCircle"
          title="Campaign unavailable"
          subtitle={loadError ?? 'This campaign is no longer available.'}
        />
        <Button
          title="Try again"
          onPress={() => {
            setLoading(true)
            void load()
              .catch((error) => setLoadError(String(error)))
              .finally(() => setLoading(false))
          }}
        />
      </View>
    )

  if (loading || !campaign) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    )
  }

  const isJoined = participation?.status === 'approved' || participation?.status === 'pending'
  const isApproved = participation?.status === 'approved'

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Campaign details" showBack />
      <ScrollView contentContainerClassName="gap-[17px] px-5 py-4 pb-10">
        {campaign.cover_image_url ? (
          <Image source={{ uri: campaign.cover_image_url }} className="aspect-video w-full rounded-[18px]" />
        ) : null}

        <View className="gap-3">
          <Text className="text-muted">{campaign.organization?.name}</Text>
          <Text className="text-[24px] font-bold text-foreground">{campaign.title}</Text>
          <Card className="flex-row gap-4">
            <View className="flex-1 gap-1">
              <Text className="text-[18px] font-semibold text-foreground">{campaignPaymentLabel(campaign)}</Text>
              <Text className="text-xs text-muted">Campaign reward</Text>
            </View>
            <View className="flex-1 gap-1 border-l border-border pl-4">
              <Text className="text-sm font-semibold text-foreground">{campaignDeadlineLabel(campaign)}</Text>
              <Text className="text-xs text-muted">Deadline</Text>
            </View>
          </Card>
          <Text className="text-sm leading-[21px] text-muted">{campaign.description}</Text>
        </View>
        <SectionCard title="Requirements">
          <MenuRow
            icon="Globe"
            title={campaign.allowed_platforms.map(getPlatformDisplayName).join(', ')}
            subtitle="Allowed platforms"
            onPress={() => setGuidelinesOpen(true)}
          />
          {campaign.require_watermark ? (
            <MenuRow icon="Droplets" title="Include campaign watermark" onPress={() => setResourcesOpen(true)} />
          ) : null}
          {campaign.require_intro ? (
            <MenuRow icon="Video" title="Include campaign intro" onPress={() => setResourcesOpen(true)} />
          ) : null}
          {campaign.require_outro ? (
            <MenuRow icon="Video" title="Include campaign outro" onPress={() => setResourcesOpen(true)} />
          ) : null}
        </SectionCard>

        <SectionCard>
          {campaign.resources?.length ? (
            <MenuRow
              icon="FolderOpen"
              title="Brand assets & resources"
              subtitle="Campaign footage and creative brief"
              onPress={() => setResourcesOpen(true)}
            />
          ) : null}
          <MenuRow icon="FileText" title="Submission guidelines" onPress={() => setGuidelinesOpen(true)} />
        </SectionCard>

        {!isJoined && campaign.join_type === 'application_required' ? (
          <Card className="gap-3">
            {campaign.join_type === 'application_required' ? (
              <Input
                value={applicationNote}
                onChangeText={setApplicationNote}
                placeholder="Application note (optional)"
                multiline
              />
            ) : null}
          </Card>
        ) : null}

        {submissions.length > 0 ? (
          <Card className="gap-3">
            <Text className="font-semibold text-foreground">My submissions</Text>
            {submissions.map((sub) => (
              <View key={sub.id} className="gap-1 border-b border-border pb-2">
                <MenuRow
                  icon="Video"
                  title={getPlatformDisplayName(sub.platform)}
                  subtitle={sub.status}
                  onPress={() => setSelectedSubmission(sub)}
                />
                <Text className="text-foreground capitalize">{sub.status}</Text>
                <Text className="text-sm text-muted">{getPlatformDisplayName(sub.platform)}</Text>
                {sub.rejection_reason ? <Text className="text-sm text-red-400">{sub.rejection_reason}</Text> : null}
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
      <View className="border-t border-border px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <Button
          title={
            joining
              ? 'Joining…'
              : isApproved
                ? 'Submit clip'
                : participation?.status === 'pending'
                  ? 'Application pending approval'
                  : campaign.join_type === 'application_required'
                    ? 'Apply to campaign'
                    : 'Join campaign'
          }
          variant="accent"
          disabled={joining || participation?.status === 'pending'}
          onPress={() => (isApproved ? router.push(`/campaign/${campaignId}/submit`) : void handleJoin())}
        />
      </View>
      <BottomSheet
        visible={guidelinesOpen}
        onClose={() => setGuidelinesOpen(false)}
        variant="page"
        title="Submission guidelines"
      >
        <Text className="text-lg font-semibold text-foreground">{campaign.title}</Text>
        <Text className="text-sm leading-[21px] text-muted">
          {campaign.description ?? 'Review the campaign resources before submitting your clip.'}
        </Text>
        <Card className="gap-3">
          <Text className="text-sm text-foreground">
            Platforms: {campaign.allowed_platforms.map(getPlatformDisplayName).join(', ')}
          </Text>
          <Text className="text-sm text-foreground">Reward: {campaignPaymentLabel(campaign)}</Text>
          {campaign.min_views_for_payment > 0 ? (
            <Text className="text-sm text-muted">
              Minimum views for payment: {campaign.min_views_for_payment.toLocaleString()}
            </Text>
          ) : null}
          <Text className="text-sm text-muted">Deadline: {campaignDeadlineLabel(campaign)}</Text>
        </Card>
      </BottomSheet>
      <BottomSheet
        visible={resourcesOpen}
        onClose={() => setResourcesOpen(false)}
        variant="page"
        title="Campaign resources"
      >
        {(campaign.resources ?? []).map((resource, index) => (
          <MenuRow
            key={resource.id ?? index}
            icon={resource.resource_type === 'video' ? 'Video' : 'FileText'}
            title={resource.title ?? resource.resource_type}
            subtitle={resource.description ?? undefined}
            onPress={() => {
              if (!resource.url || !/^https?:\/\//i.test(resource.url)) {
                appAlert('Resource unavailable', 'This resource does not have a supported link.')
                return
              }
              void WebBrowser.openBrowserAsync(resource.url).catch(() =>
                appAlert('Unable to open resource', 'Please try again.')
              )
            }}
          />
        ))}
        <Text className="text-sm leading-[21px] text-muted">
          Review these resources before creating your submission.
        </Text>
      </BottomSheet>
      <BottomSheet
        visible={selectedSubmission != null}
        onClose={() => setSelectedSubmission(null)}
        variant="page"
        title="Submission status"
        primaryAction={{ title: 'Back to campaign', onPress: () => setSelectedSubmission(null) }}
      >
        {campaign.cover_image_url ? (
          <Image source={{ uri: campaign.cover_image_url }} className="aspect-video w-full rounded-[18px]" />
        ) : null}
        <Text className="self-start rounded-lg bg-surfaceMuted px-3 py-2 text-sm font-semibold capitalize text-foreground">
          {selectedSubmission?.status}
        </Text>
        <Text className="text-sm text-muted">
          {selectedSubmission ? getPlatformDisplayName(selectedSubmission.platform) : ''}
        </Text>
        <Card>
          <Text className={selectedSubmission?.rejection_reason ? 'text-destructive' : 'text-muted'}>
            {selectedSubmission?.rejection_reason ??
              (selectedSubmission?.status === 'pending'
                ? 'Your submission was received. The organization will review your clip.'
                : 'Follow your submission status here.')}
          </Text>
        </Card>
      </BottomSheet>
    </View>
  )
}

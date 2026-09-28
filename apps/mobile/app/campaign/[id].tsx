import type { Campaign, CampaignSubmission } from '@clippster/api-client';
import { formatCpm, getPlatformDisplayName } from '@clippster/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { MenuRow } from '@/components/navigation/MenuRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { CampaignAccessGate } from '@/components/campaign/CampaignAccessGate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { analyticsApi, campaignApi } from '@/services/api';
import { tokens } from '@/theme/tokens';
import { appAlert } from '@/lib/appAlert';

export default function CampaignDetailScreen() {
  return (
    <CampaignAccessGate>
      <CampaignDetailContent />
    </CampaignAccessGate>
  );
}

function CampaignDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(id);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [participation, setParticipation] = useState<{ status: string } | null>(null);
  const [submissions, setSubmissions] = useState<CampaignSubmission[]>([]);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<CampaignSubmission | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [applicationNote, setApplicationNote] = useState('');

  const load = useCallback(async () => {
    const [detail, subs] = await Promise.all([
      campaignApi.getCampaign(campaignId),
      campaignApi.listMySubmissions(campaignId),
    ]);
    if (!detail.success || !detail.campaign) throw new Error('Campaign could not be loaded.');
    if (detail.success && detail.campaign) {
      setCampaign(detail.campaign);
      setParticipation(detail.participation ?? null);
    }
    if (subs.success) {
      setSubmissions(subs.submissions);
    }
  }, [campaignId]);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Could not load campaign.');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function handleJoin() {
    setJoining(true);
    try {
      const response = await campaignApi.applyToCampaign(
        campaignId,
        campaign?.join_type === 'application_required' ? applicationNote : undefined,
      );
      if (response.success) {
        void analyticsApi.trackEvent({
          event_type: 'campaign_joined',
          metadata: { campaign_id: campaignId },
        });
        appAlert('Success', response.message ?? 'You have joined this campaign.');
        await load();
      } else {
        appAlert('Error', response.error ?? 'Failed to join campaign');
      }
    } catch (error) {
      appAlert('Unable to join', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setJoining(false);
    }
  }

  if (!loading && !campaign) return <View className="flex-1 bg-background"><AppHeader title="Campaign" showBack /><EmptyState icon="alert-circle-outline" title="Campaign unavailable" subtitle={loadError ?? 'This campaign is no longer available.'} /><Button title="Try again" onPress={() => {setLoading(true); void load().catch(error => setLoadError(String(error))).finally(() => setLoading(false));}} /></View>;

  if (loading || !campaign) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  const isJoined = participation?.status === 'approved' || participation?.status === 'pending';
  const isApproved = participation?.status === 'approved';

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={campaign.title} showBack />
      <ScrollView contentContainerClassName="gap-[17px] px-5 py-4 pb-10">
        {campaign.cover_image_url ? (
          <Image source={{ uri: campaign.cover_image_url }} className="aspect-video w-full rounded-[18px]" />
        ) : null}

        <Card className="gap-2">
          <Text className="text-lg font-semibold text-foreground">{campaign.title}</Text>
          <Text className="text-muted">{campaign.organization?.name}</Text>
          <Text className="text-foreground">{campaign.description}</Text>
          <Text className="text-sm text-muted">{formatCpm(campaign.cpm)}</Text>
          <Text className="text-sm text-muted">
            Platforms: {campaign.allowed_platforms.map(getPlatformDisplayName).join(', ')}
          </Text>
          {campaign.require_watermark ? (
            <Text className="text-sm text-warning">Watermark required for submissions</Text>
          ) : null}
        </Card>

        {campaign.resources?.length ? <MenuRow icon="folder-open-outline" title="Resources" subtitle="Campaign footage and creative brief" onPress={() => setResourcesOpen(true)} /> : null}

        {!isJoined ? (
          <Card className="gap-3">
            {campaign.join_type === 'application_required' ? (
              <Input
                value={applicationNote}
                onChangeText={setApplicationNote}
                placeholder="Application note (optional)"
                multiline
              />
            ) : null}
            <Button title={joining ? 'Joining...' : 'Join campaign'} disabled={joining} onPress={handleJoin} />
          </Card>
        ) : participation?.status === 'pending' ? (
          <Card>
            <Text className="text-warning">Application pending approval</Text>
          </Card>
        ) : isApproved ? (
          <Button title="Submit clip" onPress={() => router.push(`/campaign/${campaignId}/submit`)} />
        ) : null}

        {submissions.length > 0 ? (
          <Card className="gap-3">
            <Text className="font-semibold text-foreground">My submissions</Text>
            {submissions.map((sub) => (
              <View key={sub.id} className="gap-1 border-b border-border pb-2">
                <MenuRow icon="videocam-outline" title={getPlatformDisplayName(sub.platform)} subtitle={sub.status} onPress={() => setSelectedSubmission(sub)} />
                <Text className="text-foreground capitalize">{sub.status}</Text>
                <Text className="text-sm text-muted">{getPlatformDisplayName(sub.platform)}</Text>
                {sub.rejection_reason ? (
                  <Text className="text-sm text-red-400">{sub.rejection_reason}</Text>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
      <BottomSheet visible={resourcesOpen} onClose={() => setResourcesOpen(false)} variant="page" title="Campaign resources">
        {(campaign.resources ?? []).map((resource, index) => <MenuRow key={resource.id ?? index} icon={resource.resource_type === 'video' ? 'videocam-outline' : 'document-text-outline'} title={resource.title ?? resource.resource_type} subtitle={resource.description ?? undefined} onPress={() => {
          if (!resource.url || !/^https?:\/\//i.test(resource.url)) { appAlert('Resource unavailable', 'This resource does not have a supported link.'); return; }
          void WebBrowser.openBrowserAsync(resource.url).catch(() => appAlert('Unable to open resource', 'Please try again.'));
        }} />)}
        <Text className="text-sm leading-[21px] text-muted">Review these resources before creating your submission.</Text>
      </BottomSheet>
      <BottomSheet visible={selectedSubmission != null} onClose={() => setSelectedSubmission(null)} variant="page" title="Submission status" primaryAction={{title:'Back to campaign',onPress:()=>setSelectedSubmission(null)}}>
        {campaign.cover_image_url ? <Image source={{uri:campaign.cover_image_url}} className="aspect-video w-full rounded-[18px]" /> : null}
        <Text className="self-start rounded-lg bg-surfaceMuted px-3 py-2 text-sm font-semibold capitalize text-foreground">{selectedSubmission?.status}</Text>
        <Text className="text-sm text-muted">{selectedSubmission ? getPlatformDisplayName(selectedSubmission.platform) : ''}</Text>
        <Card><Text className={selectedSubmission?.rejection_reason ? 'text-destructive' : 'text-muted'}>{selectedSubmission?.rejection_reason ?? (selectedSubmission?.status === 'pending' ? 'Your submission was received. The organization will review your clip.' : 'Follow your submission status here.')}</Text></Card>
      </BottomSheet>
    </View>
  );
}

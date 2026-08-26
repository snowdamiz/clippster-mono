import type { Campaign, CampaignSubmission } from '@clippster/api-client';
import { formatCpm, getPlatformDisplayName } from '@clippster/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { analyticsApi, campaignApi } from '@/services/api';
import { tokens } from '@/theme/tokens';

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(id);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [participation, setParticipation] = useState<{ status: string } | null>(null);
  const [submissions, setSubmissions] = useState<CampaignSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [applicationNote, setApplicationNote] = useState('');

  const load = useCallback(async () => {
    const [detail, subs] = await Promise.all([
      campaignApi.getCampaign(campaignId),
      campaignApi.listMySubmissions(campaignId),
    ]);
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
        Alert.alert('Success', response.message ?? 'You have joined this campaign.');
        await load();
      } else {
        Alert.alert('Error', response.error ?? 'Failed to join campaign');
      }
    } finally {
      setJoining(false);
    }
  }

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
      <ScrollView contentContainerClassName="gap-4 px-4 py-4 pb-10">
        {campaign.cover_image_url ? (
          <Image source={{ uri: campaign.cover_image_url }} className="h-40 w-full rounded-xl" />
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

        {campaign.resources && campaign.resources.length > 0 ? (
          <Card className="gap-2">
            <Text className="font-semibold text-foreground">Resources</Text>
            {campaign.resources.map((resource, index) => (
              <View key={resource.id ?? index}>
                <Text className="text-foreground">{resource.title ?? resource.resource_type}</Text>
                {resource.description ? (
                  <Text className="text-sm text-muted">{resource.description}</Text>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

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
    </View>
  );
}

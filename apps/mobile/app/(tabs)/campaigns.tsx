import type { Campaign, EarningsSummary } from '@clippster/api-client';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CampaignCard } from '@/components/campaign/CampaignCard';
import { CampaignAccessGate } from '@/components/campaign/CampaignAccessGate';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/tabs';
import { campaignApi } from '@/services/api';
import { tokens } from '@/theme/tokens';

type ViewMode = 'browse' | 'mine';

export default function CampaignsScreen() {
  return (
    <CampaignAccessGate>
      <CampaignsContent />
    </CampaignAccessGate>
  );
}

function CampaignsContent() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('browse');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCampaigns = useCallback(async () => {
    try {
    const response =
      mode === 'browse'
        ? await campaignApi.listActiveCampaigns()
        : await campaignApi.listMyCampaigns();
    if (!response.success) throw new Error('Could not load campaigns.');
    if (response.success) {
      setCampaigns(response.campaigns);
    }
    if (mode === 'mine') {
      const earningsResponse = await campaignApi.getMyEarnings();
      if (earningsResponse.success) {
        setEarnings(earningsResponse.summary);
      }
    } else {
      setEarnings(null);
    }
    setLoadError(null);
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load campaigns.'); }
  }, [mode]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadCampaigns();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCampaigns]);

  async function refresh() {
    setRefreshing(true);
    try {
      await loadCampaigns();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Campaigns" />
      <View className="px-5 py-[17px]"><Tabs items={[{key:"browse",label:"Marketplace"},{key:"mine",label:"My campaigns"}]} value={mode} onChange={(value) => setMode(value as ViewMode)} /></View>

      {loadError ? <Text className="px-5 py-3 text-sm text-destructive">{loadError} Pull down to retry.</Text> : null}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="gap-[17px] px-5 pb-8"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListHeaderComponent={
            mode === 'mine' && earnings ? (
              <Card className="mb-1 gap-1">
                <Text className="font-semibold text-foreground">Earnings</Text>
                <Text className="text-[32px] font-bold text-foreground">${earnings.total_earned}</Text>
                <Text className="text-muted">Pending: ${earnings.pending}</Text>
                <Text className="text-sm text-muted">
                  {earnings.verified_submissions}/{earnings.total_submissions} verified submissions
                </Text>
              </Card>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="trophy-outline"
              title={mode === 'browse' ? 'No campaigns' : 'No joined campaigns'}
              subtitle={
                mode === 'browse'
                  ? 'Check back later for new marketplace campaigns.'
                  : 'Join a campaign from the marketplace to get started.'
              }
            />
          }
          renderItem={({ item }) => (
            <CampaignCard
              campaign={item}
              joined={mode === 'mine'}
              onPress={() => router.push(`/campaign/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

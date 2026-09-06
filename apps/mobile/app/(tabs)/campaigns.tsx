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
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { campaignApi } from '@/services/api';
import { tokens } from '@/theme/tokens';

type ViewMode = 'browse' | 'mine';

export default function CampaignsScreen() {
  const [mode, setMode] = useState<ViewMode>('browse');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCampaigns = useCallback(async () => {
    const response =
      mode === 'browse'
        ? await campaignApi.listActiveCampaigns()
        : await campaignApi.listMyCampaigns();
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
      <View className="flex-row gap-2 px-4 py-3">
        {(['browse', 'mine'] as ViewMode[]).map((m) => (
          <FilterChip
            key={m}
            label={m === 'browse' ? 'Marketplace' : 'My campaigns'}
            selected={mode === m}
            onPress={() => setMode(m)}
            className="flex-1"
          />
        ))}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="gap-3 px-4 pb-8"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListHeaderComponent={
            mode === 'mine' && earnings ? (
              <Card className="mb-1 gap-1">
                <Text className="font-semibold text-foreground">Earnings</Text>
                <Text className="text-foreground">Earned: ${earnings.total_earned}</Text>
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

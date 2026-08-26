import type { Campaign, EarningsSummary } from '@clippster/api-client';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { CampaignCard } from '@/components/campaign/CampaignCard';
import { Card } from '@/components/ui/card';
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
      <AppHeader title="Campaigns" />
      <View className="flex-row gap-2 px-4 py-3">
        {(['browse', 'mine'] as ViewMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            className={`flex-1 rounded-lg border py-2 ${mode === m ? 'border-primary bg-primary/10' : 'border-border'}`}
          >
            <Text className={`text-center text-sm font-medium ${mode === m ? 'text-primary' : 'text-foreground'}`}>
              {m === 'browse' ? 'Marketplace' : 'My campaigns'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.primary} />
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
            <Text className="py-8 text-center text-muted">
              {mode === 'browse' ? 'No active campaigns right now.' : 'You have not joined any campaigns yet.'}
            </Text>
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

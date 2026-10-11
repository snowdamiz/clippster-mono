import {
  getPlatformDisplayName,
  type Campaign,
  type CampaignSubmission,
  type EarningsSummary
} from '@clippster/api-client'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, FlatList, RefreshControl, Text, View } from 'react-native'
import { ScreenHeader } from '@/components/ScreenHeader'
import { CampaignCard } from '@/components/campaign/CampaignCard'
import { CampaignAccessGate } from '@/components/campaign/CampaignAccessGate'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs } from '@/components/ui/tabs'
import { campaignApi } from '@/services/api'
import { tokens } from '@/theme/tokens'
import { AppIcon } from '@/components/AppIcon'

type ViewMode = 'browse' | 'mine'

export default function CampaignsScreen() {
  return (
    <CampaignAccessGate>
      <CampaignsContent />
    </CampaignAccessGate>
  )
}

function CampaignsContent() {
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>('browse')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null)
  const [submissions, setSubmissions] = useState<CampaignSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadCampaigns = useCallback(async () => {
    try {
      const response = mode === 'browse' ? await campaignApi.listActiveCampaigns() : await campaignApi.listMyCampaigns()
      if (!response.success) throw new Error('Could not load campaigns.')
      if (response.success) {
        setCampaigns(response.campaigns)
      }
      if (mode === 'mine') {
        const earningsResponse = await campaignApi.getMyEarnings()
        const submissionResponse = await campaignApi.listMySubmissions()
        if (submissionResponse.success) setSubmissions(submissionResponse.submissions)
        if (earningsResponse.success) {
          setEarnings(earningsResponse.summary)
        }
      } else {
        setEarnings(null)
      }
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load campaigns.')
    }
  }, [mode])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        await loadCampaigns()
      } finally {
        setLoading(false)
      }
    })()
  }, [loadCampaigns])

  async function refresh() {
    setRefreshing(true)
    try {
      await loadCampaigns()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Campaigns" showBack />
      <View className="px-5 py-[17px]">
        <Tabs
          items={[
            { key: 'browse', label: 'Marketplace' },
            { key: 'mine', label: 'My campaigns' }
          ]}
          value={mode}
          onChange={(value) => setMode(value as ViewMode)}
        />
      </View>

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
                <View className="mb-3 flex-row items-center gap-2">
                  <AppIcon name="CreditCard" size={23} color={tokens.colors.foreground} />
                  <Text className="font-semibold text-foreground">Earnings summary</Text>
                </View>
                <View className="flex-row">
                  <View className="flex-1 gap-1">
                    <Text className="text-[27px] font-bold text-foreground">${earnings.total_earned}</Text>
                    <Text className="text-sm text-muted">earned</Text>
                  </View>
                  <View className="flex-1 gap-1 border-l border-border pl-4">
                    <Text className="text-[27px] font-bold text-foreground">${earnings.pending}</Text>
                    <Text className="text-sm text-muted">pending</Text>
                  </View>
                </View>
                <Text className="text-sm text-muted">
                  {earnings.verified_submissions}/{earnings.total_submissions} verified submissions
                </Text>
              </Card>
            ) : null
          }
          ListFooterComponent={
            mode === 'mine' && submissions.length > 0 ? (
              <View className="gap-3 pt-4">
                <Text className="text-[17px] font-semibold text-foreground">Submissions</Text>
                <View className="rounded-[18px] border border-border bg-surface px-4">
                  {submissions.map((submission) => (
                    <Pressable
                      key={submission.id}
                      onPress={() => router.push(`/campaign/${submission.campaign_id}`)}
                      className="min-h-[80px] flex-row items-center gap-3 border-b border-border py-3"
                    >
                      <AppIcon name="Video" size={24} color={tokens.colors.muted} />
                      <View className="flex-1 gap-1">
                        <Text className="text-sm font-semibold text-foreground">
                          {submission.campaign?.title ?? getPlatformDisplayName(submission.platform)}
                        </Text>
                        <Text className="text-xs text-muted">
                          Submitted {new Date(submission.inserted_at).toLocaleDateString()}
                        </Text>
                        <Text
                          className={`text-xs ${submission.status === 'pending' ? 'text-warning' : submission.status === 'rejected' ? 'text-destructive' : 'text-success'}`}
                        >
                          {submission.status === 'pending' ? 'Pending review' : submission.status}
                        </Text>
                      </View>
                      <AppIcon name="ChevronRight" size={18} color={tokens.colors.muted} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="Megaphone"
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
              onSubmit={mode === 'mine' ? () => router.push(`/campaign/${item.id}/submit`) : undefined}
            />
          )}
        />
      )}
    </View>
  )
}

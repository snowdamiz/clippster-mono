import type { Organization, SocialPlatform, UserSocialAccount } from '@clippster/api-client'
import { getSocialPlatformLabel } from '@clippster/api-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { ConnectPlatformSheet } from '@/components/social/ConnectPlatformSheet'
import { SocialAccountCard } from '@/components/social/SocialAccountCard'
import { Tabs } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { EditorChoices } from '@/editor/panels/EditorSheet'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { DISTRIBUTION_PLATFORMS } from '@/config/distributionPlatforms'
import { useAuth } from '@/context/AuthContext'
import { appAlert } from '@/lib/appAlert'
import { canAccessTokend } from '@/lib/tokendAccess'
import { organizationsApi, userSocialApi } from '@/services/api'
import { startPostForMeOAuth } from '@/services/postForMeOAuth'
import { startPostForMeOrgOAuth } from '@/services/postForMeOrgOAuth'
import { startTokendConnect, startTokendOrgConnect } from '@/services/tokendOAuth'
import { tokens } from '@/theme/tokens'

interface AccountsSheetProps {
  visible: boolean
  onClose: () => void
}

export function AccountsSheet({ visible, onClose }: AccountsSheetProps) {
  const { user } = useAuth()
  const tokendAllowed = canAccessTokend(user)
  const [scope, setScope] = useState<'personal' | 'organization'>('personal')
  const [orgLoading, setOrgLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<UserSocialAccount[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const selectedOrgRef = useRef(selectedOrgId)
  selectedOrgRef.current = selectedOrgId
  const [orgAccounts, setOrgAccounts] = useState<UserSocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showConnect, setShowConnect] = useState(false)
  const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null)
  const [connectingOrgPlatform, setConnectingOrgPlatform] = useState<SocialPlatform | null>(null)

  const loadAccounts = useCallback(async () => {
    const response = await userSocialApi.listAccounts()
    const list = response.social_accounts ?? response.accounts ?? []
    setAccounts(tokendAllowed ? list : list.filter((account) => account.platform !== 'tokend'))

    const orgResponse = await organizationsApi.listMyOrganizations()
    if (orgResponse.success) {
      setOrganizations(orgResponse.organizations)
    }
  }, [tokendAllowed])

  const loadOrgAccounts = useCallback(
    async (orgId: number) => {
      setOrgLoading(true)
      try {
        const response = await userSocialApi.listOrgAccounts(orgId)
        if (selectedOrgRef.current !== orgId) return
        if (!response.success) throw new Error(response.error ?? 'Could not load organization accounts.')
        const list = response.social_accounts ?? response.accounts ?? []
        setOrgAccounts(tokendAllowed ? list : list.filter((account) => account.platform !== 'tokend'))
      } catch (error) {
        if (selectedOrgRef.current === orgId)
          setLoadError(error instanceof Error ? error.message : 'Could not load organization accounts.')
      } finally {
        if (selectedOrgRef.current === orgId) setOrgLoading(false)
      }
    },
    [tokendAllowed]
  )

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        await loadAccounts()
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Could not load connected accounts.')
      } finally {
        setLoading(false)
      }
    })()
  }, [visible, loadAccounts])

  useEffect(() => {
    if (!visible || !selectedOrgId) return
    setLoadError(null)
    setOrgAccounts([])
    void loadOrgAccounts(selectedOrgId)
  }, [visible, selectedOrgId, loadOrgAccounts])

  async function handleConnect(platform: SocialPlatform) {
    setConnectingPlatform(platform)
    try {
      const platformConfig = DISTRIBUTION_PLATFORMS.find((p) => p.id === platform)
      const result =
        platformConfig?.provider === 'tokend' ? await startTokendConnect() : await startPostForMeOAuth(platform)
      if (result.success) {
        setShowConnect(false)
        await loadAccounts()
        appAlert('Connected', `${getSocialPlatformLabel(platform)} account linked successfully.`)
      } else {
        appAlert('Connection failed', result.error ?? 'Could not connect account.')
      }
    } catch (error) {
      appAlert('Connection failed', error instanceof Error ? error.message : 'Could not connect account.')
    } finally {
      setConnectingPlatform(null)
    }
  }

  function handleDisconnect(accountId: number) {
    appAlert('Disconnect account', 'Remove this social account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const response = await userSocialApi.disconnectAccount(accountId)
            if (response.success) await loadAccounts()
            else appAlert('Error', response.error ?? 'Failed to disconnect')
          })()
        }
      }
    ])
  }

  async function handleOrgConnect(platform: SocialPlatform) {
    if (!selectedOrgId) return
    setConnectingOrgPlatform(platform)
    try {
      const platformConfig = DISTRIBUTION_PLATFORMS.find((p) => p.id === platform)
      const result =
        platformConfig?.provider === 'tokend'
          ? await startTokendOrgConnect(selectedOrgId)
          : await startPostForMeOrgOAuth(selectedOrgId, platform)
      if (result.success) {
        setShowConnect(false)
        await loadOrgAccounts(selectedOrgId)
        appAlert('Connected', `Organization ${getSocialPlatformLabel(platform)} account linked.`)
      } else {
        appAlert('Connection failed', result.error ?? 'Could not connect org account.')
      }
    } catch (error) {
      appAlert('Connection failed', error instanceof Error ? error.message : 'Could not connect organization account.')
    } finally {
      setConnectingOrgPlatform(null)
    }
  }

  function handleOrgDisconnect(accountId: number) {
    if (!selectedOrgId) return
    appAlert('Disconnect account', 'Remove this organization social account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const response = await userSocialApi.disconnectOrgAccount(selectedOrgId, accountId)
            if (response.success) await loadOrgAccounts(selectedOrgId)
            else appAlert('Error', response.error ?? 'Failed to disconnect')
          })()
        }
      }
    ])
  }

  if (!visible) return null

  const orgMode = scope === 'organization'
  const connectBusy = !!connectingPlatform || !!connectingOrgPlatform

  const displayedAccounts = orgMode ? orgAccounts : accounts
  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        variant="page"
        title="Connected accounts"
        primaryAction={{
          title: orgMode ? 'Connect organization account' : 'Connect account',
          onPress: () => setShowConnect(true),
          disabled: connectBusy || loading || (orgMode && (orgLoading || !selectedOrgId))
        }}
      >
        <Tabs
          items={[
            { key: 'personal', label: 'Personal' },
            { key: 'organization', label: 'Organization' }
          ]}
          value={scope}
          onChange={(next) => {
            if (connectBusy) return
            setScope(next as 'personal' | 'organization')
            setLoadError(null)
            if (next === 'organization' && !selectedOrgId) setSelectedOrgId(organizations[0]?.id ?? null)
          }}
        />
        {orgMode && organizations.length > 0 ? (
          <>
            <Text className="text-xs font-semibold text-foreground">Organization</Text>
            <EditorChoices
              options={organizations.map((org) => ({ value: String(org.id), label: org.name }))}
              value={String(selectedOrgId)}
              onChange={(id) => {
                if (!connectBusy) setSelectedOrgId(Number(id))
              }}
            />
          </>
        ) : null}
        {loading || (orgMode && orgLoading) ? (
          <ActivityIndicator color={tokens.colors.accent} />
        ) : loadError ? (
          <View className="gap-3">
            <Text className="text-sm text-destructive">{loadError}</Text>
            <Button
              title="Try again"
              variant="outline"
              onPress={() => {
                setLoadError(null)
                void (orgMode && selectedOrgId ? loadOrgAccounts(selectedOrgId) : loadAccounts()).catch((error) =>
                  setLoadError(error instanceof Error ? error.message : 'Could not load accounts.')
                )
              }}
            />
          </View>
        ) : orgMode && !organizations.length ? (
          <EmptyState
            icon="business-outline"
            title="No organization yet"
            subtitle="Organization channels appear here when you join a workspace."
          />
        ) : !displayedAccounts.length ? (
          <EmptyState
            icon="link-outline"
            title="Connect your channels"
            subtitle={
              orgMode
                ? 'Connect a channel to publish for this organization.'
                : 'Link Instagram, TikTok, YouTube, or X to publish your clips.'
            }
          />
        ) : (
          <View className="rounded-[18px] bg-surface px-4">
            {displayedAccounts.map((account) => (
              <SocialAccountCard
                key={account.id}
                account={account}
                onDisconnect={orgMode ? handleOrgDisconnect : handleDisconnect}
                onReconnect={() => {
                  if (orgMode) void handleOrgConnect(account.platform as SocialPlatform)
                  else void handleConnect(account.platform as SocialPlatform)
                }}
              />
            ))}
          </View>
        )}
        {orgMode && selectedOrgId ? (
          <Text className="text-sm text-muted">
            You’re managing channels for {organizations.find((org) => org.id === selectedOrgId)?.name}.
          </Text>
        ) : null}
      </BottomSheet>
      <ConnectPlatformSheet
        visible={showConnect}
        connectingPlatform={connectingPlatform ?? connectingOrgPlatform}
        includeTokend={tokendAllowed}
        onClose={() => setShowConnect(false)}
        onConnect={(platform) => {
          if (orgMode) void handleOrgConnect(platform)
          else void handleConnect(platform)
        }}
      />
    </>
  )
}

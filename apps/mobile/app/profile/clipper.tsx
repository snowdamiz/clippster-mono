import type { ChannelLink, ClipperProfile, PortfolioClip } from '@clippster/api-client';
import {
  CHANNEL_PLATFORMS,
  COMMON_TIMEZONES,
  CONTENT_STYLE_TAGS,
  EXPERIENCE_LEVELS,
  LANGUAGES,
  PREFERRED_PLATFORMS,
  SPECIALTY_TAGS,
  getPlatformLabel,
} from '@clippster/api-client';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AccountSettingsPanel, CreditsRow } from '@/components/account/AccountSettingsPanel';
import { PublicProfileLinkRow } from '@/components/profile/PublicProfileLinkRow';
import { SettingRow } from '@/components/profile/SettingRow';
import { formatTimezoneLabel, SingleSelectChips, TagSelect } from '@/components/profile/TagSelect';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { clipperProfilesApi } from '@/services/api';
import { getCompletedClipBuilds } from '@/services/database/clips';
import { tokens } from '@/theme/tokens';

type Tab = 'edit' | 'channels' | 'portfolio';
type MainSection = 'clipper' | 'account';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ClipperProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('edit');
  const [mainSection, setMainSection] = useState<MainSection>('clipper');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [specialtyTags, setSpecialtyTags] = useState<string[]>([]);
  const [contentStyleTags, setContentStyleTags] = useState<string[]>([]);
  const [preferredPlatforms, setPreferredPlatforms] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [timezone, setTimezone] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [lookingForWork, setLookingForWork] = useState(false);
  const [channelLinks, setChannelLinks] = useState<ChannelLink[]>([]);
  const [portfolioClips, setPortfolioClips] = useState<PortfolioClip[]>([]);
  const [newLinkPlatform, setNewLinkPlatform] = useState('tiktok');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkUsername, setNewLinkUsername] = useState('');

  const loadProfile = useCallback(async () => {
    const response = await clipperProfilesApi.getMyProfile();
    if (!response.success || !response.profile) {
      setProfile(null);
      return;
    }
    const p = response.profile;
    setProfile(p);
    setDisplayName(p.display_name ?? '');
    setBio(p.bio ?? '');
    setExperienceLevel(p.experience_level ?? '');
    setSpecialtyTags(p.specialty_tags ?? []);
    setContentStyleTags(p.content_style_tags ?? []);
    setPreferredPlatforms(p.preferred_platforms ?? []);
    setLanguages(p.languages ?? []);
    setTimezone(p.timezone ?? COMMON_TIMEZONES[0]);
    setIsPublic(p.is_public);
    setLookingForWork(p.looking_for_work);
    setChannelLinks(p.channel_links ?? []);
    setPortfolioClips(p.portfolio_clips ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadProfile();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProfile]);

  async function refresh() {
    setRefreshing(true);
    try {
      await loadProfile();
    } finally {
      setRefreshing(false);
    }
  }

  async function saveVisibility(value: boolean) {
    setIsPublic(value);
    const response = await clipperProfilesApi.updateMyProfile({ is_public: value });
    if (response.success) {
      await loadProfile();
    } else {
      Alert.alert('Error', response.error ?? 'Failed to update visibility');
      setIsPublic(!value);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const response = await clipperProfilesApi.updateMyProfile({
        display_name: displayName.trim() || null,
        bio: bio.trim().slice(0, 500) || null,
        experience_level: experienceLevel || null,
        specialty_tags: specialtyTags,
        content_style_tags: contentStyleTags,
        preferred_platforms: preferredPlatforms,
        languages,
        timezone: timezone || null,
        is_public: isPublic,
        looking_for_work: lookingForWork,
      });
      if (response.success) {
        Alert.alert('Saved', 'Your clipper profile has been updated.');
        await loadProfile();
      } else {
        Alert.alert('Error', response.error ?? 'Failed to save profile');
      }
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const response = await clipperProfilesApi.uploadAvatar({
      uri: asset.uri,
      name: asset.name ?? 'avatar.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    });
    if (response.success) {
      await loadProfile();
    } else {
      Alert.alert('Upload failed', response.error ?? 'Could not upload avatar');
    }
  }

  async function addChannelLink() {
    if (!newLinkUrl.trim()) {
      Alert.alert('URL required', 'Enter a channel URL.');
      return;
    }
    const response = await clipperProfilesApi.createChannelLink({
      platform: newLinkPlatform,
      url: newLinkUrl.trim(),
      username: newLinkUsername.trim() || undefined,
    });
    if (response.success) {
      setNewLinkUrl('');
      setNewLinkUsername('');
      await loadProfile();
    } else {
      Alert.alert('Error', response.error ?? 'Failed to add channel link');
    }
  }

  async function deleteLink(id: number) {
    await clipperProfilesApi.deleteChannelLink(id);
    await loadProfile();
  }

  async function uploadPortfolioFromDevice() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const response = await clipperProfilesApi.uploadPortfolioClip({
      uri: asset.uri,
      name: asset.name ?? 'portfolio.mp4',
      type: asset.mimeType ?? 'video/mp4',
    });
    if (response.success) {
      await loadProfile();
    } else {
      Alert.alert('Upload failed', response.error ?? 'Could not upload portfolio clip');
    }
  }

  async function addPortfolioFromExport() {
    const builds = await getCompletedClipBuilds(20);
    if (builds.length === 0) {
      Alert.alert('No exports', 'Export a clip first from a project.');
      return;
    }
    const build = builds[0];
    const response = await clipperProfilesApi.uploadPortfolioClip({
      uri: build.file_path,
      name: `export_${build.id}.mp4`,
      type: 'video/mp4',
    });
    if (response.success) {
      await loadProfile();
    } else {
      Alert.alert('Upload failed', response.error ?? 'Could not add export to portfolio');
    }
  }

  async function deletePortfolio(id: number) {
    await clipperProfilesApi.deletePortfolioClip(id);
    await loadProfile();
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Clipper profile" subtitle="Portfolio & campaigns" showBack />
        <ScrollView contentContainerClassName="gap-4 px-4 py-4 pb-10">
          <Card className="items-center gap-3 py-6">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-surfaceMuted">
              <Ionicons name="person" size={28} color={tokens.colors.muted} />
            </View>
            <Text className="text-center text-lg font-semibold text-foreground">Create your clipper profile</Text>
            <Text className="text-center text-muted">
              Build your public portfolio so organizations can discover your work.
            </Text>
            <Button
              title="Get started"
              onPress={() => {
                setProfile({
                  id: 0,
                  user_id: 0,
                  display_name: null,
                  bio: null,
                  avatar_url: null,
                  slug: null,
                  is_public: true,
                  looking_for_work: false,
                  experience_level: null,
                  specialty_tags: [],
                  content_style_tags: [],
                  preferred_platforms: [],
                  languages: [],
                  timezone: null,
                  response_time_hours: null,
                  is_verified: false,
                  total_campaigns_completed: 0,
                  total_clips_delivered: 0,
                  total_endorsements: 0,
                  channel_links: [],
                  portfolio_clips: [],
                  badges: [],
                  is_affiliate: false,
                  inserted_at: '',
                  updated_at: '',
                });
              }}
            />
          </Card>
          <CreditsRow />
          <AccountSettingsPanel />
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Clipper profile" subtitle="Portfolio & campaigns" showBack />
      <ScrollView
        contentContainerClassName="gap-4 px-4 py-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Card className="overflow-hidden p-0">
          <View className="h-[3px] bg-accent" />
          <View className="flex-row items-center gap-4 p-4">
            <Pressable onPress={uploadAvatar}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} className="h-16 w-16 rounded-full" />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-full bg-surfaceMuted">
                  <Ionicons name="person" size={28} color={tokens.colors.muted} />
                </View>
              )}
            </Pressable>
            <View className="flex-1 gap-0.5">
              <Text className="text-lg font-semibold text-foreground">{displayName || user?.name || 'Your name'}</Text>
              <Text className="text-sm text-muted">{user?.email ?? ''}</Text>
              {profile.slug ? <PublicProfileLinkRow slug={profile.slug} /> : null}
            </View>
          </View>
        </Card>

        <CreditsRow />

        <SettingRow
          title={isPublic ? 'Profile is public' : 'Profile is private'}
          description={
            isPublic
              ? 'Organizations can find you in the directory'
              : 'Only you can see your profile'
          }
          value={isPublic}
          onValueChange={(value) => void saveVisibility(value)}
          icon={
            <Ionicons
              name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
              size={20}
              color={isPublic ? tokens.colors.accent : tokens.colors.muted}
            />
          }
        />

        <Tabs
          items={[
            { key: 'clipper', label: 'Clipper profile' },
            { key: 'account', label: 'Settings' },
          ]}
          value={mainSection}
          onChange={(key) => setMainSection(key as MainSection)}
        />

        {mainSection === 'clipper' ? (
          <>
            <Card className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Portfolio stats</Text>
              <View className="flex-row justify-between">
                <Text className="text-muted">Clips delivered</Text>
                <Text className="text-foreground">{profile.total_clips_delivered}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted">Endorsements</Text>
                <Text className="text-foreground">{profile.total_endorsements}</Text>
              </View>
            </Card>

            <Tabs
              items={[
                { key: 'edit', label: 'Edit' },
                { key: 'channels', label: 'Channels' },
                { key: 'portfolio', label: 'Portfolio' },
              ]}
              value={tab}
              onChange={(key) => setTab(key as Tab)}
            />
          </>
        ) : (
          <AccountSettingsPanel />
        )}

        {mainSection === 'clipper' && tab === 'edit' ? (
          <View className="gap-4">
            <Card className="gap-4 p-4">
              <Text className="text-lg font-semibold text-foreground">About you</Text>
              <View className="gap-2">
                <Label>Display name</Label>
                <Input value={displayName} onChangeText={setDisplayName} placeholder="Your clipper name" />
              </View>
              <View className="gap-2">
                <Label>Bio</Label>
                <Input
                  value={bio}
                  onChangeText={(t) => setBio(t.slice(0, 500))}
                  placeholder="Tell organizations about your style, niche, and what makes your edits stand out..."
                  multiline
                  className="min-h-28"
                />
                <Text className="text-right text-xs text-muted">{bio.length}/500</Text>
              </View>
            </Card>

            <Card className="gap-5 p-4">
              <Text className="text-lg font-semibold text-foreground">Skills & experience</Text>
              <SingleSelectChips
                label="Experience level"
                description="How long you've been clipping professionally."
                options={EXPERIENCE_LEVELS}
                value={experienceLevel}
                onChange={setExperienceLevel}
              />
              <Separator />
              <TagSelect
                label="Specialties"
                description="What types of content you clip most often."
                options={SPECIALTY_TAGS}
                selected={specialtyTags}
                onChange={setSpecialtyTags}
              />
              <Separator />
              <TagSelect
                label="Content style"
                description="Your editing approach — pick everything that applies."
                options={CONTENT_STYLE_TAGS}
                selected={contentStyleTags}
                onChange={setContentStyleTags}
              />
            </Card>

            <Card className="gap-5 p-4">
              <Text className="text-lg font-semibold text-foreground">Platforms & languages</Text>
              <TagSelect
                label="Preferred platforms"
                description="Where you typically deliver finished clips."
                options={PREFERRED_PLATFORMS}
                selected={preferredPlatforms}
                onChange={setPreferredPlatforms}
              />
              <Separator />
              <TagSelect
                label="Languages"
                description="Languages you can clip or subtitle in."
                options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
                selected={languages}
                onChange={setLanguages}
                searchable
              />
              <Separator />
              <SingleSelectChips
                label="Timezone"
                description="Your primary working timezone."
                options={COMMON_TIMEZONES.map((tz) => ({ value: tz, label: formatTimezoneLabel(tz) }))}
                value={timezone}
                onChange={setTimezone}
              />
            </Card>

            <Card className="gap-4 p-4">
              <Text className="text-lg font-semibold text-foreground">Availability</Text>
              <SettingRow
                title="Looking for work"
                description="Show organizations that you're open to new campaigns."
                value={lookingForWork}
                onValueChange={setLookingForWork}
                icon={<Ionicons name="briefcase-outline" size={20} color={tokens.colors.primary} />}
              />
              <Button title={saving ? 'Saving...' : 'Save profile'} disabled={saving} onPress={saveProfile} />
            </Card>
          </View>
        ) : null}

        {mainSection === 'clipper' && tab === 'channels' ? (
          <Card className="gap-4">
            {channelLinks.map((link) => (
              <View key={link.id} className="flex-row items-center justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-medium text-foreground">{getPlatformLabel(link.platform)}</Text>
                  <Text className="text-sm text-muted" numberOfLines={1}>
                    {link.username ? `@${link.username}` : link.url}
                  </Text>
                </View>
                <Pressable onPress={() => deleteLink(link.id)}>
                  <Ionicons name="trash-outline" size={20} color={tokens.colors.destructive} />
                </Pressable>
              </View>
            ))}
            <Separator />
            <Text className="font-semibold text-foreground">Add channel link</Text>
            <View className="flex-row flex-wrap gap-2">
              {CHANNEL_PLATFORMS.map((p) => (
                <Pressable
                  key={p.value}
                  onPress={() => setNewLinkPlatform(p.value)}
                  className={`rounded-full border px-3 py-1 ${newLinkPlatform === p.value ? 'border-primary' : 'border-border'}`}
                >
                  <Text className={newLinkPlatform === p.value ? 'text-primary' : 'text-foreground'}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
            <Input value={newLinkUrl} onChangeText={setNewLinkUrl} placeholder="https://..." autoCapitalize="none" />
            <Input value={newLinkUsername} onChangeText={setNewLinkUsername} placeholder="Username (optional)" />
            <Button title="Add link" variant="outline" onPress={addChannelLink} />
          </Card>
        ) : null}

        {mainSection === 'clipper' && tab === 'portfolio' ? (
          <Card className="gap-4">
            {portfolioClips.map((clip) => (
              <View key={clip.id} className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-medium text-foreground">{clip.title ?? `Clip #${clip.id}`}</Text>
                  {clip.duration ? (
                    <Text className="text-sm text-muted">{Math.round(clip.duration)}s</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => deletePortfolio(clip.id)}>
                  <Ionicons name="trash-outline" size={20} color={tokens.colors.destructive} />
                </Pressable>
              </View>
            ))}
            <Button title="Upload from camera roll" variant="outline" onPress={uploadPortfolioFromDevice} />
            <Button title="Add from latest export" variant="outline" onPress={addPortfolioFromExport} />
            {profile.slug ? (
              <Button
                title="Preview public profile"
                variant="ghost"
                onPress={() => router.push(`/profile/preview?slug=${profile.slug}`)}
              />
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

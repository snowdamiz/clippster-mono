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
  Switch,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { TagSelect } from '@/components/profile/TagSelect';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { clipperProfilesApi } from '@/services/api';
import { getCompletedClipBuilds } from '@/services/database/clips';
import { tokens } from '@/theme/tokens';

type Tab = 'edit' | 'channels' | 'portfolio';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<ClipperProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('edit');
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
        <AppHeader title="Clipper Profile" />
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-lg font-semibold text-foreground">Create your clipper profile</Text>
          <Text className="text-center text-muted">
            Set up your public profile to join campaigns and get discovered by organizations.
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
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Clipper Profile" />
      <ScrollView
        contentContainerClassName="gap-4 px-4 py-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Card className="items-center gap-3">
          <Pressable onPress={uploadAvatar}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} className="h-24 w-24 rounded-full" />
            ) : (
              <View className="h-24 w-24 items-center justify-center rounded-full bg-surfaceMuted">
                <Ionicons name="camera" size={32} color={tokens.colors.muted} />
              </View>
            )}
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">{displayName || 'Your name'}</Text>
          {!isPublic ? (
            <Text className="rounded-full bg-surfaceMuted px-3 py-1 text-xs text-muted">Private profile</Text>
          ) : null}
          {profile.slug ? (
            <Text className="text-sm text-muted">clippster.app/clippers/{profile.slug}</Text>
          ) : null}
        </Card>

        <Card className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Stats</Text>
          <View className="flex-row justify-between">
            <Text className="text-muted">Campaigns completed</Text>
            <Text className="text-foreground">{profile.total_campaigns_completed}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted">Clips delivered</Text>
            <Text className="text-foreground">{profile.total_clips_delivered}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted">Endorsements</Text>
            <Text className="text-foreground">{profile.total_endorsements}</Text>
          </View>
        </Card>

        <View className="flex-row gap-2">
          {(['edit', 'channels', 'portfolio'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className={`flex-1 rounded-lg border px-3 py-2 ${tab === t ? 'border-primary bg-primary/10' : 'border-border'}`}
            >
              <Text className={`text-center text-sm capitalize ${tab === t ? 'text-primary' : 'text-foreground'}`}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'edit' ? (
          <Card className="gap-4">
            <View className="gap-2">
              <Label>Display name</Label>
              <Input value={displayName} onChangeText={setDisplayName} placeholder="Your clipper name" />
            </View>
            <View className="gap-2">
              <Label>Bio ({bio.length}/500)</Label>
              <Input
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, 500))}
                placeholder="Tell organizations about your style..."
                multiline
                className="min-h-24"
              />
            </View>
            <View className="gap-2">
              <Label>Experience level</Label>
              <View className="flex-row flex-wrap gap-2">
                {EXPERIENCE_LEVELS.map((level) => (
                  <Pressable
                    key={level.value}
                    onPress={() => setExperienceLevel(level.value)}
                    className={`rounded-full border px-3 py-1.5 ${experienceLevel === level.value ? 'border-primary bg-primary/20' : 'border-border'}`}
                  >
                    <Text className={experienceLevel === level.value ? 'text-primary' : 'text-foreground'}>
                      {level.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <TagSelect label="Specialties" options={SPECIALTY_TAGS} selected={specialtyTags} onChange={setSpecialtyTags} />
            <TagSelect
              label="Content style"
              options={CONTENT_STYLE_TAGS}
              selected={contentStyleTags}
              onChange={setContentStyleTags}
            />
            <TagSelect
              label="Preferred platforms"
              options={PREFERRED_PLATFORMS}
              selected={preferredPlatforms}
              onChange={setPreferredPlatforms}
            />
            <TagSelect
              label="Languages"
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
              selected={languages}
              onChange={setLanguages}
            />
            <View className="gap-2">
              <Label>Timezone</Label>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {COMMON_TIMEZONES.map((tz) => (
                    <Pressable
                      key={tz}
                      onPress={() => setTimezone(tz)}
                      className={`rounded-full border px-3 py-1.5 ${timezone === tz ? 'border-primary bg-primary/20' : 'border-border'}`}
                    >
                      <Text className={timezone === tz ? 'text-primary' : 'text-foreground'}>{tz}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground">Public profile</Text>
              <Switch value={isPublic} onValueChange={setIsPublic} />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground">Looking for work</Text>
              <Switch value={lookingForWork} onValueChange={setLookingForWork} />
            </View>
            <Button title={saving ? 'Saving...' : 'Save profile'} disabled={saving} onPress={saveProfile} />
          </Card>
        ) : null}

        {tab === 'channels' ? (
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

        {tab === 'portfolio' ? (
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

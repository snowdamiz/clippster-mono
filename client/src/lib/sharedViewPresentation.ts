import { computed, markRaw } from 'vue';
import { Building2, Folder, List, Paintbrush, Users } from 'lucide-vue-next';
import type { CreatorCardLiveState } from '@/components/creators/CreatorCard.vue';

// Both runtimes supply reactive view models; presentation belongs in the shared view.
type ViewModel = Record<string, any>;
const qualityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
const frameRateOptions = [
  { value: 30, label: '30 FPS' },
  { value: 60, label: '60 FPS' },
];
const outputFormatOptions = [
  { value: 'mp4', label: 'MP4' },
  { value: 'mov', label: 'MOV' },
];
const aspectRatioOptions = [
  { value: '16:9', platforms: 'YouTube · Twitch', width: 64, height: 36 },
  { value: '9:16', platforms: 'TikTok · Reels', width: 24, height: 42 },
  { value: '1:1', platforms: 'Instagram feed', width: 38, height: 38 },
  { value: '4:5', platforms: 'Instagram post', width: 32, height: 40 },
];

export function buildViewPresentation(model: ViewModel) {
  return {
    qualityOptions,
    frameRateOptions,
    outputFormatOptions,
    ratioOptions: aspectRatioOptions.map((option) => ({
      ...option,
      ratio: option.value,
      original: option.value === '16:9',
    })),
    footerSummary: computed(() => {
      const count =
        model.currentStep === 'platforms' ? model.selectedRatios.length : model.totalBuildsCount;
      if (!count) return '';
      if (model.currentStep === 'platforms')
        return `${count} format${count > 1 ? 's' : ''} selected`;
      return model.currentStep === 'addons'
        ? `${count} build${count !== 1 ? 's' : ''} will be created`
        : '';
    }),
  };
}

export function quickPublishPresentation(model: ViewModel) {
  const assets = (list: ViewModel[], current: ViewModel | null) => {
    const options = [...list];
    if (current && !options.some((item) => item.id === current.id)) options.unshift(current);
    return options.map((item) => ({
      id: item.id,
      name: item.name,
      tag: item.isOrgAsset ? item.organization_name || 'Org' : null,
      trailing: model.formatDuration(item.duration || 0),
    }));
  };
  return {
    qualityOptions,
    frameRateOptions,
    outputFormatOptions,
    aspectRatioOptions,
    introOptions: computed(() => assets(model.intros, model.selectedIntro)),
    outroOptions: computed(() => assets(model.outros, model.selectedOutro)),
    onIntroChange: (id: string | number | null) =>
      model.selectIntro(model.intros.find((item: ViewModel) => item.id === id) ?? null),
    onOutroChange: (id: string | number | null) =>
      model.selectOutro(model.outros.find((item: ViewModel) => item.id === id) ?? null),
  };
}

export function publishStepPresentation(model: ViewModel) {
  return {
    ratioOptions: computed(() =>
      (model.selectedRatios || []).map((value: string) => ({ value, label: value }))
    ),
    accountGroupsFor: (platform: string) => [
      {
        label: 'Organization accounts',
        prefix: 'org',
        accounts: model.getOrgAccountsForPlatform(platform),
      },
      {
        label: 'Personal accounts',
        prefix: 'user',
        accounts: model.getPersonalAccountsForPlatform(platform),
      },
    ],
  };
}

export function clipsViewPresentation(_model: ViewModel) {
  return {
    dangerItemClass: 'text-danger focus:bg-danger-soft [&>svg]:!text-danger',
    getViralityBadgeVariant: (score: number | null | undefined) =>
      !score ? 'neutral' : score >= 90 ? 'danger' : score >= 60 ? 'warning' : 'neutral',
  };
}

export function projectLibraryPresentation(model: ViewModel) {
  return {
    statusFilterOptions: [
      { label: 'All', value: 'all' },
      { label: 'Live', value: 'live', title: 'Live now' },
      { label: 'Has clips', value: 'has_clips' },
    ],
    viewModeOptions: computed(() => [
      {
        value: 'folders',
        icon: markRaw(Folder),
        title: 'Folder view',
        disabled: !!model.searchQuery || model.statusFilter === 'has_clips',
      },
      {
        value: 'list',
        icon: markRaw(List),
        title: 'List view',
        disabled: !!model.searchQuery || model.statusFilter === 'has_clips',
      },
    ]),
  };
}

export function creatorProfilesPresentation(model: ViewModel) {
  return {
    tabOptions: [
      { value: 'streamer', label: 'Streamer profiles', icon: markRaw(Users) },
      { value: 'global', label: 'Global branding', icon: markRaw(Paintbrush) },
    ],
    profileSections: computed(() => {
      const sections = [];
      if (model.organizationProfiles.length)
        sections.push({
          key: 'org',
          title: 'Organization profiles',
          icon: markRaw(Building2),
          items: model.organizationProfiles,
        });
      if (
        model.userProfiles.length ||
        (model.creators.length && model.organizationProfiles.length === model.creators.length)
      ) {
        sections.push({
          key: 'user',
          title: model.activeTab === 'global' ? 'Your global branding' : 'Your creator profiles',
          icon: markRaw(model.activeTab === 'global' ? Paintbrush : Users),
          items: model.userProfiles,
        });
      }
      return sections;
    }),
    getCardLiveState: (creator: ViewModel): CreatorCardLiveState => {
      const enabled = model.isLiveClipEnabled && model.hasMonitorableLink(creator);
      const monitored = enabled && model.isCreatorMonitored(creator);
      return {
        enabled,
        monitored,
        statusLabel: monitored ? model.getCreatorStatusLabel(creator) : '',
        checking: enabled && model.isCreatorCheckingLive(creator),
        isLive: model.isCreatorLive(creator),
        persistentRecord: model.isCreatorPersistentRecord(creator),
        persistentAutoDetect: model.isCreatorPersistentAutoDetect(creator),
        canWatch: model.canWatchCreator(creator),
        autoDvr: model.isCreatorAutoDvrEnabled(creator),
      };
    },
  };
}

export function streamVodsPresentation(model: ViewModel) {
  return {
    supportedVodPlatforms: ['pumpfun', 'kick', 'twitch', 'YouTube', 'rumble', 'twitter'],
    recentSearchName: (search: ViewModel) =>
      search.symbol ||
      search.label ||
      search.displayText ||
      model.getCleanChannelName(search.id, search.platform),
    sourceTabs: computed(() => {
      if (!(model.platformStore.clips.length || model.platformStore.loading)) return null;
      const sources: Record<string, { value: string; select: (value: string) => void }> = {
        YouTube: { value: model.youtubeTab, select: model.switchYouTubeTab },
        rumble: { value: model.rumbleTab, select: model.switchRumbleTab },
        tokend: { value: model.tokendTab, select: model.switchTokendTab },
      };
      const source = sources[model.detectedPlatform];
      return source
        ? {
            ...source,
            options: [
              {
                value: 'streams',
                label: model.detectedPlatform === 'tokend' ? 'Streams' : 'Live streams',
                disabled: model.platformStore.loading,
              },
              { value: 'videos', label: 'Videos', disabled: model.platformStore.loading },
            ],
          }
        : null;
    }),
  };
}

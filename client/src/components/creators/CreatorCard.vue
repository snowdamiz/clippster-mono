<script setup lang="ts">
  /**
   * Creator profile card for the "My creators" grid: avatar, name,
   * description, platform chips, branding indicators, live status and the
   * live-monitoring actions. All behavior is emitted to the page.
   */
  import { computed } from 'vue';
  import {
    Building2,
    Disc,
    Download,
    Edit,
    Eye,
    EyeOff,
    HardDrive,
    Image as ImageIcon,
    Link,
    Loader2,
    MoreHorizontal,
    Play,
    SkipForward,
    Sparkles,
    Square,
    Trash2,
    Video,
  } from 'lucide-vue-next';
  import { Avatar } from '@/components/ui/avatar';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import type { CreatorProfileWithLinks } from '@/services/database';
  import { PlatformLogo } from '@/components/ui/platform-logo';

  export interface CreatorCardLiveState {
    /** Live-clip feature is on and the creator has a monitorable link. */
    enabled: boolean;
    monitored: boolean;
    statusLabel: string;
    checking: boolean;
    isLive: boolean;
    persistentRecord: boolean;
    persistentAutoDetect: boolean;
    canWatch: boolean;
    autoDvr: boolean;
  }

  const props = defineProps<{
    creator: CreatorProfileWithLinks & { isOrgProfile?: boolean; disabled?: boolean | number };
    imageUrl?: string;
    live: CreatorCardLiveState;
  }>();

  const emit = defineEmits<{
    viewVods: [];
    download: [];
    edit: [];
    submitPost: [];
    toggleAutoDvr: [];
    toggleDisabled: [];
    delete: [];
    record: [];
    autoDetect: [];
    stop: [];
    watch: [];
  }>();


  const visibleLinks = computed(() => props.creator.platform_links.slice(0, 4));
  const extraLinks = computed(() => Math.max(0, props.creator.platform_links.length - 4));

  const branding = computed(() => [
    { key: 'intro', icon: Play, on: !!props.creator.intro_id, label: 'Intro' },
    { key: 'outro', icon: SkipForward, on: !!props.creator.outro_id, label: 'Outro' },
    { key: 'watermark', icon: ImageIcon, on: !!props.creator.watermark_id, label: 'Watermark' },
  ]);
</script>

<template>
  <article
    class="@container group/card flex min-w-0 flex-col rounded-xl border border-line-subtle bg-surface p-3.5 transition-colors hover:border-line"
    :class="{ 'opacity-60': creator.disabled }"
  >
    <!-- Identity -->
    <div class="flex items-start gap-3">
      <div class="relative shrink-0">
        <Avatar :src="imageUrl" :name="creator.name" size="md" />
        <span
          v-if="live.isLive || live.monitored"
          class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[var(--surface)]"
          :class="live.isLive ? 'bg-live' : 'bg-brand'"
        />
      </div>

      <div class="min-w-0 flex-1">
        <h3 class="truncate text-sm font-semibold text-fg" :title="creator.name">{{ creator.name }}</h3>
        <p class="truncate text-xs text-fg-muted" :title="creator.description || undefined">
          {{ creator.description || 'No description' }}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon-sm" class="-mr-1.5 -mt-1" title="More actions" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuItem @select="emit('viewVods')"><Video /> View VODs</DropdownMenuItem>
          <DropdownMenuItem @select="emit('download')"><Download /> Download VOD</DropdownMenuItem>
          <DropdownMenuItem v-if="!creator.isOrgProfile" @select="emit('edit')"><Edit /> Edit profile</DropdownMenuItem>
          <DropdownMenuItem v-if="creator.isOrgProfile && creator.organization_id" @select="emit('submitPost')">
            <Link /> Submit post link
          </DropdownMenuItem>
          <template v-if="live.enabled">
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="emit('toggleAutoDvr')">
              <HardDrive /> Auto DVR
              <Badge :variant="live.autoDvr ? 'success' : 'neutral'" class="ml-auto">{{ live.autoDvr ? 'On' : 'Off' }}</Badge>
            </DropdownMenuItem>
          </template>
          <template v-if="!creator.isOrgProfile">
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="emit('toggleDisabled')">
              <component :is="creator.disabled ? Eye : EyeOff" />
              {{ creator.disabled ? 'Enable profile' : 'Disable profile' }}
            </DropdownMenuItem>
            <DropdownMenuItem class="text-danger focus:bg-danger-soft [&>svg]:!text-danger" @select="emit('delete')">
              <Trash2 /> Delete creator
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- Labels -->
    <div
      v-if="creator.isOrgProfile || creator.scope === 'personal_studio' || creator.disabled"
      class="mt-2.5 flex min-w-0 flex-wrap items-center gap-1"
    >
      <Badge v-if="creator.isOrgProfile" class="max-w-full" :title="`Managed by ${creator.organization_name}`">
        <Building2 />
        <span class="truncate">{{ creator.organization_name }}</span>
      </Badge>
      <Badge v-if="creator.scope === 'personal_studio'" variant="brand" title="Personal profile for Clippster Studio">
        <Disc /> Studio
      </Badge>
      <Badge v-if="creator.disabled" variant="outline">Disabled</Badge>
    </div>

    <!-- Platforms + branding -->
    <div class="mt-3 flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-1">
        <template v-if="creator.platform_links.length > 0">
          <PlatformLogo
            v-for="link in visibleLinks"
            :key="link.id"
            :platform="link.platform"
            size="sm"
            :title="link.display_name || link.platform_id"
          />
          <span v-if="extraLinks > 0" class="tabular px-1 text-2xs text-fg-subtle">+{{ extraLinks }}</span>
        </template>
        <span v-else class="flex items-center gap-1 text-xs text-fg-subtle">
          <Link class="size-3" />
          No platforms
        </span>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <component
          :is="item.icon"
          v-for="item in branding"
          :key="item.key"
          class="size-3.5"
          :class="item.on ? 'text-fg-muted' : 'text-fg-disabled opacity-50'"
          :title="item.on ? `${item.label} configured` : `No ${item.label.toLowerCase()}`"
        />
      </div>
    </div>

    <!-- Live monitoring -->
    <footer v-if="live.enabled" class="mt-3 flex items-center justify-between gap-2 border-t border-line-subtle pt-3">
      <div class="min-w-0">
        <Badge v-if="live.monitored" variant="brand" class="max-w-full">
          <span class="size-1.5 shrink-0 animate-pulse rounded-full bg-brand" />
          <span class="truncate">{{ live.statusLabel }}</span>
        </Badge>
        <span v-else-if="live.checking" class="flex items-center gap-1.5 text-xs text-fg-subtle">
          <Loader2 class="size-3 animate-spin" /> Checking…
        </span>
        <Badge v-else-if="live.isLive" variant="live">Live</Badge>
        <span v-else class="flex items-center gap-1.5 text-xs text-fg-subtle">
          <span class="size-1.5 rounded-full bg-fg-disabled" /> Offline
        </span>
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <template v-if="!live.monitored">
          <Button
            size="xs"
            :variant="live.persistentRecord ? 'destructive-soft' : 'subtle'"
            title="Auto-record when live"
            @click.stop="emit('record')"
          >
            <span class="size-1.5 rounded-full bg-[var(--danger)]" />
            Rec
          </Button>
          <Button
            size="xs"
            variant="subtle"
            :class="live.persistentAutoDetect && 'bg-ai-soft text-ai hover:bg-ai-soft'"
            title="Auto-detect clips for 60 min when live"
            @click.stop="emit('autoDetect')"
          >
            <Sparkles />
            Auto
          </Button>
        </template>
        <Button v-else size="xs" variant="destructive-soft" title="Stop monitoring" @click.stop="emit('stop')">
          <Square />
          Stop
        </Button>
        <Button
          size="xs"
          variant="ghost"
          :disabled="!live.canWatch"
          :title="live.canWatch ? 'Watch live' : 'Watch becomes available when live'"
          aria-label="Watch live"
          @click.stop="emit('watch')"
        >
          <Eye />
          <span class="hidden @min-[17rem]:inline">Watch</span>
        </Button>
      </div>
    </footer>
  </article>
</template>

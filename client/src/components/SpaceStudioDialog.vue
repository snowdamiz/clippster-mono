<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open && audio" class="space-studio__overlay" @click.self="emit('close')">
        <div class="space-studio space-studio--x">
          <Transition name="space-spotlight">
            <div
              v-if="spotlightSpeaker"
              class="space-studio__spotlight-overlay"
              @click.self="dismissSpotlight"
            >
              <div class="space-studio__spotlight-card">
                <button class="space-studio__spotlight-close" @click="dismissSpotlight" title="Dismiss spotlight">
                  <X :size="18" />
                </button>
                <div class="space-studio__spotlight-avatar-wrap">
                  <img
                    v-if="avatarImageSrc(spotlightSpeaker.avatarUrl)"
                    :src="avatarImageSrc(spotlightSpeaker.avatarUrl)"
                    :alt="spotlightSpeaker.name"
                    class="space-studio__spotlight-avatar"
                    @error="
                      () => {
                        const id = spotlightSpeaker?.id;
                        if (id) void refetchSpeakerAvatar(id);
                      }
                    "
                  />
                  <div
                    v-else
                    class="space-studio__spotlight-avatar space-studio__avatar-fallback space-studio__avatar-fallback--xl"
                  >
                    {{ avatarInitial(spotlightSpeaker.name) }}
                  </div>
                </div>
                <div class="space-studio__spotlight-name">{{ spotlightSpeaker.name }}</div>
                <div class="space-studio__spotlight-role">
                  {{ spotlightSpeaker.role === 'host'
                    ? 'Host'
                    : spotlightSpeaker.role === 'listener'
                      ? 'Listener'
                      : 'Speaker' }}
                </div>
                <div class="space-studio__spotlight-hint">
                  This speaker will be featured on top of your exported clip.
                </div>
              </div>
            </div>
          </Transition>
          <header class="space-studio__header space-studio__header--x">
            <button
              class="space-studio__close space-studio__close--x"
              type="button"
              @click="emit('close')"
              title="Close"
            >
              <X :size="18" />
            </button>
            <div class="space-studio__x-head">
              <div class="space-studio__x-rec-row">
                <span class="space-studio__rec-pill" aria-hidden="true">
                  <span class="space-studio__rec-dot"></span>
                  REC
                </span>
              </div>
              <h2 class="space-studio__title space-studio__title--x">{{ audio.title }}</h2>
              <p class="space-studio__subtitle space-studio__subtitle--x">
                {{ formatTime(duration) }}
                <span :class="{ 'space-studio__sync-ok--x': hasReliableTimeline }">
                  {{
                    hasReliableTimeline ? ' · Speaker timeline synced' : ' · Run sync for speaking detection'
                  }}
                </span>
              </p>
            </div>
          </header>

          <div class="space-studio__content space-studio__content--replay">
            <section class="space-studio__x-panel" aria-label="Participants">
              <div class="space-studio__x-toolbar">
                <span class="space-studio__x-roster-label">
                  {{ xGridParticipants.length }} in this Space
                </span>
                <label class="space-studio__appear-toggle space-studio__appear-toggle--x">
                  <input
                    type="checkbox"
                    :checked="showOnlyAppearedSpeakers"
                    @change="showOnlyAppearedSpeakers = ($event.target as HTMLInputElement).checked"
                  />
                  <span>Reveal as they join</span>
                </label>
              </div>

              <div v-if="xGridParticipants.length === 0" class="space-studio__x-empty">
                No participant roster yet. Use &quot;Sync Speakers&quot; to load it from X.
              </div>
              <div v-else class="space-studio__x-grid">
                <div
                  v-for="speaker in xGridParticipants"
                  :key="speaker.id"
                  class="space-studio__x-cell"
                  :class="{ 'space-studio__x-cell--spotlight': spotlightSpeakerId === speaker.id }"
                >
                  <button
                    type="button"
                    class="space-studio__spotlight-toggle space-studio__spotlight-toggle--x"
                    :class="{ 'space-studio__spotlight-toggle--on': spotlightSpeakerId === speaker.id }"
                    :title="spotlightSpeakerId === speaker.id ? 'Remove spotlight' : 'Spotlight for export'"
                    @click.stop="toggleSpotlight(speaker.id)"
                  >
                    <span class="space-studio__spotlight-checkbox space-studio__spotlight-checkbox--x">
                      <span v-if="spotlightSpeakerId === speaker.id" class="space-studio__spotlight-check"></span>
                    </span>
                  </button>
                  <div
                    class="space-studio__avatar-wrap space-studio__avatar-wrap--x"
                    :class="{
                      'space-studio__avatar-wrap--speaking-x': isReliableActiveSpeaker(speaker.id),
                      'space-studio__avatar-wrap--pinned-x':
                        selectedSpeakerId === speaker.id && !isReliableActiveSpeaker(speaker.id),
                      'space-studio__avatar-wrap--offstage-x':
                        speaker.role !== 'listener' &&
                        onStageUserIdsAtPlayhead !== null &&
                        !onStageUserIdsAtPlayhead.has(speaker.id),
                    }"
                    @click="selectedSpeakerId = speaker.id"
                  >
                    <img
                      v-if="avatarImageSrc(speaker.avatarUrl)"
                      :src="avatarImageSrc(speaker.avatarUrl)"
                      :alt="speaker.name"
                      class="space-studio__avatar space-studio__avatar--x"
                      @error="() => void refetchSpeakerAvatar(speaker.id)"
                    />
                    <div
                      v-else
                      class="space-studio__avatar space-studio__avatar-fallback space-studio__avatar-fallback--x"
                    >
                      {{ avatarInitial(speaker.name) }}
                    </div>
                  </div>
                  <div class="space-studio__x-name" :title="speaker.name">{{ speaker.name }}</div>
                  <div class="space-studio__x-role">{{ roleLabelX(speaker.role) }}</div>
                </div>
              </div>
            </section>

            <div class="space-studio__split space-studio__split--tools">
            <div class="space-studio__left">
              <div class="space-studio__player-wrap">
                <audio
                  ref="audioRef"
                  class="space-studio__player"
                  controls
                  :src="audioSrc"
                  @timeupdate="handleTimeUpdate"
                  @loadedmetadata="handleLoadedMetadata"
                />
              </div>

              <div class="space-studio__timeline">
                <div class="space-studio__timeline-header">
                  <span>Talking Timeline</span>
                  <span>{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
                </div>
                <div class="space-studio__timeline-legend">
                  <span><i class="space-studio__swatch space-studio__swatch--reliable"></i>Detected</span>
                  <span><i class="space-studio__swatch space-studio__swatch--estimated"></i>Unavailable / placeholder</span>
                  <span><i class="space-studio__swatch space-studio__swatch--manual"></i>Manual</span>
                </div>
                <div class="space-studio__timeline-track">
                  <div
                    v-for="segment in speakerSegments"
                    :key="segment.id"
                    class="space-studio__segment"
                    :class="[
                      { 'space-studio__segment--editable': !!selectedSpeakerId },
                      segmentToneClass(segment),
                    ]"
                    :style="segmentStyle(segment)"
                    @click="assignSegmentSpeaker(segment.id)"
                  />
                  <div class="space-studio__playhead" :style="{ left: `${playheadPercent}%` }"></div>
                </div>
                <div class="space-studio__sync-strip">
                  <span class="space-studio__sync-label">
                    Speaker clock {{ signedOffsetLabel }}
                  </span>
                  <button class="space-studio__sync-btn" @click="adjustSpeakerOffset(-5)">-5s</button>
                  <button class="space-studio__sync-btn" @click="adjustSpeakerOffset(-1)">-1s</button>
                  <button class="space-studio__sync-btn" @click="adjustSpeakerOffset(1)">+1s</button>
                  <button class="space-studio__sync-btn" @click="adjustSpeakerOffset(5)">+5s</button>
                  <button class="space-studio__sync-btn" @click="speakerTimelineOffset = 0">Reset</button>
                </div>
              </div>

              <div class="space-studio__clip-controls">
                <button class="space-studio__btn space-studio__btn--secondary" @click="setClipStart">
                  Mark Clip Start
                </button>
                <button class="space-studio__btn space-studio__btn--secondary" @click="setClipEnd">
                  Mark Clip End
                </button>
                <button class="space-studio__btn space-studio__btn--primary" @click="createManualClip">
                  Manual Clip
                </button>
                <button class="space-studio__btn space-studio__btn--primary" @click="createAiClipSuggestions">
                  AI Detect Clips
                </button>
                <button
                  class="space-studio__btn space-studio__btn--secondary"
                  :disabled="syncingSpeakers"
                  @click="syncSpeakers"
                >
                  {{ syncingSpeakers ? 'Syncing...' : 'Sync Speakers' }}
                </button>
                <button class="space-studio__btn space-studio__btn--primary" @click="openAiVideo">
                  Open in AI Video
                </button>
                <button class="space-studio__btn space-studio__btn--primary" @click="openEditorMp4">
                  Open Editor (MP4)
                </button>
              </div>

              <div class="space-studio__clip-range">
                Clip Range: {{ formatTime(clipStart) }} - {{ formatTime(clipEnd) }}
              </div>

              <div v-if="aiSuggestions.length > 0" class="space-studio__suggestions">
                <div class="space-studio__suggestions-title">AI Suggestions</div>
                <button
                  v-for="suggestion in aiSuggestions"
                  :key="suggestion.id"
                  class="space-studio__suggestion"
                  @click="seekToSuggestion(suggestion)"
                >
                  <span>{{ suggestion.label }}</span>
                  <span>{{ formatTime(suggestion.start) }} - {{ formatTime(suggestion.end) }}</span>
                </button>
              </div>
            </div>

            <div class="space-studio__right">
              <div class="space-studio__quality-row">
                <span class="space-studio__quality-badge">{{ timelineQualityLabel }}</span>
                <span class="space-studio__hint-inline">
                  Blue ring = detected speech. Purple ring = selected for timeline edits.
                </span>
              </div>

              <!-- Speakers in current clip -->
              <div class="space-studio__clip-roster">
                <div class="space-studio__section-label space-studio__section-label--row">
                  <span>Speakers in this clip <span class="space-studio__section-count">{{ speakersInClipRange.length }}</span></span>
                  <span class="space-studio__clip-roster-meta">
                    {{ formatTime(Math.min(clipStart, clipEnd)) }} – {{ formatTime(Math.max(clipStart, clipEnd)) }} · {{ clipDurationLabel }}
                  </span>
                </div>
                <div v-if="speakersInClipRange.length === 0" class="space-studio__clip-empty">
                  Move the clip range or pick a section with detected speakers.
                </div>
                <div v-else class="space-studio__clip-roster-list">
                  <button
                    v-for="speaker in speakersInClipRange"
                    :key="`clip-${speaker.id}`"
                    type="button"
                    class="space-studio__clip-chip"
                    :class="{ 'space-studio__clip-chip--spotlight': spotlightSpeakerId === speaker.id }"
                    :title="spotlightSpeakerId === speaker.id ? 'Spotlighted in clip' : 'Spotlight this speaker in the clip'"
                    @click="toggleSpotlight(speaker.id)"
                  >
                    <img
                      v-if="avatarImageSrc(speaker.avatarUrl)"
                      :src="avatarImageSrc(speaker.avatarUrl)"
                      :alt="speaker.name"
                      class="space-studio__clip-chip-avatar"
                      @error="() => void refetchSpeakerAvatar(speaker.id)"
                    />
                    <div
                      v-else
                      class="space-studio__clip-chip-avatar space-studio__avatar-fallback space-studio__avatar-fallback--sm"
                    >
                      {{ avatarInitial(speaker.name) }}
                    </div>
                    <span class="space-studio__clip-chip-name">{{ speaker.name }}</span>
                  </button>
                </div>
              </div>

              <!-- Activity feed -->
              <div v-if="timelineEventsSorted.length > 0" class="space-studio__activity-block">
                <div class="space-studio__section-label">Activity</div>
                <div class="space-studio__activity-list">
                  <button
                    v-for="ev in timelineEventsSorted"
                    :key="ev.id"
                    type="button"
                    class="space-studio__activity-row"
                    @click="seekToTime(ev.t)"
                  >
                    <span class="space-studio__activity-time">{{ formatTime(ev.t) }}</span>
                    <span class="space-studio__activity-body">{{ formatTimelineEvent(ev) }}</span>
                  </button>
                </div>
              </div>

            </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { convertFileSrc } from '@tauri-apps/api/core';
import { X } from 'lucide-vue-next';
import type {
  DownloadedAudio,
  SpaceParticipant,
  SpaceSpeakerSegment,
  SpaceSpeakerSegmentSource,
  SpaceStageSnapshot,
  SpaceTimelineEvent,
} from '@/services/database/types';
import {
  getDownloadedSpaceMetadata,
  parseSpaceParticipants,
  parseSpaceSpeakerSegments,
  parseSpaceStageSnapshots,
  parseSpaceTimelineEvents,
  upsertDownloadedSpaceMetadata,
} from '@/services/database/downloaded-space-metadata';
import {
  extractSpaceSpeakerTimelineFromHls,
  getTwitterBroadcastInfo,
  getTwitterUserAvatar,
  hydrateTwitterProfileImageUrl,
  resolveTwitterUserByRestId,
} from '@/services/twitter';
import {
  activeSpeakersAtTime,
  buildSpaceTimelineEventsPayload,
  deriveSegmentSourceFromId,
  mapSpeakerTimelineToStoredSegments,
  normalizeSpeakerSegments,
  pickDisplaySpeakerAtTime,
  sourceAllowsActiveHighlight,
  type StageJoinHintRow,
} from '@/services/spaces/space-replay-helpers';

interface Speaker {
  id: string;
  name: string;
  avatarUrl: string;
  role: SpaceParticipant['role'];
  twitterUsername?: string;
  periscopeUserId?: string;
  xRestId?: string;
  displayName?: string;
}

interface SpeakerSegment {
  id: string;
  speakerId: string;
  start: number;
  end: number;
  source?: SpaceSpeakerSegmentSource;
  periscopeUserId?: string;
  xRestId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
  role?: SpaceParticipant['role'];
}

interface ClipSuggestion {
  id: string;
  label: string;
  start: number;
  end: number;
}

const props = defineProps<{
  open: boolean;
  audio: DownloadedAudio | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const autoSyncedSpaceIds = new Set<string>();

const router = useRouter();
const audioRef = ref<HTMLAudioElement | null>(null);
const currentTime = ref(0);
const duration = ref(0);
const clipStart = ref(0);
const clipEnd = ref(30);
const speakerTimelineOffset = ref(0);
const aiSuggestions = ref<ClipSuggestion[]>([]);
const syncingSpeakers = ref(false);
const selectedSpeakerId = ref<string | null>(null);

const speakers = ref<Speaker[]>([]);
const speakerSegments = ref<SpeakerSegment[]>([]);
const stageSnapshots = ref<SpaceStageSnapshot[]>([]);
const timelineEvents = ref<SpaceTimelineEvent[]>([]);
const spotlightSpeakerId = ref<string | null>(null);
const showOnlyAppearedSpeakers = ref(true);

/** Normalized segments + detection helpers (aligned with DB types). */
const normalizedSegments = computed(() =>
  normalizeSpeakerSegments(
    speakerSegments.value.map((s) => ({
      id: s.id,
      speaker_id: s.speakerId,
      start: s.start,
      end: s.end,
      source: s.source ?? deriveSegmentSourceFromId(s.id),
    })),
    duration.value || 0
  )
);

const speakerLookupTime = computed(() => {
  const max = duration.value || Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(max, currentTime.value + speakerTimelineOffset.value));
});

const displayAtPlayhead = computed(() =>
  pickDisplaySpeakerAtTime(speakerLookupTime.value, normalizedSegments.value)
);

const speakingHighlightIds = computed(() => {
  const a = activeSpeakersAtTime(speakerLookupTime.value, normalizedSegments.value, duration.value || 0);
  return a.highlightSpeakerIds;
});

const estimatedHighlightIds = computed(() =>
  displayAtPlayhead.value.mode === 'estimated' && displayAtPlayhead.value.speakerId
    ? [displayAtPlayhead.value.speakerId]
    : []
);

const signedOffsetLabel = computed(() => {
  if (speakerTimelineOffset.value === 0) return '+0s';
  return `${speakerTimelineOffset.value > 0 ? '+' : ''}${speakerTimelineOffset.value.toFixed(0)}s`;
});

const hasReliableTimeline = computed(() =>
  normalizedSegments.value.some((s) =>
    sourceAllowsActiveHighlight(s.source ?? deriveSegmentSourceFromId(s.id))
  )
);

const timelineQualityLabel = computed(() => {
  const segs = normalizedSegments.value;
  if (!segs.length) return 'No timeline';
  if (segs.some((s) => (s.source ?? deriveSegmentSourceFromId(s.id)) === 'chatman_replay'))
    return 'Detection: X replay events';
  if (segs.some((s) => (s.source ?? deriveSegmentSourceFromId(s.id)) === 'periscope'))
    return 'Detection: X replay events';
  if (segs.some((s) => (s.source ?? deriveSegmentSourceFromId(s.id)) === 'hls_id3'))
    return 'Detection: HLS metadata';
  if (segs.some((s) => (s.source ?? deriveSegmentSourceFromId(s.id)) === 'manual'))
    return 'Detection: manual edits';
  if (
    segs.some((s) => {
      const src = s.source ?? deriveSegmentSourceFromId(s.id);
      return src === 'synthetic_equal' || src === 'synthetic_seed';
    })
  )
    return 'Detection: placeholder — sync speakers';
  if (segs.some((s) => (s.source ?? deriveSegmentSourceFromId(s.id)) === 'stage_join'))
    return 'Detection: stage schedule (approx.)';
  return 'Detection: unknown';
});

const timelineEventsSorted = computed(() =>
  [...timelineEvents.value].sort((a, b) => a.t - b.t)
);

/** When ID3 stage rosters exist: who is on stage at the playhead; `null` = no roster data (no dimming). */
const onStageUserIdsAtPlayhead = computed(() => {
  const snaps = stageSnapshots.value;
  if (!snaps.length) return null;
  const t = currentTime.value;
  let best: SpaceStageSnapshot | null = null;
  for (const s of snaps) {
    if (s.t <= t && (!best || s.t > best.t)) best = s;
  }
  if (!best) return null;
  return new Set(best.on_stage_user_ids);
});

// Everyone who is NOT a confirmed listener is considered on stage.
// 'unknown' and 'guest' participants come from HLS timeline data and are on-stage speakers.
const onStageParticipants = computed(() =>
  speakers.value.filter((s) => s.role !== 'listener')
);

function participantSortRank(role: Speaker['role']): number {
  if (role === 'host') return 0;
  if (role === 'cohost' || role === 'admin') return 1;
  if (role === 'speaker') return 2;
  if (role === 'guest') return 3;
  if (role === 'unknown') return 3;
  if (role === 'listener') return 5;
  return 5;
}

function roleLabelX(role: Speaker['role']): string {
  if (role === 'host') return 'Host';
  if (role === 'cohost') return 'Cohost';
  if (role === 'admin') return 'Admin';
  if (role === 'speaker') return 'Speaker';
  if (role === 'guest') return 'Guest';
  if (role === 'listener') return 'Listener';
  return 'Participant';
}

/**
 * Set of speaker ids that have already appeared on stage by `currentTime`.
 * Drives the "speakers come up as they join" X-like behavior.
 */
const appearedSpeakerIdsAtPlayhead = computed<Set<string>>(() => {
  const t = currentTime.value;
  const out = new Set<string>();

  for (const speaker of speakers.value) {
    if (speaker.role === 'host') {
      out.add(speaker.id);
    }
  }
  for (const snap of stageSnapshots.value) {
    if (snap.t <= t) {
      for (const id of snap.on_stage_user_ids) out.add(id);
    }
  }
  for (const seg of normalizedSegments.value) {
    if (seg.start <= t) out.add(seg.speaker_id);
  }
  for (const ev of timelineEvents.value) {
    if (ev.t <= t && (ev.type === 'joined_stage' || ev.type === 'speaker_changed')) {
      for (const id of ev.user_ids) out.add(id);
    }
  }

  const hasJoinSignals =
    stageSnapshots.value.length > 0 ||
    normalizedSegments.value.length > 0 ||
    timelineEvents.value.some((e) => e.type === 'joined_stage' || e.type === 'speaker_changed');

  if (!hasJoinSignals) {
    for (const speaker of speakers.value) {
      if (speaker.role !== 'listener') out.add(speaker.id);
    }
  }
  return out;
});

/** Full Space roster in X order: host → speakers → listeners, 4-column grid. */
const xGridParticipants = computed(() => {
  const appeared = appearedSpeakerIdsAtPlayhead.value;
  const filtered = speakers.value.filter((s) => {
    if (!showOnlyAppearedSpeakers.value) return true;
    return appeared.has(s.id);
  });
  return [...filtered].sort((a, b) => {
    const ra = participantSortRank(a.role);
    const rb = participantSortRank(b.role);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
});

/** Stage roster for clip fallback: on-stage participants only, host first. */
const stageSpeakers = computed<Speaker[]>(() => {
  const all = onStageParticipants.value;
  const appeared = appearedSpeakerIdsAtPlayhead.value;
  const filtered = showOnlyAppearedSpeakers.value
    ? all.filter((s) => appeared.has(s.id))
    : all;
  return [...filtered].sort((a, b) => {
    const aHost = a.role === 'host' ? 0 : 1;
    const bHost = b.role === 'host' ? 0 : 1;
    if (aHost !== bHost) return aHost - bHost;
    return a.name.localeCompare(b.name);
  });
});

const spotlightSpeaker = computed<Speaker | null>(() =>
  spotlightSpeakerId.value
    ? speakers.value.find((s) => s.id === spotlightSpeakerId.value) ?? null
    : null
);

function toggleSpotlight(speakerId: string) {
  spotlightSpeakerId.value = spotlightSpeakerId.value === speakerId ? null : speakerId;
}

function dismissSpotlight() {
  spotlightSpeakerId.value = null;
}

/** Participants whose audio actually overlaps the current clip range. */
const speakersInClipRange = computed<Speaker[]>(() => {
  const start = Math.min(clipStart.value, clipEnd.value);
  const end = Math.max(clipStart.value, clipEnd.value);
  if (end <= start) return [];

  const ids = new Set<string>();
  for (const seg of normalizedSegments.value) {
    if (seg.end > start && seg.start < end) ids.add(seg.speaker_id);
  }
  for (const snap of stageSnapshots.value) {
    if (snap.t >= start && snap.t <= end) {
      for (const id of snap.on_stage_user_ids) ids.add(id);
    }
  }
  if (ids.size === 0) {
    for (const s of stageSpeakers.value) ids.add(s.id);
  }
  const out: Speaker[] = [];
  for (const id of ids) {
    const s = speakers.value.find((x) => x.id === id);
    if (s) out.push(s);
  }
  return out.sort((a, b) => {
    const aHost = a.role === 'host' ? 0 : 1;
    const bHost = b.role === 'host' ? 0 : 1;
    if (aHost !== bHost) return aHost - bHost;
    return a.name.localeCompare(b.name);
  });
});

const clipDurationLabel = computed(() => {
  const start = Math.min(clipStart.value, clipEnd.value);
  const end = Math.max(clipStart.value, clipEnd.value);
  return formatTime(end - start);
});

const audioSrc = computed(() => {
  if (!props.audio) return '';
  return convertFileSrc(props.audio.file_path);
});

const playheadPercent = computed(() => {
  if (!duration.value) return 0;
  return Math.min(100, (currentTime.value / duration.value) * 100);
});

watch(
  () => props.open,
  async (open) => {
    if (!open || !props.audio) return;
    await initializeSpaceData();
  }
);

async function initializeSpaceData() {
  currentTime.value = 0;
  duration.value = props.audio?.duration ?? 0;
  clipStart.value = 0;
  clipEnd.value = Math.min(30, duration.value || 30);
  speakerTimelineOffset.value = 0;
  aiSuggestions.value = [];
  spotlightSpeakerId.value = null;

  const metadata = props.audio ? await getDownloadedSpaceMetadata(props.audio.id) : null;
  const savedParticipants = parseSpaceParticipants(metadata?.participants_json ?? null);
  const savedSegments = parseSpaceSpeakerSegments(metadata?.speaker_segments_json ?? null);
  stageSnapshots.value = parseSpaceStageSnapshots(metadata?.stage_snapshots_json ?? null);
  timelineEvents.value = parseSpaceTimelineEvents(metadata?.timeline_events_json ?? null);

  if (savedParticipants.length > 0) {
    speakers.value = savedParticipants.map((participant) => {
      const username =
        participant.twitter_username || extractUsernameFromParticipant(participant);
      return {
        id: participant.id,
        name: participant.name,
        role: participant.role ?? 'unknown',
        avatarUrl: sanitizeStoredAvatarUrl(participant.avatar_url),
        twitterUsername: username,
        periscopeUserId: participant.periscope_user_id,
        xRestId: participant.x_rest_id,
        displayName: participant.display_name,
      };
    });
    await hydrateAllTwimgAvatarsForSpeakers();
    await enrichMissingAvatars();
    await enrichNumericRestIdSpeakers();
    await hydrateAllTwimgAvatarsForSpeakers();
  } else {
    speakers.value = buildSpeakerGrid();
  }

  if (savedSegments.length > 0) {
    speakerSegments.value = savedSegments.map((segment) => ({
      id: segment.id,
      speakerId: segment.speaker_id,
      start: segment.start,
      end: segment.end,
      source: segment.source ?? deriveSegmentSourceFromId(segment.id),
      periscopeUserId: segment.periscope_user_id,
      xRestId: segment.x_rest_id,
      username: segment.username,
      displayName: segment.display_name,
      avatarUrl: segment.avatar_url,
      role: segment.role,
    }));
  } else {
    speakerSegments.value = [];
  }

  if (timelineEvents.value.length === 0 && speakerSegments.value.length > 0) {
    const participantsPayload: SpaceParticipant[] = speakers.value.map((s) => ({
      id: s.id,
      name: s.name,
      avatar_url: s.avatarUrl || null,
      role: s.role,
      twitter_username: s.twitterUsername,
      periscope_user_id: s.periscopeUserId,
      x_rest_id: s.xRestId,
      display_name: s.displayName,
    }));
    const segs = speakerSegments.value.map((segment) => ({
      id: segment.id,
      speaker_id: segment.speakerId,
      start: segment.start,
      end: segment.end,
      source: segment.source ?? deriveSegmentSourceFromId(segment.id),
    }));
    timelineEvents.value = buildSpaceTimelineEventsPayload(
      participantsPayload,
      stageSnapshots.value,
      normalizeSpeakerSegments(segs, duration.value || 0),
      [],
      duration.value || 0
    );
  }

  selectedSpeakerId.value =
    speakers.value.find((s) => s.role === 'host')?.id ??
    speakers.value.find((s) => s.role !== 'listener')?.id ??
    speakers.value[0]?.id ??
    null;

  if (shouldAutoSyncSpeakers()) {
    autoSyncedSpaceIds.add(props.audio!.id);
    void syncSpeakers();
  }
}

function shouldAutoSyncSpeakers(): boolean {
  if (!props.audio?.id || !props.audio.source_url || autoSyncedSpaceIds.has(props.audio.id)) return false;
  if (syncingSpeakers.value) return false;
  return !speakerSegments.value.some((segment) => {
    const source = segment.source ?? deriveSegmentSourceFromId(segment.id);
    return sourceAllowsActiveHighlight(source);
  });
}

function buildSpeakerGrid(): Speaker[] {
  return Array.from({ length: 8 }, (_, index) => {
    const number = index + 1;
    return {
      id: `speaker-${number}`,
      name: `Speaker ${number}`,
      role: 'unknown' as const,
      avatarUrl: '',
    };
  });
}

function sanitizeStoredAvatarUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim();
  if (t.includes('api.dicebear.com')) return '';
  return t;
}

/** Safe src for <img>: never synthetic Dicebear; empty means show initials. */
function avatarImageSrc(url: string | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim();
  if (!t || t.includes('api.dicebear.com')) return '';
  if (t.startsWith('data:image')) return t;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  return '';
}

function avatarInitial(name: string): string {
  const t = name.replace(/^@/, '').trim();
  if (!t) return '?';
  const ch = t.codePointAt(0);
  return ch ? String.fromCodePoint(ch).toUpperCase() : '?';
}

async function hydrateAllTwimgAvatarsForSpeakers(): Promise<void> {
  const next = [...speakers.value];
  const jobs = next
    .map((s, idx) => ({ s, idx }))
    .filter(
      ({ s }) =>
        !!s.avatarUrl &&
        s.avatarUrl.startsWith('http') &&
        s.avatarUrl.includes('twimg.com') &&
        !s.avatarUrl.startsWith('data:')
    );
  if (jobs.length === 0) return;

  let updated = false;
  const batchSize = 6;
  for (let i = 0; i < jobs.length; i += batchSize) {
    const slice = jobs.slice(i, i + batchSize);
    const results = await Promise.all(
      slice.map(async ({ s, idx }) => {
        const dataUrl = await hydrateTwitterProfileImageUrl(s.avatarUrl);
        return { idx, dataUrl };
      })
    );
    for (const { idx, dataUrl } of results) {
      if (dataUrl) {
        next[idx] = { ...next[idx], avatarUrl: dataUrl };
        updated = true;
      }
    }
  }
  if (updated) {
    speakers.value = next;
    await persistParticipantAvatarsOnly();
  }
}

function collectHandleCandidates(s: Speaker): string[] {
  const out: string[] = [];
  const add = (h?: string) => {
    const c = h?.replace(/^@/, '').trim();
    if (c && /^[A-Za-z0-9_]{1,15}$/.test(c) && !out.includes(c)) out.push(c);
  };
  add(s.twitterUsername);
  add(guessTwitterHandleFromDisplayName(s.name));
  const raw = s.name.replace(/^@/, '').trim();
  add(raw.replace(/\./g, ''));
  add(raw.replace(/\.+$/, ''));
  add(raw.replace(/\s+/g, ''));
  return out;
}

async function enrichNumericRestIdSpeakers(): Promise<void> {
  const targets = speakers.value.filter((s) => {
    if (!/^\d+$/.test(s.id.trim())) return false;
    return avatarNeedsResolution(s.avatarUrl) || !s.twitterUsername?.trim();
  });
  if (targets.length === 0) return;

  let updated = false;
  const next = [...speakers.value];
  for (const s of targets) {
    const idx = next.findIndex((x) => x.id === s.id);
    if (idx < 0) continue;
    const profile = await resolveTwitterUserByRestId(s.id.trim());
    if (!profile?.screen_name) continue;

    let avatarUrl = next[idx].avatarUrl?.trim() || '';
    const twUrl = profile.profile_image_url_https;
    if (twUrl && avatarNeedsResolution(avatarUrl)) {
      const sized = twUrl
        .replace('_normal', '_400x400')
        .replace('_mini', '_400x400')
        .replace('_bigger', '_400x400');
      const data = await hydrateTwitterProfileImageUrl(sized);
      if (data) avatarUrl = data;
    }
    if (!avatarUrl || avatarNeedsResolution(avatarUrl)) {
      const fallback = await getTwitterUserAvatar(profile.screen_name);
      if (fallback) avatarUrl = fallback;
    }

    next[idx] = {
      ...next[idx],
      name: profile.name || next[idx].name,
      twitterUsername: profile.screen_name,
      avatarUrl: avatarUrl || next[idx].avatarUrl,
    };
    updated = true;
  }

  if (updated) {
    speakers.value = next;
    await persistParticipantAvatarsOnly();
  }
}

async function refetchSpeakerAvatar(speakerId: string): Promise<void> {
  const idx = speakers.value.findIndex((s) => s.id === speakerId);
  if (idx < 0) return;
  const s = speakers.value[idx];
  const raw = (s.avatarUrl || '').trim();
  if (raw.startsWith('http') && raw.includes('twimg.com')) {
    const data = await hydrateTwitterProfileImageUrl(raw);
    if (data) {
      speakers.value[idx] = { ...s, avatarUrl: data };
      speakers.value = [...speakers.value];
      await persistParticipantAvatarsOnly();
      return;
    }
  }
  for (const h of collectHandleCandidates(s)) {
    const dataUrl = await getTwitterUserAvatar(h);
    if (dataUrl) {
      speakers.value[idx] = { ...s, avatarUrl: dataUrl, twitterUsername: h };
      speakers.value = [...speakers.value];
      await persistParticipantAvatarsOnly();
      return;
    }
  }
  if (/^\d+$/.test(s.id.trim())) {
    const profile = await resolveTwitterUserByRestId(s.id.trim());
    if (profile?.screen_name) {
      let avatarUrl = s.avatarUrl || '';
      const twUrl = profile.profile_image_url_https;
      if (twUrl) {
        const sized = twUrl
          .replace('_normal', '_400x400')
          .replace('_mini', '_400x400')
          .replace('_bigger', '_400x400');
        const data = await hydrateTwitterProfileImageUrl(sized);
        if (data) avatarUrl = data;
      }
      if (!avatarUrl || avatarNeedsResolution(avatarUrl)) {
        const fallback = await getTwitterUserAvatar(profile.screen_name);
        if (fallback) avatarUrl = fallback;
      }
      speakers.value[idx] = {
        ...s,
        name: profile.name || s.name,
        twitterUsername: profile.screen_name,
        avatarUrl: avatarUrl || s.avatarUrl,
      };
      speakers.value = [...speakers.value];
      await persistParticipantAvatarsOnly();
    }
  }
}

function guessTwitterHandleFromDisplayName(name: string): string | undefined {
  const t = name.trim();
  if (!t) return undefined;
  if (t.startsWith('@')) return t.slice(1).split(/\s+/)[0]?.replace(/^@/, '');
  const compact = t.replace(/\s/g, '');
  if (/^[A-Za-z0-9_]{1,15}$/.test(compact)) return compact;
  const first = t.split(/\s+/)[0]?.replace(/^@/, '') ?? '';
  if (/^[A-Za-z0-9_]{1,15}$/.test(first)) return first;
  return undefined;
}

function extractUsernameFromParticipant(participant: SpaceParticipant): string | undefined {
  const saved = participant.twitter_username?.trim().replace(/^@/, '');
  if (saved) return saved;
  return guessTwitterHandleFromDisplayName(participant.name);
}

function avatarNeedsResolution(url: string | undefined): boolean {
  if (!url || url.trim().length === 0) return true;
  if (url.includes('api.dicebear.com')) return true;
  return false;
}

async function enrichMissingAvatars(): Promise<void> {
  const pending = speakers.value.filter((s) => avatarNeedsResolution(s.avatarUrl));
  if (pending.length === 0) return;

  let updated = false;
  const concurrency = 4;
  for (let i = 0; i < pending.length; i += concurrency) {
    const chunk = pending.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map(async (s) => {
        for (const h of collectHandleCandidates(s)) {
          const avatarUrl = await getTwitterUserAvatar(h);
          if (avatarUrl) return { id: s.id, avatarUrl, twitterUsername: h };
        }
        return {
          id: s.id,
          avatarUrl: null as string | null,
          twitterUsername: null as string | null,
        };
      })
    );
    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value.avatarUrl) continue;
      const idx = speakers.value.findIndex((x) => x.id === result.value.id);
      if (idx >= 0) {
        speakers.value[idx] = {
          ...speakers.value[idx],
          avatarUrl: result.value.avatarUrl,
          twitterUsername:
            result.value.twitterUsername ?? speakers.value[idx].twitterUsername,
        };
        updated = true;
      }
    }
  }

  if (updated) {
    speakers.value = [...speakers.value];
    await persistParticipantAvatarsOnly();
  }
}

async function persistParticipantAvatarsOnly(): Promise<void> {
  if (!props.audio) return;
  const participantsPayload: SpaceParticipant[] = speakers.value.map((speaker) => ({
    id: speaker.id,
    name: speaker.name,
    avatar_url: speaker.avatarUrl || null,
    role: speaker.role === 'listener' ? 'listener' : speaker.role,
    twitter_username: speaker.twitterUsername,
    periscope_user_id: speaker.periscopeUserId,
    x_rest_id: speaker.xRestId,
    display_name: speaker.displayName,
  }));
  await upsertDownloadedSpaceMetadata({
    audioId: props.audio.id,
    participants: participantsPayload,
  });
}

function handleTimeUpdate(event: Event) {
  const target = event.target as HTMLAudioElement;
  currentTime.value = target.currentTime;
}

function handleLoadedMetadata(event: Event) {
  const target = event.target as HTMLAudioElement;
  duration.value = target.duration || props.audio?.duration || 0;
  clipEnd.value = Math.min(30, duration.value || 30);
}

function segmentToneClass(segment: SpeakerSegment): string {
  const src = segment.source ?? deriveSegmentSourceFromId(segment.id);
  if (src === 'manual') return 'space-studio__segment--tone-manual';
  if (sourceAllowsActiveHighlight(src)) return 'space-studio__segment--tone-reliable';
  return 'space-studio__segment--tone-estimated';
}

function segmentStyle(segment: SpeakerSegment) {
  const total = duration.value || 1;
  const left = (segment.start / total) * 100;
  const width = ((segment.end - segment.start) / total) * 100;
  const isActive = speakingHighlightIds.value.includes(segment.speakerId);
  const isEstimated = estimatedHighlightIds.value.includes(segment.speakerId) && !isActive;

  return {
    left: `${left}%`,
    width: `${Math.max(0.3, width)}%`,
    background: isActive
      ? 'rgba(34, 211, 238, 0.95)'
      : isEstimated
        ? 'rgba(251, 191, 36, 0.7)'
        : 'rgba(39, 39, 42, 0.9)',
    borderColor: isActive
      ? 'rgba(103, 232, 249, 1)'
      : isEstimated
        ? 'rgba(251, 191, 36, 0.95)'
        : 'rgba(82, 82, 91, 1)',
  };
}

function isReliableActiveSpeaker(speakerId: string): boolean {
  const speaker = speakers.value.find((s) => s.id === speakerId);
  const identities = [speakerId, speaker?.periscopeUserId, speaker?.xRestId].filter(
    (id): id is string => !!id
  );
  return identities.some((id) => speakingHighlightIds.value.includes(id));
}

function isEstimatedActiveSpeaker(speakerId: string): boolean {
  const speaker = speakers.value.find((s) => s.id === speakerId);
  const identities = [speakerId, speaker?.periscopeUserId, speaker?.xRestId].filter(
    (id): id is string => !!id
  );
  return (
    identities.some((id) => estimatedHighlightIds.value.includes(id)) &&
    !identities.some((id) => speakingHighlightIds.value.includes(id))
  );
}

function adjustSpeakerOffset(deltaSeconds: number) {
  speakerTimelineOffset.value = Math.max(-120, Math.min(120, speakerTimelineOffset.value + deltaSeconds));
}

function seekToTime(t: number) {
  if (audioRef.value) {
    audioRef.value.currentTime = Math.max(0, t);
  }
  currentTime.value = Math.max(0, t);
}

function formatTimelineEvent(ev: SpaceTimelineEvent): string {
  const names = (ids: string[]) =>
    ids
      .map((id) => speakers.value.find((s) => s.id === id)?.name ?? id)
      .join(', ');
  if (ev.type === 'joined_stage') return `${names(ev.user_ids)} joined the stage`;
  if (ev.type === 'left_stage') return `${names(ev.user_ids)} left the stage`;
  if (ev.type === 'speaker_changed') return `${names(ev.user_ids)} — speaking`;
  return ev.detail ?? ev.type;
}

function setClipStart() {
  clipStart.value = currentTime.value;
  if (clipStart.value > clipEnd.value) {
    clipEnd.value = Math.min(duration.value, clipStart.value + 15);
  }
}

function setClipEnd() {
  clipEnd.value = currentTime.value;
  if (clipEnd.value < clipStart.value) {
    clipStart.value = Math.max(0, clipEnd.value - 15);
  }
}

function createManualClip() {
  const start = Math.min(clipStart.value, clipEnd.value);
  const end = Math.max(clipStart.value, clipEnd.value);
  aiSuggestions.value = [{
    id: `manual-${Date.now()}`,
    label: 'Manual clip',
    start,
    end,
  }];
}

function createAiClipSuggestions() {
  const suggestions: ClipSuggestion[] = speakerSegments.value
    .slice(0, 6)
    .map((segment, index) => ({
      id: `ai-${index}`,
      label: `Suggested clip ${index + 1}`,
      start: segment.start,
      end: Math.min(duration.value || segment.end, segment.start + 25),
    }));

  aiSuggestions.value = suggestions;
}

function seekToSuggestion(suggestion: ClipSuggestion) {
  clipStart.value = suggestion.start;
  clipEnd.value = suggestion.end;
  if (audioRef.value) {
    audioRef.value.currentTime = suggestion.start;
  }
}

interface SpaceClipSpeakerPayload {
  id: string;
  name: string;
  avatarUrl: string;
  role: Speaker['role'];
}

interface SpaceClipPlanPayload {
  audioId: string;
  sourceUrl: string | null;
  title: string | null;
  start: number;
  end: number;
  speakers: SpaceClipSpeakerPayload[];
  spotlightSpeakerId: string | null;
  createdAt: number;
}

const SPACE_CLIP_PLAN_PREFIX = 'space-studio-clip-plan';

function buildClipPlan(): { key: string; payload: SpaceClipPlanPayload } | null {
  if (!props.audio) return null;
  const start = Math.min(clipStart.value, clipEnd.value);
  const end = Math.max(clipStart.value, clipEnd.value);

  const planSpeakers: SpaceClipSpeakerPayload[] = speakersInClipRange.value.map((s) => ({
    id: s.id,
    name: s.name,
    avatarUrl: s.avatarUrl,
    role: s.role,
  }));
  const payload: SpaceClipPlanPayload = {
    audioId: props.audio.id,
    sourceUrl: props.audio.source_url ?? null,
    title: props.audio.title ?? null,
    start,
    end,
    speakers: planSpeakers,
    spotlightSpeakerId: spotlightSpeakerId.value,
    createdAt: Date.now(),
  };
  const key = `${SPACE_CLIP_PLAN_PREFIX}:${props.audio.id}:${Math.floor(start)}-${Math.floor(end)}:${Date.now()}`;
  try {
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    console.warn('[SpaceStudio] Failed to persist clip plan to sessionStorage:', e);
  }
  return { key, payload };
}

function openAiVideo() {
  const plan = buildClipPlan();
  if (!plan) return;
  router.push({
    path: '/ai-video',
    query: {
      source: 'twitter-space',
      audioId: plan.payload.audioId,
      start: Math.floor(plan.payload.start).toString(),
      end: Math.floor(plan.payload.end).toString(),
      clipPlanKey: plan.key,
    },
  });
  emit('close');
}

function openEditorMp4() {
  const plan = buildClipPlan();
  if (!plan) return;
  router.push({
    path: '/video-editor',
    query: {
      source: 'twitter-space',
      audioId: plan.payload.audioId,
      start: Math.floor(plan.payload.start).toString(),
      end: Math.floor(plan.payload.end).toString(),
      format: 'mp4',
      clipPlanKey: plan.key,
    },
  });
  emit('close');
}

function formatTime(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function normalizeSpaceRole(role: string | undefined): SpaceParticipant['role'] {
  return role === 'host' ||
    role === 'cohost' ||
    role === 'speaker' ||
    role === 'admin' ||
    role === 'listener' ||
    role === 'guest' ||
    role === 'unknown'
    ? role
    : 'unknown';
}

function mergeParticipantsWithTimelineSegments<T extends SpaceParticipant>(
  participants: T[],
  segments: Array<{ speaker_id: string }>
): T[] {
  const seen = new Set(participants.flatMap((p) => [p.id, p.periscope_user_id].filter(Boolean)));
  const out = [...participants];
  for (const seg of segments) {
    if (seen.has(seg.speaker_id)) continue;
    seen.add(seg.speaker_id);
    out.push({
      id: seg.speaker_id,
      name: `Speaker ${seg.speaker_id}`,
      avatar_url: null,
      role: 'unknown',
      periscope_user_id: seg.speaker_id,
    } as T);
  }
  return out;
}

interface SyncParticipant extends SpaceParticipant {
  twitterUsername?: string;
}

async function syncSpeakers() {
  if (!props.audio?.source_url || syncingSpeakers.value) return;
  syncingSpeakers.value = true;
  try {
    const info = await getTwitterBroadcastInfo(props.audio.source_url);
    let participants: SyncParticipant[] = (info.participants || []).map((participant) => ({
      id: participant.id,
      name: participant.name,
      avatar_url: participant.avatarUrl || null,
      role: normalizeSpaceRole(participant.role),
      twitterUsername: participant.twitterUsername,
      periscope_user_id: participant.periscopeUserId,
      x_rest_id: participant.xRestId,
      display_name: participant.displayName,
    }));

    const totalDuration = duration.value || props.audio.duration || 0;
    let storedSegments: SpaceSpeakerSegment[] = [];
    let hlsStageSnapshots: SpaceStageSnapshot[] | undefined;

    const apiSpeakerSegments =
      info.speakerTimeline && info.speakerTimeline.length > 0
        ? mapSpeakerTimelineToStoredSegments(info.speakerTimeline)
        : [];
    const hasReliableApiTimeline = apiSpeakerSegments.some((segment) =>
      sourceAllowsActiveHighlight(segment.source ?? deriveSegmentSourceFromId(segment.id))
    );

    if (hasReliableApiTimeline) {
      console.log(`[SpaceStudio] Sync using X API speaker timeline (${apiSpeakerSegments.length} segments)`);
      storedSegments = apiSpeakerSegments;
      participants = mergeParticipantsWithTimelineSegments(participants, storedSegments);
    } else if (info.manifestUrl) {
      try {
        const hls = await extractSpaceSpeakerTimelineFromHls(info.manifestUrl, totalDuration || undefined);
        hlsStageSnapshots = (hls.stageSnapshots ?? []).map((s) => ({
          id: s.id,
          t: s.t,
          on_stage_user_ids: s.onStageUserIds ?? [],
        }));

        if (hls.speakerSegments.length > 0) {
          storedSegments = mapSpeakerTimelineToStoredSegments(hls.speakerSegments);
          participants = mergeParticipantsWithTimelineSegments(participants, storedSegments);
        }

        if (hlsStageSnapshots.length > 0) {
          participants = mergeParticipantsWithTimelineSegments(
            participants,
            hlsStageSnapshots.flatMap((snap) =>
              snap.on_stage_user_ids.map((id) => ({ speaker_id: id }))
            )
          );
        }
      } catch (e) {
        hlsStageSnapshots = undefined;
        console.warn('[SpaceStudio] HLS speaker timeline failed during sync:', e);
      }
    }

    const resolvedDuration =
      totalDuration ||
      Math.max(
        0,
        ...storedSegments.map((segment) => segment.end),
        ...(hlsStageSnapshots ?? []).map((snapshot) => snapshot.t)
      );

    storedSegments = normalizeSpeakerSegments(storedSegments, resolvedDuration || 0);

    const joinHintRows: StageJoinHintRow[] =
      info.spaceReplayHints?.stageJoinTimes?.map((r) => ({
        userId: r.userId,
        offsetSecs: typeof r.offsetSecs === 'number' ? r.offsetSecs : 0,
      })) ?? [];

    const timelinePayload = buildSpaceTimelineEventsPayload(
      participants,
      hlsStageSnapshots ?? [],
      storedSegments,
      joinHintRows,
      resolvedDuration || 0
    );

    const uiParticipants: SpaceParticipant[] = participants.map((p) => {
      const cleaned = sanitizeStoredAvatarUrl(p.avatar_url);
      return {
        id: p.id,
        name: p.name,
        avatar_url: cleaned || null,
        role: normalizeSpaceRole(p.role),
        twitter_username: p.twitterUsername,
        periscope_user_id: p.periscope_user_id,
        x_rest_id: p.x_rest_id,
        display_name: p.display_name,
      };
    });

    await upsertDownloadedSpaceMetadata({
      audioId: props.audio.id,
      sourceUrl: props.audio.source_url || undefined,
      title: info.title || props.audio.title,
      participants: uiParticipants,
      speakerSegments: storedSegments,
      timelineEvents: timelinePayload,
      ...(hlsStageSnapshots !== undefined ? { stageSnapshots: hlsStageSnapshots } : {}),
    });

    await initializeSpaceData();
  } finally {
    syncingSpeakers.value = false;
  }
}

async function assignSegmentSpeaker(segmentId: string) {
  if (!selectedSpeakerId.value || !props.audio) return;
  const index = speakerSegments.value.findIndex((segment) => segment.id === segmentId);
  if (index < 0) return;

  speakerSegments.value[index] = {
    ...speakerSegments.value[index],
    speakerId: selectedSpeakerId.value,
    source: 'manual',
  };
  speakerSegments.value = [...speakerSegments.value];

  await persistCurrentMetadata();
}

async function persistCurrentMetadata() {
  if (!props.audio) return;
  const participantsPayload: SpaceParticipant[] = speakers.value.map((speaker) => ({
    id: speaker.id,
    name: speaker.name,
    avatar_url: speaker.avatarUrl || null,
    role: speaker.role === 'listener' ? 'listener' : speaker.role,
    twitter_username: speaker.twitterUsername,
    periscope_user_id: speaker.periscopeUserId,
    x_rest_id: speaker.xRestId,
    display_name: speaker.displayName,
  }));
  const segs = speakerSegments.value.map((segment) => ({
    id: segment.id,
    speaker_id: segment.speakerId,
    start: segment.start,
    end: segment.end,
    source: segment.source ?? deriveSegmentSourceFromId(segment.id),
    periscope_user_id: segment.periscopeUserId,
    x_rest_id: segment.xRestId,
    username: segment.username,
    display_name: segment.displayName,
    avatar_url: segment.avatarUrl,
    role: segment.role,
  }));
  const joinHints: StageJoinHintRow[] = [];
  const timelinePayload = buildSpaceTimelineEventsPayload(
    participantsPayload,
    stageSnapshots.value,
    segs,
    joinHints,
    duration.value || 0
  );
  await upsertDownloadedSpaceMetadata({
    audioId: props.audio.id,
    sourceUrl: props.audio.source_url || undefined,
    title: props.audio.title,
    participants: participantsPayload,
    speakerSegments: segs,
    stageSnapshots: stageSnapshots.value,
    timelineEvents: timelinePayload,
  });
  timelineEvents.value = timelinePayload;
}
</script>

<style scoped>
.space-studio__overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.74);
  backdrop-filter: blur(4px);
}

.space-studio {
  position: relative;
  width: min(920px, 97vw);
  max-height: 94vh;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  color: var(--card-foreground);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
}

.space-studio__header {
  position: relative;
  padding: 1rem 1.25rem 1rem;
  border-bottom: 1px solid var(--border);
}

.space-studio__header--x {
  padding-top: 1.25rem;
  padding-right: 3rem;
}

.space-studio__close {
  position: absolute;
  right: 0.85rem;
  top: 0.85rem;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: none;
  color: var(--muted-foreground);
  background: transparent;
  cursor: pointer;
}

.space-studio__close:hover {
  background: var(--accent);
  color: var(--accent-foreground);
}

.space-studio__close--x {
  border: 1px solid var(--border);
  background: var(--muted);
}

.space-studio__x-head {
  max-width: 100%;
}

.space-studio__x-rec-row {
  margin-bottom: 0.5rem;
}

.space-studio__rec-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0.45rem 0.15rem 0.35rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--muted);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--foreground);
}

.space-studio__rec-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #f4212e;
}

.space-studio__title {
  margin: 0;
  font-size: 1.1rem;
  color: var(--sidebar-text);
}

.space-studio__title--x {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--foreground);
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.space-studio__subtitle {
  margin: 0.35rem 0 0;
  color: var(--sidebar-text-muted);
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 92%;
}

.space-studio__subtitle--x {
  font-size: 0.88rem;
  color: var(--muted-foreground);
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.space-studio__sync-ok--x {
  color: #00ba7c;
  font-weight: 600;
}

.space-studio__content {
  display: grid;
  grid-template-columns: minmax(420px, 0.86fr) minmax(520px, 1.14fr);
  gap: 1.1rem;
  padding: 1.1rem;
  max-height: calc(94vh - 100px);
}

.space-studio__content--replay {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: calc(94vh - 140px);
  padding: 0;
  overflow: hidden;
}

.space-studio__x-panel {
  flex-shrink: 0;
  padding: 1rem 1.25rem 1.25rem;
  background: var(--card);
  border-bottom: 1px solid var(--border);
}

.space-studio__x-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.space-studio__x-roster-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted-foreground);
}

.space-studio__appear-toggle--x {
  color: var(--muted-foreground);
}

.space-studio__x-empty {
  font-size: 0.85rem;
  color: var(--muted-foreground);
  text-align: center;
  padding: 1.5rem 0.5rem;
}

.space-studio__x-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.25rem 0.75rem;
}

@media (max-width: 720px) {
  .space-studio__x-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.space-studio__x-cell {
  position: relative;
  text-align: center;
  min-width: 0;
}

.space-studio__x-cell--spotlight .space-studio__avatar-wrap--x {
  box-shadow:
    0 0 0 3px rgba(253, 224, 71, 0.85),
    0 4px 14px rgba(15, 20, 25, 0.12);
}

.space-studio__avatar-wrap--x {
  width: 80px;
  height: 80px;
  margin: 0 auto 0.45rem;
  border-radius: 999px;
  padding: 2px;
  border: 2px solid var(--border);
  box-shadow: none;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    opacity 140ms ease;
}

.space-studio__avatar-wrap--speaking-x {
  border-color: #1d9bf0;
  box-shadow:
    0 0 0 3px rgba(29, 155, 240, 0.25),
    0 4px 16px rgba(29, 155, 240, 0.35);
}

.space-studio__avatar-wrap--pinned-x {
  border-color: #7856ff;
  box-shadow:
    0 0 0 3px rgba(120, 86, 255, 0.22),
    0 4px 14px rgba(120, 86, 255, 0.28);
}

.space-studio__avatar-wrap--offstage-x {
  opacity: 0.42;
  filter: grayscale(0.25);
}

.space-studio__avatar-wrap--offstage-x.space-studio__avatar-wrap--speaking-x,
.space-studio__avatar-wrap--offstage-x.space-studio__avatar-wrap--pinned-x {
  opacity: 1;
  filter: none;
}

.space-studio__avatar--x {
  border: none;
  background: var(--muted);
}

.space-studio__avatar-fallback--x {
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 1.35rem;
}

.space-studio__x-name {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.space-studio__x-role {
  margin-top: 0.15rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--muted-foreground);
}

.space-studio__spotlight-toggle--x {
  top: -2px;
  right: calc(50% - 42px);
}

.space-studio__spotlight-checkbox--x {
  border-color: var(--border);
  background: var(--card);
}

.space-studio__spotlight-toggle--on .space-studio__spotlight-checkbox--x {
  border-color: #fbbf24;
  background: #fbbf24;
}

.space-studio__split {
  display: grid;
  grid-template-columns: minmax(340px, 0.95fr) minmax(360px, 1.05fr);
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

.space-studio__split--tools {
  padding: 1rem 1.25rem 1.25rem;
  background: var(--muted);
  border-top: 1px solid var(--border);
}

.space-studio__left,
.space-studio__right {
  min-height: 0;
  overflow-y: auto;
}

.space-studio__player-wrap {
  border: 1px solid rgba(63, 63, 70, 0.75);
  border-radius: 16px;
  padding: 0.9rem;
  background: rgba(0, 0, 0, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.space-studio__player {
  width: 100%;
}

.space-studio__timeline {
  margin-top: 1rem;
  padding: 0.9rem;
  border: 1px solid rgba(63, 63, 70, 0.68);
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.2);
}

.space-studio__timeline-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.73rem;
  color: var(--sidebar-text-muted);
  margin-bottom: 0.35rem;
}

.space-studio__timeline-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  font-size: 0.65rem;
  color: var(--sidebar-text-muted);
  margin-bottom: 0.45rem;
}

.space-studio__timeline-legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.space-studio__swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.space-studio__swatch--reliable {
  background: rgba(34, 211, 238, 0.85);
  border: 1px solid rgba(103, 232, 249, 0.9);
}

.space-studio__swatch--estimated {
  background: rgba(113, 113, 122, 0.85);
  border: 1px solid rgba(161, 161, 170, 0.6);
}

.space-studio__swatch--manual {
  background: rgba(94, 234, 212, 0.35);
  border: 1px solid rgba(94, 234, 212, 0.75);
}

.space-studio__segment--tone-estimated {
  opacity: 0.88;
}

.space-studio__segment--tone-manual {
  box-shadow: inset 0 0 0 1px rgba(94, 234, 212, 0.45);
}

.space-studio__quality-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  padding: 0.7rem 0.75rem;
  border: 1px solid rgba(63, 63, 70, 0.62);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.18);
}

.space-studio__quality-badge {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  background: rgba(34, 211, 238, 0.12);
  border: 1px solid rgba(34, 211, 238, 0.28);
  color: #a5f3fc;
}

.space-studio__hint-inline {
  font-size: 0.68rem;
  color: var(--sidebar-text-muted);
  flex: 1;
  min-width: 140px;
}

.space-studio__activity-block {
  margin-bottom: 1rem;
}

.space-studio__activity-list {
  max-height: 150px;
  overflow-y: auto;
  border-radius: 8px;
  border: 1px solid var(--sidebar-border);
  background: rgba(0, 0, 0, 0.18);
}

.space-studio__activity-row {
  width: 100%;
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  text-align: left;
  padding: 0.45rem 0.55rem;
  border: none;
  border-bottom: 1px solid rgba(63, 63, 70, 0.45);
  background: transparent;
  color: var(--sidebar-text);
  font-size: 0.68rem;
  cursor: pointer;
}

.space-studio__activity-row:last-child {
  border-bottom: none;
}

.space-studio__activity-row:hover {
  background: var(--sidebar-hover);
}

.space-studio__activity-time {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: #67e8f9;
  font-weight: 600;
}

.space-studio__activity-body {
  color: var(--sidebar-text-muted);
}

.space-studio__timeline-track {
  position: relative;
  width: 100%;
  height: 42px;
  border-radius: 12px;
  border: 1px solid var(--sidebar-border);
  background: rgba(9, 9, 11, 0.7);
  overflow: hidden;
}

.space-studio__segment {
  position: absolute;
  top: 6px;
  height: 30px;
  border-radius: 9px;
  border: 1px solid transparent;
  transition: background-color 120ms ease;
}

.space-studio__sync-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.65rem;
}

.space-studio__sync-label {
  color: var(--sidebar-text-muted);
  font-size: 0.68rem;
  margin-right: 0.15rem;
}

.space-studio__sync-btn {
  border: 1px solid rgba(82, 82, 91, 0.8);
  border-radius: 999px;
  padding: 0.18rem 0.45rem;
  background: rgba(39, 39, 42, 0.72);
  color: var(--sidebar-text);
  font-size: 0.65rem;
  font-weight: 700;
  cursor: pointer;
}

.space-studio__sync-btn:hover {
  border-color: rgba(34, 211, 238, 0.5);
  color: #a5f3fc;
}

.space-studio__segment--editable {
  cursor: pointer;
}

.space-studio__playhead {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  background: #e4e4e7;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.7);
}

.space-studio__clip-controls {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.8rem;
  border: 1px solid rgba(63, 63, 70, 0.55);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.16);
}

.space-studio__btn {
  border-radius: 7px;
  border: 1px solid var(--sidebar-border);
  padding: 0.48rem 0.7rem;
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
}

.space-studio__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.space-studio__btn--secondary {
  background: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.space-studio__btn--primary {
  background: rgba(34, 211, 238, 0.18);
  border-color: rgba(34, 211, 238, 0.35);
  color: #67e8f9;
}

.space-studio__clip-range {
  margin-top: 0.55rem;
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.space-studio__suggestions {
  margin-top: 1rem;
}

.space-studio__suggestions-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--sidebar-text-muted);
  margin-bottom: 0.45rem;
}

.space-studio__suggestion {
  width: 100%;
  margin-bottom: 0.4rem;
  padding: 0.5rem 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--sidebar-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--sidebar-text);
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  cursor: pointer;
}

.space-studio__suggestion:hover {
  border-color: rgba(34, 211, 238, 0.4);
}

.space-studio__section-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.6rem;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.space-studio__section-label--listeners {
  margin-top: 1rem;
  color: rgba(161, 161, 170, 0.65);
}

.space-studio__section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: rgba(82, 82, 91, 0.5);
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
}

.space-studio__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(78px, 1fr));
  gap: 1rem 0.85rem;
  margin-bottom: 0.9rem;
  padding: 0.95rem;
  border: 1px solid rgba(63, 63, 70, 0.6);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(24, 24, 27, 0.65), rgba(9, 9, 11, 0.28)),
    rgba(0, 0, 0, 0.14);
}

.space-studio__grid--listeners {
  grid-template-columns: repeat(6, minmax(64px, 1fr));
  gap: 0.5rem;
}

.space-studio__speaker {
  text-align: center;
  min-width: 0;
}

.space-studio__speaker--listener {
  opacity: 0.8;
}

.space-studio__role-badge {
  display: inline-block;
  margin-top: 0.2rem;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.02em;
}

.space-studio__role-badge--host {
  background: rgba(234, 179, 8, 0.18);
  color: #fbbf24;
  border: 1px solid rgba(234, 179, 8, 0.35);
}

.space-studio__role-badge--speaker {
  background: rgba(34, 211, 238, 0.12);
  color: #67e8f9;
  border: 1px solid rgba(34, 211, 238, 0.25);
}

.space-studio__role-badge--listener {
  background: rgba(82, 82, 91, 0.35);
  color: rgba(161, 161, 170, 0.8);
  border: 1px solid rgba(82, 82, 91, 0.5);
}

.space-studio__speaker-tile .space-studio__avatar-wrap {
  width: 64px;
  height: 64px;
  margin: 0 auto 0.35rem;
  cursor: pointer;
}

.space-studio__avatar-wrap {
  width: 72px;
  height: 72px;
  margin: 0 auto 0.4rem;
  border-radius: 999px;
  padding: 2px;
  border: 2px solid rgba(82, 82, 91, 0.8);
  box-shadow: 0 0 0 rgba(34, 211, 238, 0);
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    opacity 140ms ease;
}

.space-studio__avatar-wrap--speaking {
  border-color: #22d3ee;
  box-shadow:
    0 0 0 4px rgba(34, 211, 238, 0.22),
    0 0 22px rgba(34, 211, 238, 0.72);
}

.space-studio__avatar-wrap--pinned {
  border-color: #a78bfa;
  box-shadow:
    0 0 0 3px rgba(167, 139, 250, 0.28),
    0 0 14px rgba(139, 92, 246, 0.42);
}

.space-studio__avatar-wrap--estimated-active {
  border-color: #fbbf24;
  box-shadow:
    0 0 0 4px rgba(251, 191, 36, 0.2),
    0 0 20px rgba(251, 191, 36, 0.62);
}

.space-studio__avatar-wrap--selected {
  border-color: #5eead4;
  box-shadow:
    0 0 0 3px rgba(94, 234, 212, 0.28),
    0 0 16px rgba(45, 212, 191, 0.45);
}

.space-studio__avatar-wrap--offstage {
  opacity: 0.4;
  filter: grayscale(0.35);
}

.space-studio__avatar-wrap--offstage.space-studio__avatar-wrap--speaking {
  opacity: 1;
  filter: none;
}

.space-studio__avatar-wrap--offstage.space-studio__avatar-wrap--pinned {
  opacity: 1;
  filter: none;
}

.space-studio__avatar-wrap--offstage.space-studio__avatar-wrap--estimated-active {
  opacity: 1;
  filter: none;
}

.space-studio__avatar-wrap--listener {
  width: 44px;
  height: 44px;
  border-color: rgba(82, 82, 91, 0.5);
  box-shadow: none;
  cursor: default;
}

.space-studio__avatar {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
  background: #1f2937;
}

.space-studio__avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: rgba(228, 228, 231, 0.88);
  background: linear-gradient(160deg, #3f3f46, #18181b);
  border-radius: 999px;
  user-select: none;
}

.space-studio__avatar-fallback--xs {
  font-size: 0.62rem;
}

.space-studio__avatar-fallback--sm {
  width: 22px;
  height: 22px;
  min-width: 22px;
  font-size: 0.62rem;
  flex-shrink: 0;
}

.space-studio__avatar-fallback--lg {
  width: 76px;
  height: 76px;
  font-size: 1.55rem;
}

.space-studio__avatar-fallback--xl {
  width: 100%;
  height: 100%;
  font-size: 2.75rem;
}

.space-studio__speaker-name {
  font-size: 0.7rem;
  color: var(--sidebar-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.space-studio__spotlight-toggle {
  position: absolute;
  top: -4px;
  right: 2px;
  width: 22px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  z-index: 2;
}

.space-studio__spotlight-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 1.5px solid rgba(161, 161, 170, 0.7);
  background: rgba(9, 9, 11, 0.85);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 120ms ease;
}

.space-studio__spotlight-toggle:hover .space-studio__spotlight-checkbox {
  border-color: #fde047;
  background: rgba(253, 224, 71, 0.16);
}

.space-studio__spotlight-toggle--on .space-studio__spotlight-checkbox {
  border-color: #fde047;
  background: #fde047;
}

.space-studio__spotlight-check {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #18181b;
}

.space-studio__appear-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  user-select: none;
  letter-spacing: 0.04em;
}

.space-studio__appear-toggle input {
  accent-color: #22d3ee;
  cursor: pointer;
}

.space-studio__section-label--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

/* ─── Speakers come up animation ─────────────────────────────────────── */
.space-speaker-enter-active {
  transition: transform 260ms ease, opacity 260ms ease;
}
.space-speaker-leave-active {
  transition: transform 220ms ease, opacity 220ms ease;
  position: absolute;
}
.space-speaker-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.92);
}
.space-speaker-leave-to {
  opacity: 0;
  transform: scale(0.94);
}
.space-speaker-move {
  transition: transform 260ms ease;
}

/* ─── Speakers in this clip ──────────────────────────────────────────── */
.space-studio__clip-roster {
  margin-bottom: 1rem;
  padding: 0.75rem 0.85rem 0.85rem;
  border: 1px solid rgba(63, 63, 70, 0.6);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.18);
}

.space-studio__clip-roster-meta {
  font-size: 0.66rem;
  color: var(--sidebar-text-muted);
  font-variant-numeric: tabular-nums;
}

.space-studio__clip-empty {
  font-size: 0.7rem;
  color: var(--sidebar-text-muted);
  padding: 0.4rem 0.1rem;
}

.space-studio__clip-roster-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.space-studio__clip-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.55rem 0.25rem 0.3rem;
  border-radius: 999px;
  border: 1px solid rgba(82, 82, 91, 0.7);
  background: rgba(24, 24, 27, 0.7);
  color: var(--sidebar-text);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 120ms ease;
}

.space-studio__clip-chip:hover {
  border-color: rgba(253, 224, 71, 0.55);
}

.space-studio__clip-chip--spotlight {
  border-color: #fde047;
  background: rgba(253, 224, 71, 0.14);
  color: #fde68a;
}

.space-studio__clip-chip-avatar {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  object-fit: cover;
  background: #1f2937;
}

.space-studio__clip-chip-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ─── Spotlight overlay ──────────────────────────────────────────────── */
.space-studio__spotlight-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background:
    radial-gradient(circle at 50% 35%, rgba(253, 224, 71, 0.12), transparent 55%),
    rgba(9, 9, 11, 0.78);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.space-studio__spotlight-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.6rem 2rem 1.4rem;
  border-radius: 22px;
  border: 1px solid rgba(253, 224, 71, 0.45);
  background:
    linear-gradient(180deg, rgba(39, 39, 42, 0.92), rgba(9, 9, 11, 0.92));
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.55);
  max-width: 380px;
  text-align: center;
}

.space-studio__spotlight-close {
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--sidebar-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.space-studio__spotlight-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--sidebar-text);
}

.space-studio__spotlight-avatar-wrap {
  width: 168px;
  height: 168px;
  border-radius: 999px;
  padding: 4px;
  background: linear-gradient(135deg, #fde047, rgba(253, 224, 71, 0.4));
  box-shadow: 0 0 36px rgba(253, 224, 71, 0.45);
}

.space-studio__spotlight-avatar {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
  background: #18181b;
}

.space-studio__spotlight-name {
  font-size: 1.5rem;
  font-weight: 800;
  color: #fef9c3;
  margin-top: 0.5rem;
  letter-spacing: 0.01em;
}

.space-studio__spotlight-role {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(253, 224, 71, 0.85);
}

.space-studio__spotlight-hint {
  font-size: 0.72rem;
  color: rgba(228, 228, 231, 0.7);
  margin-top: 0.5rem;
  line-height: 1.4;
}

.space-spotlight-enter-active,
.space-spotlight-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.space-spotlight-enter-from,
.space-spotlight-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 180ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (max-width: 1024px) {
  .space-studio__content {
    grid-template-columns: 1fr;
  }

  .space-studio__split {
    grid-template-columns: 1fr;
  }

  .space-studio__grid {
    grid-template-columns: repeat(4, minmax(72px, 1fr));
  }
}
</style>

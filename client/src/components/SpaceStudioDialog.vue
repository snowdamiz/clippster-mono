<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open && audio" class="space-studio__overlay" @click.self="emit('close')">
        <div class="space-studio">
          <div class="space-studio__accent"></div>
          <div class="space-studio__header">
            <button class="space-studio__close" @click="emit('close')" title="Close">
              <X :size="18" />
            </button>
            <div class="space-studio__title-wrap">
              <h2 class="space-studio__title">X Space Studio</h2>
              <p class="space-studio__subtitle">{{ audio.title }}</p>
            </div>
          </div>

          <div class="space-studio__content">
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
                <div class="space-studio__timeline-track">
                  <div
                    v-for="segment in speakerSegments"
                    :key="segment.id"
                    class="space-studio__segment"
                    :class="{ 'space-studio__segment--editable': !!selectedSpeakerId }"
                    :style="segmentStyle(segment)"
                    @click="assignSegmentSpeaker(segment.id)"
                  />
                  <div class="space-studio__playhead" :style="{ left: `${playheadPercent}%` }"></div>
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
                <button
                  class="space-studio__btn space-studio__btn--secondary"
                  :disabled="dumpingId3"
                  @click="dumpId3Debug"
                >
                  {{ dumpingId3 ? 'Dumping...' : 'Dump ID3 Debug' }}
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
              <div class="space-studio__hint">
                Select a speaker, then click timeline blocks to reassign talking segments.
              </div>

              <!-- Hosts & Speakers -->
              <template v-if="onStageParticipants.length > 0">
                <div class="space-studio__section-label">On Stage</div>
                <div class="space-studio__grid">
                  <div
                    v-for="speaker in onStageParticipants"
                    :key="speaker.id"
                    class="space-studio__speaker"
                    @click="selectedSpeakerId = speaker.id"
                  >
                    <div
                      class="space-studio__avatar-wrap"
                      :class="{
                        'space-studio__avatar-wrap--active': activeSpeakerIds.has(speaker.id),
                        'space-studio__avatar-wrap--selected': selectedSpeakerId === speaker.id,
                        'space-studio__avatar-wrap--offstage':
                          onStageUserIdsAtPlayhead !== null &&
                          !onStageUserIdsAtPlayhead.has(speaker.id),
                      }"
                    >
                      <img
                        :src="speaker.avatarUrl"
                        :alt="speaker.name"
                        class="space-studio__avatar"
                        @error="(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(speaker.id)}` }"
                      />
                    </div>
                    <div class="space-studio__speaker-name" :title="speaker.name">{{ speaker.name }}</div>
                    <div
                      class="space-studio__role-badge"
                      :class="`space-studio__role-badge--${speaker.role === 'host' ? 'host' : 'speaker'}`"
                    >
                      {{ speaker.role === 'host' ? 'Host' : 'Speaker' }}
                    </div>
                  </div>
                </div>
              </template>

              <!-- Listeners -->
              <template v-if="listenerParticipants.length > 0">
                <div class="space-studio__section-label space-studio__section-label--listeners">
                  Listeners <span class="space-studio__section-count">{{ listenerParticipants.length }}</span>
                </div>
                <div class="space-studio__grid space-studio__grid--listeners">
                  <div
                    v-for="listener in listenerParticipants"
                    :key="listener.id"
                    class="space-studio__speaker space-studio__speaker--listener"
                  >
                    <div class="space-studio__avatar-wrap space-studio__avatar-wrap--listener">
                      <img
                        :src="listener.avatarUrl"
                        :alt="listener.name"
                        class="space-studio__avatar"
                        @error="(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(listener.id)}` }"
                      />
                    </div>
                    <div class="space-studio__speaker-name" :title="listener.name">{{ listener.name }}</div>
                    <div class="space-studio__role-badge space-studio__role-badge--listener">Listener</div>
                  </div>
                </div>
              </template>

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
  SpaceStageSnapshot,
} from '@/services/database/types';
import {
  getDownloadedSpaceMetadata,
  parseSpaceParticipants,
  parseSpaceSpeakerSegments,
  parseSpaceStageSnapshots,
  upsertDownloadedSpaceMetadata,
} from '@/services/database/downloaded-space-metadata';
import { invoke } from '@tauri-apps/api/core';
import {
  extractSpaceSpeakerTimelineFromHls,
  getTwitterBroadcastInfo,
} from '@/services/twitter';

interface Speaker {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'host' | 'speaker' | 'listener' | 'guest' | 'unknown';
}

interface SpeakerSegment {
  id: string;
  speakerId: string;
  start: number;
  end: number;
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

const router = useRouter();
const audioRef = ref<HTMLAudioElement | null>(null);
const currentTime = ref(0);
const duration = ref(0);
const clipStart = ref(0);
const clipEnd = ref(30);
/** All speakers whose timeline segments contain the playhead (supports overlapping segments). */
const activeSpeakerIds = ref<Set<string>>(new Set());
const aiSuggestions = ref<ClipSuggestion[]>([]);
const syncingSpeakers = ref(false);
const dumpingId3 = ref(false);
const selectedSpeakerId = ref<string | null>(null);

const speakers = ref<Speaker[]>([]);
const speakerSegments = ref<SpeakerSegment[]>([]);
const stageSnapshots = ref<SpaceStageSnapshot[]>([]);

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

const listenerParticipants = computed(() =>
  speakers.value.filter((s) => s.role === 'listener')
);

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

watch(currentTime, (time) => {
  const ids = new Set<string>();
  for (const segment of speakerSegments.value) {
    if (time >= segment.start && time <= segment.end) {
      ids.add(segment.speakerId);
    }
  }
  activeSpeakerIds.value = ids;
});

async function initializeSpaceData() {
  currentTime.value = 0;
  duration.value = props.audio?.duration ?? 0;
  clipStart.value = 0;
  clipEnd.value = Math.min(30, duration.value || 30);
  aiSuggestions.value = [];

  const metadata = props.audio ? await getDownloadedSpaceMetadata(props.audio.id) : null;
  const savedParticipants = parseSpaceParticipants(metadata?.participants_json ?? null);
  const savedSegments = parseSpaceSpeakerSegments(metadata?.speaker_segments_json ?? null);
  stageSnapshots.value = parseSpaceStageSnapshots(metadata?.stage_snapshots_json ?? null);

  if (savedParticipants.length > 0) {
    const mapped = savedParticipants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      role: participant.role ?? 'unknown',
      avatarUrl:
        participant.avatar_url ||
        `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(participant.id)}`,
    }));
    speakers.value = mergeDuplicateSpeakerRows(mapped);
  } else {
    speakers.value = buildSpeakerGrid();
  }

  if (savedSegments.length > 0) {
    const rawSegs = savedSegments.map((segment) => ({
      id: segment.id,
      speakerId: segment.speaker_id,
      start: segment.start,
      end: segment.end,
    }));
    speakerSegments.value = reconcileSegmentSpeakerIds(rawSegs, speakers.value);
  } else {
    // Seed timeline only for on-stage participants — listeners never contribute audio.
    const onStageForSeed = speakers.value.filter((s) => s.role !== 'listener');
    speakerSegments.value = buildSpeakerSegments(
      onStageForSeed.length > 0 ? onStageForSeed : speakers.value,
      duration.value || 3600
    );
  }

  selectedSpeakerId.value = onStageParticipants.value[0]?.id ?? null;
}

function buildSpeakerGrid(): Speaker[] {
  return Array.from({ length: 8 }, (_, index) => {
    const number = index + 1;
    const seed = `${props.audio?.id ?? 'space'}-${number}`;
    return {
      id: `speaker-${number}`,
      name: `Speaker ${number}`,
      role: 'unknown' as const,
      avatarUrl: `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed)}`,
    };
  });
}

function buildSpeakerSegments(roster: Speaker[], totalSeconds: number): SpeakerSegment[] {
  const segments: SpeakerSegment[] = [];
  if (roster.length === 0) return segments;

  let cursor = 0;
  let index = 0;
  while (cursor < totalSeconds) {
    const segmentLength = 10 + (index % 6) * 4;
    const speaker = roster[index % roster.length];
    const end = Math.min(totalSeconds, cursor + segmentLength);

    segments.push({
      id: `${speaker.id}-${cursor}`,
      speakerId: speaker.id,
      start: cursor,
      end,
    });

    cursor = end + 1;
    index += 1;
  }

  return segments;
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

function segmentStyle(segment: SpeakerSegment) {
  const total = duration.value || 1;
  const t = currentTime.value;
  const left = (segment.start / total) * 100;
  const width = ((segment.end - segment.start) / total) * 100;
  const isActive = t >= segment.start && t <= segment.end;

  return {
    left: `${left}%`,
    width: `${Math.max(0.3, width)}%`,
    background: isActive ? 'rgba(34, 211, 238, 0.95)' : 'rgba(39, 39, 42, 0.9)',
    borderColor: isActive ? 'rgba(103, 232, 249, 1)' : 'rgba(82, 82, 91, 1)',
  };
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

function openAiVideo() {
  if (!props.audio) return;
  const start = Math.min(clipStart.value, clipEnd.value);
  const end = Math.max(clipStart.value, clipEnd.value);
  router.push({
    path: '/ai-video',
    query: {
      source: 'twitter-space',
      audioId: props.audio.id,
      start: Math.floor(start).toString(),
      end: Math.floor(end).toString(),
    },
  });
  emit('close');
}

function openEditorMp4() {
  if (!props.audio) return;
  const start = Math.min(clipStart.value, clipEnd.value);
  const end = Math.max(clipStart.value, clipEnd.value);
  router.push({
    path: '/video-editor',
    query: {
      source: 'twitter-space',
      audioId: props.audio.id,
      start: Math.floor(start).toString(),
      end: Math.floor(end).toString(),
      format: 'mp4',
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
  return role === 'host' || role === 'speaker' || role === 'listener' || role === 'guest' || role === 'unknown'
    ? role
    : 'unknown';
}

/** Match Rust stage-join slugify & legacy mixed-case handles. */
function slugifyHandle(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

function speakerRowQuality(s: Speaker): number {
  let q = 0;
  if (s.avatarUrl && !s.avatarUrl.includes('dicebear')) q += 20;
  if (s.name.startsWith('@')) q += 10;
  if (/^\d+$/.test(s.id)) q += 5;
  return q;
}

function speakersToParticipants(speakers: Speaker[]): SpaceParticipant[] {
  return speakers.map((s) => ({
    id: s.id,
    name: s.name,
    avatar_url: s.avatarUrl,
    role: s.role,
  }));
}

function handleSlugFromParticipant(p: Pick<Speaker | SpaceParticipant, 'id' | 'name'>): string {
  const bare = p.name.replace(/^@/, '').trim();
  if (bare) return slugifyHandle(bare);
  return slugifyHandle(p.id);
}

/** Map timeline / Periscope raw keys onto an existing roster `id` (exact, slug, or handle prefix). */
function resolveRawSpeakerKeyToParticipantId(
  raw: string,
  participants: SpaceParticipant[]
): string | null {
  const r = raw.trim();
  if (!r) return null;
  const rSlug = slugifyHandle(r);

  for (const p of participants) {
    if (p.id === r) return p.id;
  }
  for (const p of participants) {
    if (slugifyHandle(p.id) === rSlug) return p.id;
  }
  for (const p of participants) {
    const hs = handleSlugFromParticipant(p);
    if (hs && hs === rSlug) return p.id;
  }
  for (const p of participants) {
    const hs = handleSlugFromParticipant(p);
    if (!hs) continue;
    const [short, long] = rSlug.length <= hs.length ? [rSlug, hs] : [hs, rSlug];
    if (short.length >= 4 && long.startsWith(short)) return p.id;
  }
  return null;
}

/** Collapse duplicate rows (e.g. @GoldenRuleFLC + display-name "GoldenRule") using slug prefix clustering. */
function mergeDuplicateSpeakerRows(speakers: Speaker[]): Speaker[] {
  const n = speakers.length;
  if (n <= 1) return speakers;

  const slugOf = (i: number) => {
    const s = speakers[i];
    const h = s.name.replace(/^@/, '').trim();
    if (h) return slugifyHandle(h);
    return slugifyHandle(s.id);
  };

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const prefixRelated = (a: string, b: string) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const [x, y] = a.length <= b.length ? [a, b] : [b, a];
    return x.length >= 4 && y.startsWith(x);
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const si = slugOf(i);
      const sj = slugOf(j);
      const idi = slugifyHandle(speakers[i].id);
      const idj = slugifyHandle(speakers[j].id);
      if (si && sj && (si === sj || prefixRelated(si, sj))) union(i, j);
      else if (idi && sj && prefixRelated(idi, sj)) union(i, j);
      else if (idj && si && prefixRelated(idj, si)) union(i, j);
      else if (idi && idj && (idi === idj || prefixRelated(idi, idj))) union(i, j);
    }
  }

  const buckets = new Map<number, Speaker[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const arr = buckets.get(r) ?? [];
    arr.push(speakers[i]);
    buckets.set(r, arr);
  }

  const out: Speaker[] = [];
  for (const group of buckets.values()) {
    if (group.length === 1) out.push(group[0]);
    else {
      const sorted = [...group].sort((a, b) => speakerRowQuality(b) - speakerRowQuality(a));
      out.push(sorted[0]);
    }
  }
  return out;
}

function buildSpeakerIdAliasMap(speakers: Speaker[]): Map<string, string> {
  const aliases = new Map<string, string>();
  const add = (key: string, canon: string) => {
    if (!key) return;
    if (!aliases.has(key)) aliases.set(key, canon);
  };
  for (const sp of speakers) {
    const canon = sp.id;
    add(canon, canon);
    add(canon.toLowerCase(), canon);
    add(slugifyHandle(canon), canon);
    const bare = sp.name.replace(/^@/, '').trim();
    if (bare) {
      add(bare, canon);
      add(bare.toLowerCase(), canon);
      add(slugifyHandle(bare), canon);
    }
  }
  return aliases;
}

/** Align timeline speakerId with roster ids (exact aliases + fuzzy handle prefix). */
function reconcileSegmentSpeakerIds(segments: SpeakerSegment[], speakers: Speaker[]): SpeakerSegment[] {
  const parts = speakersToParticipants(speakers);
  const aliases = buildSpeakerIdAliasMap(speakers);
  return segments.map((seg) => {
    const fast =
      aliases.get(seg.speakerId) ??
      aliases.get(seg.speakerId.toLowerCase()) ??
      aliases.get(slugifyHandle(seg.speakerId));
    if (fast) return { ...seg, speakerId: fast };
    const fuzzy = resolveRawSpeakerKeyToParticipantId(seg.speakerId, parts);
    return { ...seg, speakerId: fuzzy ?? seg.speakerId };
  });
}

function mergeParticipantsWithTimelineSegments(
  participants: SpaceParticipant[],
  segments: Array<{ speaker_id: string }>
): SpaceParticipant[] {
  const out = [...participants];
  const seen = new Set(out.map((p) => p.id));
  for (const seg of segments) {
    const canon = resolveRawSpeakerKeyToParticipantId(seg.speaker_id, out);
    const eff = canon ?? seg.speaker_id;
    if (seen.has(eff)) continue;
    seen.add(eff);
    if (canon) continue;
    out.push({
      id: eff,
      name: `Speaker ${eff}`,
      avatar_url: null,
      role: 'unknown',
    });
  }
  return out;
}

/** Rewrite segment speaker_id to roster ids before merge (avoids phantom grid rows). */
function normalizeSyncedSegmentSpeakerIds(
  segments: Array<{ id: string; speaker_id: string; start: number; end: number }>,
  participants: SpaceParticipant[]
): void {
  for (const seg of segments) {
    const canon = resolveRawSpeakerKeyToParticipantId(seg.speaker_id, participants);
    if (canon) seg.speaker_id = canon;
  }
}

async function syncSpeakers() {
  if (!props.audio?.source_url || syncingSpeakers.value) return;
  syncingSpeakers.value = true;
  try {
    const metadataBeforeSync = props.audio
      ? await getDownloadedSpaceMetadata(props.audio.id)
      : null;
    const participantsBeforeSync = parseSpaceParticipants(metadataBeforeSync?.participants_json ?? null);

    const info = await getTwitterBroadcastInfo(props.audio.source_url);
    if (info.error) {
      console.warn('[SpaceStudio] Sync Speakers skipped (fetch failed); keeping saved roster:', info.error);
      await initializeSpaceData();
      return;
    }

    let participants: SpaceParticipant[] = (info.participants || []).map((participant) => ({
      id: participant.id,
      name: participant.name,
      avatar_url: participant.avatarUrl || null,
      role: normalizeSpaceRole(participant.role),
    }));

    const totalDuration = duration.value || props.audio.duration || 0;
    // Only on-stage participants contribute to the talking timeline seed.
    const onStage = participants.filter((p) => p.role === 'host' || p.role === 'speaker' || p.role === 'unknown');
    const rosterForSeed = onStage.map((participant) => ({
      id: participant.id,
      name: participant.name,
      role: participant.role,
      avatarUrl:
        participant.avatar_url ||
        `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(participant.id)}`,
    }));

    let syncedSegments = buildSpeakerSegments(rosterForSeed, totalDuration || 3600).map(
      (segment) => ({
        id: segment.id,
        speaker_id: segment.speakerId,
        start: segment.start,
        end: segment.end,
      })
    );

    let hlsStageSnapshots: SpaceStageSnapshot[] | undefined;

    // ── Priority 1: X API speaker timeline (accurate) ──
    if (info.speakerTimeline && info.speakerTimeline.length > 0) {
      console.log(`[SpaceStudio] Sync using X API speaker timeline (${info.speakerTimeline.length} segments)`);
      syncedSegments = info.speakerTimeline.map((seg) => ({
        id: seg.id,
        speaker_id: seg.speakerId,
        start: seg.start,
        end: seg.end,
      }));
      normalizeSyncedSegmentSpeakerIds(syncedSegments, participants);
      participants = mergeParticipantsWithTimelineSegments(participants, syncedSegments);
    } else if (info.manifestUrl && totalDuration > 0) {
      // ── Priority 2: HLS ID3 metadata (fallback) ──
      try {
        const hls = await extractSpaceSpeakerTimelineFromHls(
          info.manifestUrl,
          totalDuration
        );
        hlsStageSnapshots = (hls.stageSnapshots ?? []).map((s) => ({
          id: s.id,
          t: s.t,
          on_stage_user_ids: s.onStageUserIds ?? [],
        }));

        if (hls.speakerSegments.length > 0) {
          syncedSegments = hls.speakerSegments.map((seg) => ({
            id: seg.id,
            speaker_id: seg.speakerId,
            start: seg.start,
            end: seg.end,
          }));
          normalizeSyncedSegmentSpeakerIds(syncedSegments, participants);
          participants = mergeParticipantsWithTimelineSegments(participants, syncedSegments);
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

    const participantRoster = participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      avatarUrl:
        participant.avatar_url ||
        `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(participant.id)}`,
    }));
    const uiRoster = participantRoster;
    const uiParticipants = uiRoster.map((speaker) => ({
      id: speaker.id,
      name: speaker.name,
      avatar_url: speaker.avatarUrl || null,
      role: normalizeSpaceRole(participants.find((p) => p.id === speaker.id)?.role),
    }));

    if (uiParticipants.length === 0 && participantsBeforeSync.length > 0) {
      console.warn(
        '[SpaceStudio] Sync produced no participants; refusing to overwrite saved metadata.'
      );
      await initializeSpaceData();
      return;
    }

    await upsertDownloadedSpaceMetadata({
      audioId: props.audio.id,
      sourceUrl: props.audio.source_url || undefined,
      title: info.title || props.audio.title,
      participants: uiParticipants,
      speakerSegments: syncedSegments,
      ...(hlsStageSnapshots !== undefined ? { stageSnapshots: hlsStageSnapshots } : {}),
    });

    await initializeSpaceData();
  } finally {
    syncingSpeakers.value = false;
  }
}

async function dumpId3Debug() {
  if (!props.audio?.source_url || dumpingId3.value) return;
  dumpingId3.value = true;
  try {
    const info = await getTwitterBroadcastInfo(props.audio.source_url);
    if (!info.manifestUrl) {
      console.error('[SpaceStudio] No manifestUrl available for ID3 dump');
      return;
    }
    console.log('[SpaceStudio] Dumping ID3 debug from:', info.manifestUrl);
    const lines = await invoke<string[]>('dump_hls_id3_debug', {
      manifestUrl: info.manifestUrl,
      nSegments: 20,
    });
    console.group('[SpaceStudio] === ID3 DEBUG DUMP (first 20 segments) ===');
    for (const line of lines) {
      console.log(line);
    }
    console.groupEnd();
  } catch (e) {
    console.error('[SpaceStudio] ID3 dump failed:', e);
  } finally {
    dumpingId3.value = false;
  }
}

async function assignSegmentSpeaker(segmentId: string) {
  if (!selectedSpeakerId.value || !props.audio) return;
  const index = speakerSegments.value.findIndex((segment) => segment.id === segmentId);
  if (index < 0) return;

  speakerSegments.value[index] = {
    ...speakerSegments.value[index],
    speakerId: selectedSpeakerId.value,
  };
  speakerSegments.value = [...speakerSegments.value];

  await persistCurrentMetadata();
}

async function persistCurrentMetadata() {
  if (!props.audio) return;
  await upsertDownloadedSpaceMetadata({
    audioId: props.audio.id,
    sourceUrl: props.audio.source_url || undefined,
    title: props.audio.title,
    participants: speakers.value.map((speaker) => ({
      id: speaker.id,
      name: speaker.name,
      avatar_url: speaker.avatarUrl || null,
      role: speaker.role === 'listener' ? 'listener' : speaker.role,
    })),
    speakerSegments: speakerSegments.value.map((segment) => ({
      id: segment.id,
      speaker_id: segment.speakerId,
      start: segment.start,
      end: segment.end,
    })),
    stageSnapshots: stageSnapshots.value,
  });
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
  width: min(1200px, 96vw);
  max-height: 92vh;
  overflow: hidden;
  border: 1px solid var(--sidebar-border);
  border-radius: 14px;
  background: var(--sidebar-surface);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
}

.space-studio__accent {
  height: 3px;
  background: linear-gradient(90deg, #22d3ee, rgba(34, 211, 238, 0.5));
}

.space-studio__header {
  position: relative;
  padding: 1.1rem 1.2rem 1rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.space-studio__close {
  position: absolute;
  right: 0.9rem;
  top: 0.9rem;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: none;
  color: var(--sidebar-text-muted);
  background: transparent;
  cursor: pointer;
}

.space-studio__close:hover {
  background: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.space-studio__title {
  margin: 0;
  font-size: 1.1rem;
  color: var(--sidebar-text);
}

.space-studio__subtitle {
  margin: 0.3rem 0 0;
  color: var(--sidebar-text-muted);
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 85%;
}

.space-studio__content {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 1rem;
  padding: 1rem;
  max-height: calc(92vh - 110px);
}

.space-studio__left,
.space-studio__right {
  min-height: 0;
  overflow-y: auto;
}

.space-studio__player-wrap {
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  padding: 0.9rem;
  background: rgba(0, 0, 0, 0.2);
}

.space-studio__player {
  width: 100%;
}

.space-studio__timeline {
  margin-top: 1rem;
}

.space-studio__timeline-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.73rem;
  color: var(--sidebar-text-muted);
  margin-bottom: 0.35rem;
}

.space-studio__timeline-track {
  position: relative;
  width: 100%;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--sidebar-border);
  background: rgba(9, 9, 11, 0.7);
  overflow: hidden;
}

.space-studio__segment {
  position: absolute;
  top: 4px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: background-color 120ms ease;
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

.space-studio__hint {
  font-size: 0.7rem;
  color: var(--sidebar-text-muted);
  margin-bottom: 0.75rem;
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.space-studio__grid--listeners {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.5rem;
}

.space-studio__speaker {
  text-align: center;
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

.space-studio__avatar-wrap {
  width: 64px;
  height: 64px;
  margin: 0 auto 0.4rem;
  border-radius: 999px;
  padding: 2px;
  border: 2px solid rgba(82, 82, 91, 0.8);
  box-shadow: 0 0 0 rgba(34, 211, 238, 0);
  transition: all 120ms ease;
}

.space-studio__avatar-wrap--active {
  border-color: #22d3ee;
  box-shadow:
    0 0 0 4px rgba(34, 211, 238, 0.22),
    0 0 22px rgba(34, 211, 238, 0.72);
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

.space-studio__avatar-wrap--offstage.space-studio__avatar-wrap--active {
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

.space-studio__speaker-name {
  font-size: 0.7rem;
  color: var(--sidebar-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
}
</style>

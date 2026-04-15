<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open && audio" class="xs" @click.self="emit('close')">
        <div class="xs__card">
          <!-- Top bar -->
          <div class="xs__topbar">
            <div class="xs__badge">REPLAY</div>
            <button class="xs__close" @click="emit('close')" title="Close">
              <X :size="18" />
            </button>
          </div>

          <!-- Title -->
          <h2 class="xs__title">{{ audio.title }}</h2>

          <!-- Speaker grid -->
          <div class="xs__speakers">
            <TransitionGroup name="speaker-fade">
              <div
                v-for="speaker in onStageParticipants"
                :key="speaker.id"
                class="xs__speaker"
                :class="{ 'xs__speaker--offstage': onStageUserIdsAtPlayhead !== null && !onStageUserIdsAtPlayhead.has(speaker.id) }"
                @click="selectedSpeakerId = speaker.id"
              >
                <div
                  class="xs__ring"
                  :class="{
                    'xs__ring--talking': activeSpeakerIds.has(speaker.id),
                    // Avoid stacking two cyan glows when the selected row is also the active talker.
                    'xs__ring--selected':
                      selectedSpeakerId === speaker.id && !activeSpeakerIds.has(speaker.id),
                  }"
                  :style="activeSpeakerIds.has(speaker.id) ? { '--ring-color': speakerColor(speaker.id) } : {}"
                >
                  <img
                    :src="speaker.avatarUrl"
                    :alt="speaker.name"
                    class="xs__avatar"
                    @error="(e: Event) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(speaker.id)}` }"
                  />
                </div>
                <span class="xs__name" :title="speaker.name">{{ speaker.name }}</span>
                <span class="xs__role" :class="speaker.role === 'host' ? 'xs__role--host' : ''">
                  {{ speaker.role === 'host' ? 'Host' : 'Speaker' }}
                </span>
              </div>
            </TransitionGroup>
          </div>

          <!-- Listeners row -->
          <div v-if="listenerParticipants.length > 0" class="xs__listeners">
            <span class="xs__listeners-label">{{ listenerParticipants.length }} listening</span>
            <div class="xs__listeners-row">
              <img
                v-for="listener in listenerParticipants.slice(0, 12)"
                :key="listener.id"
                :src="listener.avatarUrl"
                :alt="listener.name"
                :title="listener.name"
                class="xs__listener-avatar"
                @error="(e: Event) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(listener.id)}` }"
              />
              <span v-if="listenerParticipants.length > 12" class="xs__listener-more">
                +{{ listenerParticipants.length - 12 }}
              </span>
            </div>
          </div>

          <!-- Speaker timeline -->
          <div class="xs__timeline">
            <div class="xs__timeline-bar" ref="timelineBarRef" @click="seekTimeline">
              <div
                v-for="segment in speakerSegments"
                :key="segment.id"
                class="xs__seg"
                :class="{ 'xs__seg--editable': !!selectedSpeakerId }"
                :style="timelineSegmentStyle(segment)"
                :title="speakerNameById(segment.speakerId)"
                @click.stop="selectedSpeakerId ? assignSegmentSpeaker(segment.id) : seekTimeline($event)"
              />
              <div class="xs__playhead" :style="{ left: `${playheadPercent}%` }"></div>
            </div>
          </div>

          <!-- Audio player -->
          <audio
            ref="audioRef"
            :src="audioSrc"
            @timeupdate="handleTimeUpdate"
            @loadedmetadata="handleLoadedMetadata"
            @play="isPlaying = true"
            @pause="isPlaying = false"
            style="display:none"
          />

          <!-- Custom controls -->
          <div class="xs__controls">
            <button class="xs__play" @click="togglePlay">
              <svg v-if="!isPlaying" viewBox="0 0 24 24" fill="currentColor" class="xs__play-icon"><path d="M8 5v14l11-7z"/></svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor" class="xs__play-icon"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <span class="xs__time">{{ formatTime(currentTime) }}</span>
            <div class="xs__seek" @click="seekFromBar">
              <div class="xs__seek-bg"></div>
              <div class="xs__seek-fill" :style="{ width: `${playheadPercent}%` }"></div>
            </div>
            <span class="xs__time">{{ formatTime(duration) }}</span>
          </div>

          <!-- Actions -->
          <div class="xs__actions">
            <button class="xs__btn" @click="setClipStart">In</button>
            <button class="xs__btn" @click="setClipEnd">Out</button>
            <span class="xs__clip-range">{{ formatTime(clipStart) }} – {{ formatTime(clipEnd) }}</span>
            <button class="xs__btn xs__btn--accent" @click="createManualClip">Clip</button>
            <button class="xs__btn xs__btn--accent" @click="createAiClipSuggestions">AI Clips</button>
            <div class="xs__spacer"></div>
            <button class="xs__btn" :disabled="syncingSpeakers" @click="syncSpeakers">
              {{ syncingSpeakers ? 'Syncing…' : 'Sync' }}
            </button>
            <button class="xs__btn xs__btn--accent" @click="openAiVideo">AI Video</button>
            <button class="xs__btn xs__btn--accent" @click="openEditorMp4">Editor</button>
          </div>

          <!-- AI Suggestions -->
          <div v-if="aiSuggestions.length > 0" class="xs__suggestions">
            <button
              v-for="suggestion in aiSuggestions"
              :key="suggestion.id"
              class="xs__suggestion-btn"
              @click="seekToSuggestion(suggestion)"
            >
              <span>{{ suggestion.label }}</span>
              <span class="xs__suggestion-time">{{ formatTime(suggestion.start) }} – {{ formatTime(suggestion.end) }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, TransitionGroup } from 'vue';
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
  clearTwitterBroadcastInfoCache,
  extractSpaceSpeakerTimelineFromHls,
  getTwitterBroadcastInfo,
} from '@/services/twitter';

const SPEAKER_PALETTE = [
  '#22d3ee', '#0ea5e9', '#00BA7C', '#F91880',
  '#FFD400', '#FF7A00', '#E23636', '#00D5CD',
  '#34D399', '#5B8DEF', '#A78BFA', '#FB7185',
];

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
const timelineBarRef = ref<HTMLDivElement | null>(null);
const currentTime = ref(0);
const duration = ref(0);
const clipStart = ref(0);
const clipEnd = ref(30);
const isPlaying = ref(false);
const activeSpeakerIds = ref<Set<string>>(new Set());
const aiSuggestions = ref<ClipSuggestion[]>([]);
const syncingSpeakers = ref(false);
const dumpingId3 = ref(false);
const selectedSpeakerId = ref<string | null>(null);

const speakers = ref<Speaker[]>([]);
const speakerSegments = ref<SpeakerSegment[]>([]);
const stageSnapshots = ref<SpaceStageSnapshot[]>([]);

const speakerColorMap = computed(() => {
  const map = new Map<string, string>();
  const onStage = speakers.value.filter(s => s.role !== 'listener');
  onStage.forEach((s, i) => map.set(s.id, SPEAKER_PALETTE[i % SPEAKER_PALETTE.length]));
  return map;
});

function speakerColor(id: string): string {
  return speakerColorMap.value.get(id) ?? SPEAKER_PALETTE[0];
}

function speakerNameById(id: string): string {
  return speakers.value.find(s => s.id === id)?.name ?? id;
}

function togglePlay() {
  if (!audioRef.value) return;
  if (audioRef.value.paused) audioRef.value.play();
  else audioRef.value.pause();
}

function seekTimeline(e: MouseEvent) {
  const bar = timelineBarRef.value;
  if (!bar || !audioRef.value || !duration.value) return;
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audioRef.value.currentTime = pct * duration.value;
}

function seekFromBar(e: MouseEvent) {
  const target = (e.currentTarget as HTMLElement);
  if (!target || !audioRef.value || !duration.value) return;
  const rect = target.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audioRef.value.currentTime = pct * duration.value;
}

function timelineSegmentStyle(segment: SpeakerSegment) {
  const total = duration.value || 1;
  const left = (segment.start / total) * 100;
  const width = ((segment.end - segment.start) / total) * 100;
  const color = speakerColor(segment.speakerId);
  const t = currentTime.value;
  const active = t >= segment.start && t <= segment.end;
  return {
    left: `${left}%`,
    width: `${Math.max(0.15, width)}%`,
    background: active ? color : `${color}44`,
    boxShadow: active ? `0 0 8px ${color}88` : 'none',
  };
}

let rafId = 0;
function startRaf() {
  const tick = () => {
    if (audioRef.value && !audioRef.value.paused) {
      currentTime.value = audioRef.value.currentTime;
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}
function stopRaf() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

watch(isPlaying, (playing) => {
  if (playing) startRaf();
  else stopRaf();
});

onBeforeUnmount(() => stopRaf());

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
  const hits = speakerSegments.value.filter(
    (segment) => time >= segment.start && time <= segment.end
  );
  if (hits.length === 0) {
    activeSpeakerIds.value = new Set();
    return;
  }
  // One avatar lit at a time (like X). Overlapping segments from bad/stale data otherwise
  // highlight multiple people; prefer the segment that started most recently at this playhead.
  hits.sort((a, b) => {
    if (b.start !== a.start) return b.start - a.start;
    const spanA = a.end - a.start;
    const spanB = b.end - b.start;
    return spanA - spanB;
  });
  activeSpeakerIds.value = new Set([hits[0].speakerId]);
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
    speakerSegments.value = [];
    // Auto-sync to fetch real speaker data (HLS ID3) when none is saved yet
    if (props.audio?.source_url && !syncingSpeakers.value) {
      console.log('[SpaceStudio] No saved speaker segments — auto-syncing for real data');
      syncSpeakers();
    }
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
  return timelineSegmentStyle(segment);
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
    clearTwitterBroadcastInfoCache();
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

    // Start empty — only fill from REAL data sources (never fabricate).
    let syncedSegments: Array<{ id: string; speaker_id: string; start: number; end: number }> = [];
    let hlsStageSnapshots: SpaceStageSnapshot[] | undefined;

    // Priority 1: X API speaker timeline from Periscope speaking events (most accurate)
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
    }

    // Priority 2: HLS ID3 extraction — real metadata embedded in the stream
    if (info.manifestUrl && totalDuration > 0) {
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

        if (syncedSegments.length === 0 && hls.speakerSegments.length > 0) {
          console.log(`[SpaceStudio] Using HLS ID3 speaker segments (${hls.speakerSegments.length} segments)`);
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

    // Priority 3: Speaker diarization — analyze the downloaded audio with pyannote
    if (syncedSegments.length === 0 && props.audio?.file_path && props.audio?.source_url) {
      console.log('[SpaceStudio] No API/HLS speaker data — running diarization on downloaded audio...');
      try {
        const metaJson: string = await invoke('diarize_space_audio', {
          downloadId: props.audio.id,
          audioPath: props.audio.file_path,
          spaceUrl: props.audio.source_url,
        });
        const diarizedMeta = JSON.parse(metaJson);
        if (Array.isArray(diarizedMeta.speakerTimeline) && diarizedMeta.speakerTimeline.length > 0) {
          console.log(`[SpaceStudio] Diarization produced ${diarizedMeta.speakerTimeline.length} segments`);
          syncedSegments = diarizedMeta.speakerTimeline.map((seg: any, i: number) => ({
            id: seg.id ?? `dz-${i}`,
            speaker_id: seg.speakerId ?? seg.speaker_id ?? '',
            start: Number(seg.start ?? 0),
            end: Number(seg.end ?? 0),
          }));
          normalizeSyncedSegmentSpeakerIds(syncedSegments, participants);
          participants = mergeParticipantsWithTimelineSegments(participants, syncedSegments);
        }
      } catch (diarizeErr) {
        console.warn('[SpaceStudio] Diarization failed:', diarizeErr);
      }
    }

    if (syncedSegments.length === 0) {
      console.warn('[SpaceStudio] No speaker data from any source (API, HLS, diarization)');
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
/* ── X Spaces Replay ── */
.xs {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
}

.xs__card {
  width: min(680px, 94vw);
  max-height: 94vh;
  overflow-y: auto;
  border-radius: 24px;
  background: linear-gradient(165deg, #0c1a1f 0%, #0a0e12 40%, #090b0e 100%);
  border: 1px solid rgba(34, 211, 238, 0.10);
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), 0 0 120px rgba(34, 211, 238, 0.04);
  padding: 1.5rem 1.8rem 1.2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Top bar */
.xs__topbar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}

.xs__badge {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #67e8f9;
  background: rgba(34, 211, 238, 0.12);
  border: 1px solid rgba(34, 211, 238, 0.25);
  border-radius: 6px;
  padding: 2px 10px;
}

.xs__close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 150ms;
}
.xs__close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

/* Title */
.xs__title {
  margin: 0 0 1.4rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: #e8f0f6;
  text-align: center;
  line-height: 1.4;
  max-width: 90%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Speaker grid ── */
.xs__speakers {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.2rem 1.6rem;
  margin-bottom: 1rem;
  min-height: 100px;
}

.xs__speaker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  transition: opacity 300ms ease, transform 300ms ease;
}
.xs__speaker--offstage {
  opacity: 0.3;
  filter: grayscale(0.4);
}

/* Avatar ring — idle */
.xs__ring {
  --ring-color: #22d3ee;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  padding: 3px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  transition: border-color 200ms ease, box-shadow 200ms ease;
  position: relative;
}

/* Avatar ring — talking (pulsing glow) */
.xs__ring--talking {
  border-color: var(--ring-color);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--ring-color) 25%, transparent),
    0 0 28px color-mix(in srgb, var(--ring-color) 55%, transparent);
  animation: xs-pulse 1.8s ease-in-out infinite;
}

/* Avatar ring — selected for reassignment */
.xs__ring--selected {
  border-color: #5eead4;
  box-shadow: 0 0 0 3px rgba(94, 234, 212, 0.25), 0 0 16px rgba(94, 234, 212, 0.35);
}

@keyframes xs-pulse {
  0%, 100% {
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--ring-color) 25%, transparent),
      0 0 28px color-mix(in srgb, var(--ring-color) 55%, transparent);
  }
  50% {
    box-shadow:
      0 0 0 8px color-mix(in srgb, var(--ring-color) 18%, transparent),
      0 0 44px color-mix(in srgb, var(--ring-color) 70%, transparent);
  }
}

.xs__avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background: #1a1a24;
}

.xs__name {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.85);
  max-width: 80px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.xs__role {
  font-size: 0.55rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(103, 232, 249, 0.65);
  text-transform: uppercase;
}
.xs__role--host {
  color: #fbbf24;
}

/* ── Listeners ── */
.xs__listeners {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1rem;
  padding: 0.5rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.xs__listeners-label {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
}

.xs__listeners-row {
  display: flex;
  align-items: center;
  gap: -4px;
}

.xs__listener-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #0d0d14;
  margin-left: -6px;
  background: #1a1a24;
}
.xs__listener-avatar:first-child { margin-left: 0; }

.xs__listener-more {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.3);
  margin-left: 4px;
}

/* ── Timeline ── */
.xs__timeline {
  width: 100%;
  margin-bottom: 0.6rem;
}

.xs__timeline-bar {
  position: relative;
  width: 100%;
  height: 28px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  cursor: pointer;
}

.xs__seg {
  position: absolute;
  top: 3px;
  height: 20px;
  border-radius: 4px;
  transition: background 100ms ease, box-shadow 100ms ease;
}
.xs__seg--editable {
  cursor: pointer;
}

.xs__playhead {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  background: #fff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
  z-index: 2;
  pointer-events: none;
}

/* ── Custom controls ── */
.xs__controls {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.8rem;
}

.xs__play {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: #0ea5e9;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 150ms;
}
.xs__play:hover { background: #22b8cf; }

.xs__play-icon {
  width: 20px;
  height: 20px;
}

.xs__time {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.45);
  font-variant-numeric: tabular-nums;
  min-width: 36px;
  flex-shrink: 0;
}

.xs__seek {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  position: relative;
  cursor: pointer;
}

.xs__seek-bg {
  position: absolute;
  inset: 0;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
}

.xs__seek-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 3px;
  background: #0ea5e9;
  transition: width 80ms linear;
}

/* ── Actions ── */
.xs__actions {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.xs__spacer { flex: 1; }

.xs__clip-range {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.35);
  margin: 0 0.3rem;
  font-variant-numeric: tabular-nums;
}

.xs__btn {
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.35rem 0.65rem;
  font-size: 0.68rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.65);
  cursor: pointer;
  transition: background 120ms, border-color 120ms;
}
.xs__btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}
.xs__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.xs__btn--accent {
  background: rgba(34, 211, 238, 0.10);
  border-color: rgba(34, 211, 238, 0.25);
  color: #67e8f9;
}
.xs__btn--accent:hover {
  background: rgba(34, 211, 238, 0.18);
  border-color: rgba(34, 211, 238, 0.4);
}

/* ── Suggestions ── */
.xs__suggestions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.xs__suggestion-btn {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.7rem;
  cursor: pointer;
  transition: border-color 120ms;
}
.xs__suggestion-btn:hover {
  border-color: rgba(34, 211, 238, 0.35);
}

.xs__suggestion-time {
  color: rgba(255, 255, 255, 0.35);
  font-variant-numeric: tabular-nums;
}

/* ── Transitions ── */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.speaker-fade-enter-active {
  transition: opacity 400ms ease, transform 400ms ease;
}
.speaker-fade-leave-active {
  transition: opacity 250ms ease, transform 250ms ease;
}
.speaker-fade-enter-from {
  opacity: 0;
  transform: scale(0.8);
}
.speaker-fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>

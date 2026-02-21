<template>
  <div class="scene-plan">
    <div class="scene-plan__header">
      <Film :size="14" />
      <span>Scene Plan</span>
      <span class="scene-plan__count">{{ scenes.length }} scenes</span>
    </div>
    <div class="scene-plan__list">
      <div
        v-for="(scene, i) in localScenes"
        :key="i"
        class="scene-card"
        :class="{
          'scene-card--approved': scene._status === 'approved',
          'scene-card--editing': scene._status === 'editing',
          'scene-card--removed': scene._status === 'removed',
        }"
      >
        <div class="scene-card__top">
          <div class="scene-card__num">{{ i + 1 }}</div>
          <div class="scene-card__time">{{ formatTime(scene.startTime) }} — {{ formatTime(scene.endTime) }}</div>
          <span class="scene-card__mood" :class="`mood--${scene.mood}`">{{ scene.mood }}</span>
        </div>

        <template v-if="scene._status === 'editing'">
          <textarea
            v-model="scene._editDescription"
            class="scene-card__edit-area"
            rows="2"
            placeholder="Describe this scene..."
          />
          <div class="scene-card__edit-actions">
            <button class="sc-btn sc-btn--sm" @click="cancelEditScene(i)">Cancel</button>
            <button class="sc-btn sc-btn--sm sc-btn--primary" @click="saveEditScene(i)">Save</button>
          </div>
        </template>
        <template v-else-if="scene._status !== 'removed'">
          <div class="scene-card__desc">{{ scene.description }}</div>
          <div v-if="scene.transcriptSegment" class="scene-card__transcript">
            "{{ scene.transcriptSegment }}"
          </div>
          <div v-if="scene.effects.length" class="scene-card__effects">
            <span v-for="fx in scene.effects" :key="fx" class="scene-card__fx-tag">{{ fx }}</span>
          </div>
          <div class="scene-card__actions">
            <button class="sc-btn sc-btn--approve" @click="approveScene(i)" :disabled="scene._status === 'approved'">
              <Check :size="12" />
              {{ scene._status === 'approved' ? 'Approved' : 'Approve' }}
            </button>
            <button class="sc-btn" @click="startEditScene(i)">
              <Pencil :size="12" />
              Edit
            </button>
            <button class="sc-btn sc-btn--danger" @click="removeScene(i)">
              <Trash2 :size="12" />
            </button>
          </div>
        </template>
        <template v-else>
          <div class="scene-card__removed-label">Removed</div>
          <button class="sc-btn sc-btn--sm" @click="restoreScene(i)">Undo</button>
        </template>
      </div>
    </div>
    <div class="scene-plan__footer">
      <button class="sp-btn sp-btn--secondary" @click="approveAll">
        <CheckCheck :size="14" />
        Approve All
      </button>
      <button class="sp-btn sp-btn--primary" @click="confirmPlan">
        <Wand2 :size="14" />
        Confirm Plan
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Film, Check, CheckCheck, Pencil, Trash2, Wand2 } from 'lucide-vue-next';
import type { ProposedScene } from '@/types/ai-video';

interface LocalScene extends ProposedScene {
  _status: 'pending' | 'approved' | 'editing' | 'removed';
  _editDescription: string;
}

const props = defineProps<{
  scenes: ProposedScene[];
}>();

const emit = defineEmits<{
  confirm: [scenes: ProposedScene[]];
  requestChanges: [feedback: string];
}>();

const localScenes = ref<LocalScene[]>([]);

watch(() => props.scenes, (val) => {
  localScenes.value = val.map(s => ({
    ...s,
    _status: 'pending' as const,
    _editDescription: s.description,
  }));
}, { immediate: true });

function approveScene(i: number) {
  localScenes.value[i]._status = 'approved';
}

function startEditScene(i: number) {
  localScenes.value[i]._editDescription = localScenes.value[i].description;
  localScenes.value[i]._status = 'editing';
}

function cancelEditScene(i: number) {
  localScenes.value[i]._status = 'pending';
}

function saveEditScene(i: number) {
  localScenes.value[i].description = localScenes.value[i]._editDescription;
  localScenes.value[i]._status = 'approved';
}

function removeScene(i: number) {
  localScenes.value[i]._status = 'removed';
}

function restoreScene(i: number) {
  localScenes.value[i]._status = 'pending';
}

function approveAll() {
  localScenes.value.forEach(s => {
    if (s._status !== 'removed') s._status = 'approved';
  });
}

function confirmPlan() {
  const approved = localScenes.value
    .filter(s => s._status !== 'removed')
    .map(({ _status, _editDescription, ...scene }) => scene);
  emit('confirm', approved);
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.scene-plan {
  background: rgba(34, 197, 94, 0.04);
  border: 1px solid rgba(34, 197, 94, 0.15);
  border-radius: 10px;
  overflow: hidden;
  margin: 6px 0;
}

.scene-plan__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #4ade80;
  border-bottom: 1px solid rgba(34, 197, 94, 0.1);
}

.scene-plan__count {
  margin-left: auto;
  font-size: 10px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.35);
}

.scene-plan__list {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 360px;
  overflow-y: auto;
}

.scene-card {
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  transition: all 0.15s;
}

.scene-card--approved {
  border-color: rgba(34, 197, 94, 0.2);
  background: rgba(34, 197, 94, 0.04);
}

.scene-card--removed {
  opacity: 0.4;
}

.scene-card__top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.scene-card__num {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

.scene-card__time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  font-variant-numeric: tabular-nums;
}

.scene-card__mood {
  margin-left: auto;
  font-size: 9px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mood--hype { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.mood--calm { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.mood--dramatic { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
.mood--fun { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.mood--professional { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
.mood--cinematic { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
.mood--energetic { background: rgba(249, 115, 22, 0.15); color: #fb923c; }

.scene-card__desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.4;
  margin-bottom: 4px;
}

.scene-card__transcript {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  font-style: italic;
  line-height: 1.3;
  margin-bottom: 4px;
}

.scene-card__effects {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-bottom: 6px;
}

.scene-card__fx-tag {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
}

.scene-card__actions {
  display: flex;
  gap: 4px;
}

.scene-card__edit-area {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  padding: 6px;
  resize: vertical;
  font-family: inherit;
  margin-bottom: 4px;
}

.scene-card__edit-area:focus {
  outline: none;
  border-color: #22c55e;
}

.scene-card__edit-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.scene-card__removed-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  font-style: italic;
  margin-bottom: 4px;
}

.sc-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border: none;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s;
}

.sc-btn:hover { background: rgba(255, 255, 255, 0.1); }

.sc-btn--sm { font-size: 10px; padding: 2px 6px; }

.sc-btn--primary {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.sc-btn--primary:hover { background: rgba(34, 197, 94, 0.25); }

.sc-btn--approve {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
}

.sc-btn--approve:hover { background: rgba(34, 197, 94, 0.2); }
.sc-btn--approve:disabled { opacity: 0.5; cursor: default; }

.sc-btn--danger {
  color: rgba(248, 113, 113, 0.6);
}

.sc-btn--danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
}

.scene-plan__footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid rgba(34, 197, 94, 0.08);
}

.sp-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.sp-btn--primary {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.sp-btn--primary:hover { background: rgba(34, 197, 94, 0.3); }

.sp-btn--secondary {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
}

.sp-btn--secondary:hover { background: rgba(255, 255, 255, 0.1); }
</style>

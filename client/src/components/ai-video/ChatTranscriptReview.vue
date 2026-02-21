<template>
  <div class="transcript-review">
    <div class="transcript-review__header">
      <FileText :size="14" />
      <span>Video Transcript</span>
      <span class="transcript-review__meta">{{ wordCount }} words</span>
    </div>
    <div class="transcript-review__body">
      <textarea
        v-if="isEditing"
        ref="textareaRef"
        v-model="editText"
        class="transcript-review__textarea"
        rows="6"
        placeholder="Transcript text..."
      />
      <div v-else class="transcript-review__text">{{ transcript }}</div>
    </div>
    <div class="transcript-review__actions">
      <template v-if="isEditing">
        <button class="tr-btn tr-btn--secondary" @click="cancelEdit">Cancel</button>
        <button class="tr-btn tr-btn--primary" @click="saveEdit">
          <Check :size="14" />
          Save & Continue
        </button>
      </template>
      <template v-else>
        <button class="tr-btn tr-btn--secondary" @click="startEdit">
          <Pencil :size="14" />
          Edit
        </button>
        <button class="tr-btn tr-btn--primary" @click="$emit('confirm')">
          <Check :size="14" />
          Looks Good
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { FileText, Pencil, Check } from 'lucide-vue-next';

const props = defineProps<{
  transcript: string;
}>();

const emit = defineEmits<{
  confirm: [];
  edit: [text: string];
}>();

const isEditing = ref(false);
const editText = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const wordCount = computed(() => {
  const text = isEditing.value ? editText.value : props.transcript;
  return text.trim().split(/\s+/).filter(Boolean).length;
});

function startEdit() {
  editText.value = props.transcript;
  isEditing.value = true;
  nextTick(() => textareaRef.value?.focus());
}

function cancelEdit() {
  isEditing.value = false;
  editText.value = '';
}

function saveEdit() {
  emit('edit', editText.value);
  isEditing.value = false;
}
</script>

<style scoped>
.transcript-review {
  background: rgba(14, 165, 233, 0.06);
  border: 1px solid rgba(14, 165, 233, 0.15);
  border-radius: 10px;
  overflow: hidden;
  margin: 6px 0;
}

.transcript-review__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #38bdf8;
  border-bottom: 1px solid rgba(14, 165, 233, 0.1);
}

.transcript-review__meta {
  margin-left: auto;
  font-size: 10px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.35);
}

.transcript-review__body {
  padding: 10px 12px;
}

.transcript-review__text {
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.75);
  max-height: 160px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.transcript-review__textarea {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(14, 165, 233, 0.2);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  line-height: 1.6;
  padding: 8px;
  resize: vertical;
  font-family: inherit;
}

.transcript-review__textarea:focus {
  outline: none;
  border-color: #0ea5e9;
}

.transcript-review__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid rgba(14, 165, 233, 0.08);
}

.tr-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.tr-btn--primary {
  background: rgba(14, 165, 233, 0.2);
  color: #38bdf8;
}

.tr-btn--primary:hover {
  background: rgba(14, 165, 233, 0.3);
}

.tr-btn--secondary {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
}

.tr-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>

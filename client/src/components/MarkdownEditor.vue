<template>
  <div class="markdown-editor-wrapper">
    <div class="flex items-center justify-between mb-2">
      <label v-if="label" class="block text-sm font-medium text-foreground">
        {{ label }}
        <span v-if="required" class="text-red-500 ml-1">*</span>
      </label>
      <div class="flex items-center gap-3">
        <span class="text-xs text-muted-foreground">{{ characterCount }} characters</span>
        <span class="text-xs text-muted-foreground">≈ {{ wordCount }} words</span>
      </div>
    </div>
    
    <MdEditor
      v-model="content"
      :language="'en-US'"
      :theme="theme"
      :preview-theme="'github'"
      :code-theme="'github'"
      :toolbars="toolbars"
      :toolbars-exclude="['github']"
      :placeholder="placeholder"
      :style="{ height: height }"
      @on-blur="handleBlur"
    />
    
    <p v-if="error" class="text-xs text-red-500 flex items-center gap-1.5 mt-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { MdEditor, type ToolbarNames } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'

interface Props {
  modelValue: string
  label?: string
  required?: boolean
  placeholder?: string
  error?: string
  height?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'blur'): void
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  required: false,
  placeholder: 'Write your content here...',
  error: '',
  height: '500px'
})

const emit = defineEmits<Emits>()

// Use dark theme
const theme = ref<'dark' | 'light'>('dark')

const content = ref(props.modelValue)

// Sync with parent
watch(() => props.modelValue, (newValue) => {
  content.value = newValue
})

watch(content, (newValue) => {
  emit('update:modelValue', newValue)
})

const characterCount = computed(() => content.value.length)
const wordCount = computed(() => {
  const words = content.value.trim().split(/\s+/)
  return words[0] === '' ? 0 : words.length
})

// Toolbar configuration with essential markdown tools
const toolbars: ToolbarNames[] = [
  'bold',
  'italic',
  'strikeThrough',
  '-',
  'title',
  'sub',
  'sup',
  'quote',
  'unorderedList',
  'orderedList',
  '-',
  'codeRow',
  'code',
  'link',
  'table',
  '-',
  'revoke',
  'next'
]

function handleBlur() {
  emit('blur')
}
</script>

<style scoped>
/* Customize editor to match the app theme */
.markdown-editor-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
</style>

<style>
/* Editor container styling */
#md-editor-v3 {
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --md-bk-color: hsl(var(--background));
  --md-color: hsl(var(--foreground));
}

#md-editor-v3-dark {
  --md-bk-color: hsl(var(--background));
  --md-color: hsl(var(--foreground));
  --md-border-color: hsl(var(--border));
  --md-border-hover-color: hsl(var(--ring));
}

/* Toolbar styling */
.md-editor-toolbar {
  background-color: hsl(var(--muted) / 0.3);
  border-bottom: 1px solid hsl(var(--border));
}

.md-editor-toolbar-item {
  color: hsl(var(--foreground));
  transition: background-color 0.2s;
}

.md-editor-toolbar-item:hover {
  background-color: hsl(var(--muted));
}

/* Input area styling */
.md-editor-input-wrapper,
.md-editor-preview-wrapper {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}

.md-editor-input {
  font-family: ui-monospace, monospace;
  font-size: 0.875rem;
  line-height: 1.625;
}

/* Preview styling */
.md-editor-preview {
  max-width: none;
  font-size: 0.875rem;
  line-height: 1.7142857;
}

.md-editor-preview h1,
.md-editor-preview h2,
.md-editor-preview h3,
.md-editor-preview h4,
.md-editor-preview h5,
.md-editor-preview h6,
.md-editor-preview p,
.md-editor-preview strong,
.md-editor-preview code {
  color: hsl(var(--foreground));
}

.md-editor-preview pre {
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.md-editor-preview a {
  color: rgb(168 85 247);
}

.md-editor-preview a:hover {
  color: rgb(147 51 234);
}
</style>

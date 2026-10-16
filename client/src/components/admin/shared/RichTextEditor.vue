<script setup lang="ts">
  /**
   * HTML body editor for admin-authored content (announcements, email
   * campaigns). One framed box: a toolbar row (formatting buttons + the
   * Visual / HTML / Preview switch), a hairline, then the active mode.
   *
   *   <Field label="Body">
   *     <RichTextEditor v-model="form.body" placeholder="<p>Enter HTML body…</p>" />
   *   </Field>
   *
   * - Visual: tiptap StarterKit (bold, italic, underline, H2, lists, links and
   *   its keyboard shortcuts, e.g. Mod-B / Mod-Alt-2 / Mod-Shift-8). The value
   *   is tiptap's HTML. `preserve-inline-styles` keeps `style` attributes so
   *   styled email HTML survives Visual round-trips.
   * - HTML: raw textarea. Switching back to Visual loads the edited HTML into
   *   the editor, which normalises it to what the editor supports.
   * - Preview: the HTML rendered as-is, or the `#preview="{ html }"` slot
   *   (e.g. an email iframe with the mail chrome around it).
   *
   * Setting v-model from outside (loading a record, applying a template)
   * replaces the editor content without rewriting the value.
   */
  import type { Component } from 'vue'
  import { ref, watch } from 'vue'
  import { Extension } from '@tiptap/core'
  import { EditorContent, useEditor } from '@tiptap/vue-3'
  import StarterKit from '@tiptap/starter-kit'
  import {
    Bold,
    Code,
    Eye,
    Heading2,
    Italic,
    LinkIcon,
    List,
    ListOrdered,
    Type,
    Underline,
  } from 'lucide-vue-next'
  import { promptDialog } from '@/composables/useDialogs'
  import { Button } from '@/components/ui/button'
  import { EmptyState } from '@/components/ui/empty-state'
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control'
  import { Separator } from '@/components/ui/separator'

  export type RichTextMode = 'visual' | 'html' | 'preview'

  const props = withDefaults(
    defineProps<{
      modelValue: string
      /** Mode shown when the editor mounts. */
      defaultMode?: RichTextMode
      /** Placeholder of the HTML textarea. */
      placeholder?: string
      /** Min height (px) of the editing / preview area. */
      minHeight?: number
      /** Keep inline `style` attributes through the visual editor (email HTML). */
      preserveInlineStyles?: boolean
    }>(),
    { defaultMode: 'visual', placeholder: '<p>Enter HTML…</p>', minHeight: 280, preserveInlineStyles: false }
  )

  const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

  defineSlots<{ preview?: (props: { html: string }) => unknown }>()

  /** Keeps inline style attrs on block nodes and links. */
  const PreserveInlineStyles = Extension.create({
    name: 'preserveInlineStyles',
    addGlobalAttributes() {
      return [
        {
          types: ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'link'],
          attributes: {
            style: {
              default: null,
              parseHTML: (element) => element.getAttribute('style'),
              renderHTML: (attributes) => (attributes.style ? { style: attributes.style } : {}),
            },
          },
        },
      ]
    },
  })

  /** Last value this component emitted — used to tell our own updates from outside ones. */
  let lastEmitted: string | undefined
  function emitValue(html: string) {
    lastEmitted = html
    emit('update:modelValue', html)
  }

  const editor = useEditor({
    content: props.modelValue,
    extensions: [
      // StarterKit (tiptap 3) already includes Underline and Link.
      StarterKit.configure({ link: { openOnClick: false } }),
      ...(props.preserveInlineStyles ? [PreserveInlineStyles] : []),
    ],
    editorProps: { attributes: { class: 'rte-doc' } },
    onUpdate: ({ editor }) => emitValue(editor.getHTML()),
  })

  // Outside changes replace the editor content without emitting.
  watch(
    () => props.modelValue,
    (value) => {
      if (value === lastEmitted || !editor.value || editor.value.getHTML() === value) return
      editor.value.commands.setContent(value, { emitUpdate: false })
    }
  )

  // ── Modes ──────────────────────────────────────────────────────────────
  const modeOptions: SegmentedOption<RichTextMode>[] = [
    { value: 'visual', label: 'Visual', icon: Type },
    { value: 'html', label: 'HTML', icon: Code },
    { value: 'preview', label: 'Preview', icon: Eye },
  ]
  const mode = ref<RichTextMode>(props.defaultMode)
  /** Where the HTML was last edited; Visual reloads it after HTML-mode edits. */
  let editedIn: 'visual' | 'html' = props.defaultMode === 'html' ? 'html' : 'visual'

  function setMode(next: RichTextMode) {
    if (next === 'visual' && editedIn === 'html') editor.value?.commands.setContent(props.modelValue)
    if (next !== 'preview') editedIn = next
    mode.value = next
  }

  // ── Toolbar ────────────────────────────────────────────────────────────
  interface Tool {
    label: string
    icon: Component
    run: () => unknown
    isActive?: () => boolean
    /** Starts a new group (separator before it). */
    group?: boolean
  }

  const chain = () => editor.value!.chain().focus()
  const tools: Tool[] = [
    { label: 'Bold', icon: Bold, run: () => chain().toggleBold().run(), isActive: () => !!editor.value?.isActive('bold') },
    { label: 'Italic', icon: Italic, run: () => chain().toggleItalic().run(), isActive: () => !!editor.value?.isActive('italic') },
    {
      label: 'Underline',
      icon: Underline,
      run: () => chain().toggleUnderline().run(),
      isActive: () => !!editor.value?.isActive('underline'),
    },
    {
      label: 'Heading',
      icon: Heading2,
      group: true,
      run: () => chain().toggleHeading({ level: 2 }).run(),
      isActive: () => !!editor.value?.isActive('heading', { level: 2 }),
    },
    {
      label: 'Bulleted list',
      icon: List,
      run: () => chain().toggleBulletList().run(),
      isActive: () => !!editor.value?.isActive('bulletList'),
    },
    {
      label: 'Numbered list',
      icon: ListOrdered,
      run: () => chain().toggleOrderedList().run(),
      isActive: () => !!editor.value?.isActive('orderedList'),
    },
    { label: 'Insert link', icon: LinkIcon, group: true, run: insertLink },
  ]

  async function insertLink() {
    const url = await promptDialog({ title: 'Insert link', label: 'URL', placeholder: 'https://', confirmText: 'Insert' })
    if (url) editor.value?.chain().focus().setLink({ href: url }).run()
  }
</script>

<template>
  <div
    class="rte overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface-sunken"
    :style="{ '--rte-min-h': `${minHeight}px` }"
  >
    <div class="flex flex-wrap items-center gap-0.5 px-1.5 py-1">
      <template v-for="(tool, index) in tools" :key="tool.label">
        <Separator v-if="tool.group && index > 0" orientation="vertical" class="mx-1 h-4" />
        <Button
          variant="ghost"
          size="icon-sm"
          :title="tool.label"
          :aria-label="tool.label"
          :aria-pressed="tool.isActive ? mode === 'visual' && tool.isActive() : undefined"
          :disabled="mode !== 'visual' || !editor"
          :class="{ 'bg-surface-active text-fg': mode === 'visual' && tool.isActive?.() }"
          @click="tool.run()"
        >
          <component :is="tool.icon" />
        </Button>
      </template>
      <SegmentedControl :model-value="mode" :options="modeOptions" size="sm" class="ml-auto" @update:model-value="setMode" />
    </div>
    <Separator />

    <div :key="mode" class="animate-enter">
      <EditorContent v-if="mode === 'visual'" :editor="editor" />
      <textarea
        v-else-if="mode === 'html'"
        :value="modelValue"
        class="block min-h-[var(--rte-min-h)] w-full resize-y bg-transparent p-3.5 font-mono text-xs leading-relaxed text-fg placeholder:text-fg-subtle focus:outline-none"
        :placeholder="placeholder"
        spellcheck="false"
        aria-label="HTML source"
        @input="emitValue(($event.target as HTMLTextAreaElement).value)"
      />
      <template v-else-if="modelValue">
        <slot name="preview" :html="modelValue">
          <div class="rte-doc" v-html="modelValue" />
        </slot>
      </template>
      <EmptyState v-else size="sm" :icon="Eye" title="No content to preview" class="min-h-[var(--rte-min-h)]" />
    </div>
  </div>
</template>

<style scoped>
  /* Editor document and default preview (tiptap / v-html render raw HTML). */
  .rte :deep(.rte-doc) {
    min-height: var(--rte-min-h);
    padding: 0.875rem;
    outline: none;
    font-size: var(--text-sm);
    line-height: 1.6;
    color: var(--fg);
  }
  .rte :deep(.rte-doc p) {
    margin: 0 0 0.5rem;
  }
  .rte :deep(.rte-doc ul),
  .rte :deep(.rte-doc ol) {
    margin: 0 0 0.5rem;
    padding-left: 1.25rem;
  }
  .rte :deep(.rte-doc ul) {
    list-style: disc;
  }
  .rte :deep(.rte-doc ol) {
    list-style: decimal;
  }
  .rte :deep(.rte-doc h1),
  .rte :deep(.rte-doc h2) {
    margin: 0 0 0.5rem;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--fg);
  }
  .rte :deep(.rte-doc a) {
    color: var(--brand);
    text-decoration: underline;
  }
</style>

<script setup lang="ts" generic="T extends string | number">
  /**
   * Compact segmented switch for 2–5 mutually exclusive views or filters
   * (e.g. Month / Week, Grid / List). For page-level navigation tabs use the
   * same control; for content tabs with panels use <Tabs>.
   *
   * The selection pill slides between options. Key the panel it switches so
   * the content eases in too: `<div :key="view" class="animate-enter">`.
   */
  import type { HTMLAttributes } from 'vue'
  import type { SegmentedOption } from './types'
  import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { cn } from '@/lib/utils'

  const props = withDefaults(
    defineProps<{
      modelValue: T
      options: SegmentedOption<T>[]
      size?: 'sm' | 'md'
      block?: boolean
      class?: HTMLAttributes['class']
    }>(),
    { size: 'md' }
  )

  const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

  // ── Sliding selection pill ──────────────────────────────────────────
  const root = ref<HTMLElement | null>(null)
  const buttons: (HTMLElement | null)[] = []
  const pill = ref<{ left: number; width: number } | null>(null)
  /** Off for the first placement so the pill doesn't slide in from the left edge. */
  const animatePill = ref(false)

  function setButton(el: unknown, index: number) {
    buttons[index] = el instanceof HTMLElement ? el : null
  }

  function measure() {
    const index = props.options.findIndex((option) => option.value === props.modelValue)
    const el = index >= 0 ? buttons[index] : null
    pill.value = el && el.offsetWidth ? { left: el.offsetLeft, width: el.offsetWidth } : null
  }

  watch(
    () => [props.modelValue, props.options.length, props.options.map((o) => o.label).join('|')],
    () => nextTick(measure)
  )

  let observer: ResizeObserver | null = null
  onMounted(() => {
    measure()
    requestAnimationFrame(() => (animatePill.value = true))
    // Re-measure when the control becomes visible or its labels/counts change width.
    observer = new ResizeObserver(() => measure())
    if (root.value) observer.observe(root.value)
  })
  onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div
    ref="root"
    role="tablist"
    :class="
      cn(
        'relative inline-flex shrink-0 items-center gap-0.5 rounded-[var(--radius-control)] border border-line-subtle bg-surface p-0.5',
        size === 'sm' ? 'h-[var(--control-sm)]' : 'h-[var(--control-md)]',
        block && 'flex w-full',
        props.class
      )
    "
  >
    <span
      v-if="pill"
      aria-hidden="true"
      :class="[
        'pointer-events-none absolute inset-y-0.5 left-0 rounded-[calc(var(--radius-control)-2px)] bg-surface-raised shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_0_0_1px_var(--line)]',
        animatePill && 'transition-[translate,width] duration-[var(--duration-base)] ease-[var(--ease-out)]',
      ]"
      :style="{ width: `${pill.width}px`, translate: `${pill.left}px 0` }"
    />
    <button
      v-for="(option, index) in options"
      :key="String(option.value)"
      :ref="(el) => setButton(el, index)"
      type="button"
      role="tab"
      :aria-selected="modelValue === option.value"
      :title="option.title || (option.label ? undefined : String(option.value))"
      :disabled="option.disabled"
      :class="
        cn(
          'relative inline-flex h-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[calc(var(--radius-control)-2px)] text-xs font-medium transition-colors duration-[var(--duration-fast)]',
          'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-45',
          option.label ? 'px-2.5' : 'aspect-square',
          block && 'min-w-0 flex-1',
          modelValue === option.value
            ? cn('text-fg', !pill && 'bg-surface-raised shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_0_0_1px_var(--line)]')
            : 'text-fg-muted hover:text-fg'
        )
      "
      @click="emit('update:modelValue', option.value)"
    >
      <component :is="option.icon" v-if="option.icon" class="size-3.5 shrink-0" />
      <span v-if="option.label" class="truncate">{{ option.label }}</span>
      <span
        v-if="option.count !== undefined"
        class="tabular rounded px-1 text-2xs leading-4"
        :class="modelValue === option.value ? 'bg-surface-active text-fg' : 'bg-surface-hover text-fg-subtle'"
      >
        {{ option.count }}
      </span>
    </button>
  </div>
</template>

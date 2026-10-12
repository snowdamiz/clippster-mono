import type { Component } from 'vue'

export interface SegmentedOption<V> {
  value: V
  label?: string
  icon?: Component
  /** Tooltip / accessible label for icon-only options. */
  title?: string
  count?: number
  disabled?: boolean
}

import type { Component } from 'vue';

/** One cell for `<StatGrid :items>`. */
export interface StatItem {
  label: string;
  value: string | number;
  hint?: string;
  icon?: Component;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'ai';
}

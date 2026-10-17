import type { InjectionKey } from 'vue';

/** Set by `StatGrid` so its `StatCard`s render as divided cells of one strip instead of separate tiles. */
export const STAT_GRID_SIZE: InjectionKey<'sm' | 'md'> = Symbol('stat-grid-size');

import type { InjectionKey, Ref } from 'vue';

/** One label / value pair for `<InfoList :rows>`. */
export interface InfoListItem {
  label: string;
  value: string | number;
  /** Render the value as a link. */
  href?: string | null;
  /** Open `href` in a new tab. */
  external?: boolean;
  /** Highlight the value (e.g. the headline payout). */
  strong?: boolean;
  /** Monospace value (ids, codes, wallet addresses). */
  mono?: boolean;
}

export const INFO_LIST_KEY: InjectionKey<{ compact: Ref<boolean> }> = Symbol('InfoList');

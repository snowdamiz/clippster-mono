/** Column definition for <DataTable>. */
export interface DataTableColumn {
  /** Unique key; also the name of the `#cell-<key>` slot and the value emitted by `sort`. */
  key: string;
  /** Header text. Use an empty string for unlabeled columns (e.g. avatars). */
  label: string;
  /** Show a sort affordance in the header and emit `sort` with this key on click. */
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Fixed column width (any CSS width, e.g. `'96px'` or `'18%'`). Columns without one share the rest. */
  width?: string;
  /**
   * Hide this column when the table itself is narrower than a breakpoint, so
   * tables stay readable at the 800px minimum window. A full-width table is
   * ~830px wide at the default 1120px window and ~510px at 800px.
   *  - `sm`: table < 448px  (only very narrow embeds)
   *  - `md`: table < 768px  (hidden at the 800px window)
   *  - `lg`: table < 1024px (hidden at the default window; shown on big screens)
   */
  hideBelow?: 'sm' | 'md' | 'lg';
  /** Extra classes for the header and body cells of this column. */
  class?: string;
}

export type SortDirection = 'asc' | 'desc';

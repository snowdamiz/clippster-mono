/** One line in a PriceCard feature list. */
export interface PriceFeature {
  label: string;
  /** `false` renders the line as not included (muted, with an ✕). */
  included?: boolean;
  /** Plain footnote line without an icon. */
  note?: boolean;
}

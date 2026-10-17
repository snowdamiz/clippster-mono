/** A titled group of accounts in <PublishAccountSelect>; values become `${prefix}:${id}`. */
export interface PublishAccountGroup {
  label: string;
  prefix: 'org' | 'user';
  accounts: Array<{ id: number; username?: string | null }>;
}

/** An option in <PublishEntitySelect> (creator profile, campaign, branding profile). */
export interface PublishEntityOption {
  id: string | number;
  name: string;
  imageUrl?: string | null;
  tag?: string | null;
  /** Right-aligned secondary value, e.g. a duration. */
  trailing?: string | null;
}

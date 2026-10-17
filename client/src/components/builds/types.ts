/** Minimal shape of an intro/outro asset shown by `IntroOutroSelect`. */
export interface IntroOutroOption {
  id: string;
  name: string;
  duration?: number | null;
  isOrgAsset?: boolean;
  organization_name?: string | null;
}

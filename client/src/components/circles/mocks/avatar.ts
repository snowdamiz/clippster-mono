/** Deterministic placeholder avatars for Circles mocks (no Tokend assets). */
export function mockAvatarUrl(seed: string, size = 128): string {
  const encoded = encodeURIComponent(seed);
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encoded}&size=${size}`;
}

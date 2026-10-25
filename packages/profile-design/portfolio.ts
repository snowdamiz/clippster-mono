/** Preserve the editor's ordering and feature the first of up to three clips. */
export function publicPortfolio<T extends { display_order?: number }>(
  clips: readonly T[] | null | undefined
): T[] {
  return [...(clips || [])]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .slice(0, 3)
}

/** Keep profile input bounded before passing a size target to an encoder. */
export function creatorSkillPreviewLimitMb(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 200 ? value : 30;
}

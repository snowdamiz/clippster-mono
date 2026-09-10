export const IMAGE_CREATION_CREDIT_COST = 4;
export const IMAGE_EDIT_CREDIT_COST = 2;
export const TRANSCRIPT_THUMBNAIL_CREDIT_COST = 8;

export function thumbnailGenerationCreditCost(options: {
  hasTranscript: boolean;
  hasBaseImage: boolean;
}): number {
  if (options.hasTranscript) return TRANSCRIPT_THUMBNAIL_CREDIT_COST;
  return options.hasBaseImage ? IMAGE_EDIT_CREDIT_COST : IMAGE_CREATION_CREDIT_COST;
}

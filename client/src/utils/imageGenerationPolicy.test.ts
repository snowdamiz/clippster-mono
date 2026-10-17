import { describe, expect, it } from 'vitest';
import {
  IMAGE_CREATION_CREDIT_COST,
  IMAGE_EDIT_CREDIT_COST,
  TRANSCRIPT_THUMBNAIL_CREDIT_COST,
  thumbnailGenerationCreditCost,
} from './imageGenerationPolicy';

describe('image generation credit display policy', () => {
  it('shows four credits for true image creation', () => {
    expect(IMAGE_CREATION_CREDIT_COST).toBe(4);
    expect(thumbnailGenerationCreditCost({ hasTranscript: false, hasBaseImage: false })).toBe(4);
  });

  it('shows two credits for a transcript-less base-image edit', () => {
    expect(IMAGE_EDIT_CREDIT_COST).toBe(2);
    expect(thumbnailGenerationCreditCost({ hasTranscript: false, hasBaseImage: true })).toBe(2);
  });

  it('preserves transcript-backed thumbnail pricing', () => {
    expect(TRANSCRIPT_THUMBNAIL_CREDIT_COST).toBe(8);
    expect(thumbnailGenerationCreditCost({ hasTranscript: true, hasBaseImage: false })).toBe(8);
  });
});

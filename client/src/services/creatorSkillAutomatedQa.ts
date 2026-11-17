import type { EditDocument } from '../ai-video/types';
import { creatorSkillPresentationBlockers } from './creatorSkillPresentationAudit';
import { auditCreatorSkillStreamTiming } from './creatorSkillStreamTiming';

export interface CreatorSkillAutomatedQaInput {
  document: EditDocument;
  selectedOutroId?: string;
  flashFindings: string[] | null;
  hasAudio: boolean;
  audioMeasured: boolean;
  integratedLufs: number | null;
  truePeakDbtp: number | null;
  renderedDuration: number;
  expectedDuration: number;
  renderedWidth: number;
  renderedHeight: number;
  streamDurationDeltaMs: number | null;
  streamStartDeltaMs: number | null;
}

/** Objective final-render failures that require a new master before reviewer signoff. */
export function creatorSkillAutomatedQaBlockers(input: CreatorSkillAutomatedQaInput): string[] {
  const { document } = input;
  return [
    ...creatorSkillPresentationBlockers(document, input.selectedOutroId),
    ...(input.flashFindings ?? ['Automated flash scan was unavailable.']),
    ...(input.hasAudio && !input.audioMeasured ? ['Final audio loudness and true peak could not be measured.'] : []),
    ...(input.integratedLufs !== null && Math.abs(input.integratedLufs + 14) > 2 ? [`Final audio measures ${input.integratedLufs.toFixed(1)} LUFS, outside the -14 ±2 LUFS target.`] : []),
    ...(input.truePeakDbtp !== null && input.truePeakDbtp > -1 ? [`Final audio true peak is ${input.truePeakDbtp.toFixed(1)} dBTP, above the -1 dBTP ceiling.`] : []),
    ...(Math.abs(input.renderedDuration - input.expectedDuration) > Math.max(0.5, 2 / document.format.fps) ? ['Rendered duration differs from the editable timeline.'] : []),
    ...(input.renderedWidth !== document.format.width || input.renderedHeight !== document.format.height ? ['Rendered dimensions differ from the editable timeline.'] : []),
    ...auditCreatorSkillStreamTiming(input.hasAudio, input.streamDurationDeltaMs, input.streamStartDeltaMs),
  ];
}

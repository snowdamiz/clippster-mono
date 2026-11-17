import { getCreatorSkillEdit, saveCreatorSkillEdit } from './database/creator-skill-edits';
import { recordCreatorSkillClaimReview, recordCreatorSkillFootageReview, recordCreatorSkillIndependentFinding, recordCreatorSkillIndependentSignoff } from './creatorSkillPackage';

export async function reviewCreatorSkillClaim(clipId: string, claimIndex: number, decision: 'source_checked' | 'label_checked' | 'needs_changes', note: string) {
  const edit = await getCreatorSkillEdit(clipId);
  if (!edit?.playbookPackage) throw new Error('The clip has no saved claim package.');
  edit.playbookPackage = recordCreatorSkillClaimReview(edit.playbookPackage, claimIndex, decision, note);
  await saveCreatorSkillEdit(edit);
  return edit;
}

export async function reviewCreatorSkillFootage(clipId: string, footageIndex: number, decision: 'frame_checked' | 'needs_changes', note: string) {
  const edit = await getCreatorSkillEdit(clipId);
  if (!edit?.playbookPackage) throw new Error('The clip has no saved footage package.');
  edit.playbookPackage = recordCreatorSkillFootageReview(edit.playbookPackage, footageIndex, decision, note);
  await saveCreatorSkillEdit(edit);
  return edit;
}

export async function reviewCreatorSkillIndependentFinding(clipId: string, finding: { reviewer: string; severity: 'fix_first' | 'should_fix' | 'ok'; outputTime: number; finding: string }) {
  const edit = await getCreatorSkillEdit(clipId);
  if (!edit?.playbookPackage || !edit.edited?.masterMd5) throw new Error('A checked edited master is required before recording a review.');
  edit.playbookPackage = recordCreatorSkillIndependentFinding(edit.playbookPackage, { ...finding, masterMd5: edit.edited.masterMd5 });
  await saveCreatorSkillEdit(edit);
  return edit;
}

export async function signOffCreatorSkillIndependentReview(clipId: string, input: { reviewer: string; note: string }) {
  const edit = await getCreatorSkillEdit(clipId);
  if (!edit?.playbookPackage || !edit.edited?.masterMd5) throw new Error('A checked edited master is required before signoff.');
  edit.playbookPackage = recordCreatorSkillIndependentSignoff(edit.playbookPackage, { ...input, masterMd5: edit.edited.masterMd5 });
  await saveCreatorSkillEdit(edit);
  return edit;
}

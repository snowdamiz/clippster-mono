<template>
  <details class="mt-1">
    <summary class="cursor-pointer">Research and publishing package</summary>
    <div class="mt-2 max-h-64 space-y-3 overflow-y-auto text-fg-muted">
      <p>AI draft: verify claims, dates, asset rights, sponsor terms, and copy before publishing.</p>
      <section>
        <strong class="text-fg">Funnel · {{ item.funnel.stage.replace('_', ' ') }}</strong>
        <p>{{ item.funnel.reason }} · Measure: {{ item.funnel.metric }}</p>
        <p v-if="item.funnel.bridge">Bridge: {{ item.funnel.bridge }}</p>
      </section>
      <section>
        <strong class="text-fg">Claims</strong>
        <p v-if="!item.claims.length">No factual claims recorded.</p>
        <ul v-else class="list-disc pl-4">
          <li v-for="(claim, index) in item.claims" :key="index">
            {{ claim.time.toFixed(1) }}s · {{ claim.verdict.replace('_', ' ') }} · {{ claim.text }}
            <a v-if="claim.sourceUrl" :href="claim.sourceUrl" target="_blank" rel="noopener noreferrer" class="text-brand underline"> · Open cited source</a>
            <span v-if="claim.sourceUrl"> · {{ capturedUrls.has(claim.sourceUrl) ? 'Page captured for review' : 'Page not captured' }}</span>
            <span v-if="claim.publishedAt"> · Proposed date: {{ claim.publishedAt }}</span>
            <span v-if="claim.onScreenLabel"> · Label: {{ claim.onScreenLabel }}</span>
            <p v-if="claimEvidenceFor(index)" class="mt-1 rounded border border-line-subtle p-1 text-xs">Captured text candidate (not verified): {{ claimEvidenceFor(index)?.excerpt }}</p>
            <span v-if="claimReview(index)"> · Human review: {{ claimReview(index)?.decision.replace('_', ' ') }} ({{ claimReview(index)?.reviewedAt }}) · {{ claimReview(index)?.note }}</span>
            <span class="ml-1 inline-flex gap-2"><button v-if="claim.sourceUrl" type="button" class="text-brand underline" @click="review(index, 'source_checked')">Record source check</button><button v-if="['unconfirmed', 'rumor', 'not_found'].includes(claim.verdict) && claim.onScreenLabel" type="button" class="text-brand underline" @click="review(index, 'label_checked')">Record neutral-label check</button><button type="button" class="text-brand underline" @click="review(index, 'needs_changes')">Needs changes</button></span>
          </li>
        </ul>
      </section>
      <section>
        <strong class="text-fg">Sources</strong>
        <p v-if="!item.sources.length">No sources recorded.</p>
        <ul v-else class="list-disc pl-4">
          <li v-for="source in item.sources" :key="source.url">
            <a :href="source.url" target="_blank" rel="noopener noreferrer" class="text-brand underline">{{ source.title }}</a>
            <span> · {{ source.publishedAt || 'Publication date unknown' }} · AI-reported retrieval {{ source.retrievedAt }}</span>
          </li>
        </ul>
      </section>
      <section>
        <strong class="text-fg">Footage and privacy crop proposals</strong>
        <p>Inspect these source ranges and the rendered frames before approving a crop.</p>
        <p v-if="!item.footageReview?.length">No clip-specific crops were proposed. Review the full source and edit.</p>
        <ul v-else class="list-disc pl-4"><li v-for="(entry, index) in item.footageReview" :key="index">{{ entry.start.toFixed(1) }}–{{ entry.end.toFixed(1) }}s · Show {{ entry.show }} · Hide {{ entry.hide.join(', ') || 'none noted' }} · Crop {{ entry.crop ? `${entry.crop.x}, ${entry.crop.y}, ${entry.crop.width}, ${entry.crop.height}` : 'not proposed' }} · {{ entry.note }}<span v-if="footageReview(index)"> · Human review: {{ footageReview(index)?.decision.replace('_', ' ') }} ({{ footageReview(index)?.reviewedAt }}) · {{ footageReview(index)?.note }}</span><span class="ml-1 inline-flex gap-2"><button type="button" class="text-brand underline" @click="reviewFootage(index, 'frame_checked')">Record frame check</button><button type="button" class="text-brand underline" @click="reviewFootage(index, 'needs_changes')">Needs changes</button></span></li></ul>
      </section>
      <section v-if="item.brandReferences?.length">
        <strong class="text-fg">Public brand references</strong>
        <p>Research leads only. Check the official source and asset usage rights before placing branding in an edit. A mention does not establish sponsorship.</p>
        <ul class="list-disc pl-4">
          <li v-for="(brand, index) in item.brandReferences" :key="index">
            {{ brand.name }} · <a :href="brand.sourceUrl" target="_blank" rel="noopener noreferrer" class="text-brand underline">Source</a>
            <a v-if="brand.logoUrl" :href="brand.logoUrl" target="_blank" rel="noopener noreferrer" class="text-brand underline"> · Logo reference</a>
            <span v-if="brand.colors.length"> · {{ brand.colors.join(', ') }}</span> · {{ brand.notes }}
          </li>
        </ul>
      </section>
      <section v-if="item.sponsors.length">
        <strong class="text-fg">Sponsor review</strong>
        <ul class="list-disc pl-4"><li v-for="(sponsor, index) in item.sponsors" :key="index">{{ sponsor.name }} · {{ sponsor.confirmed ? 'Saved in creator profile' : 'Unconfirmed' }}<span v-if="sponsor.review"> · {{ sponsor.review }}</span></li></ul>
      </section>
      <section>
        <strong class="text-fg">Thumbnail concepts</strong>
        <ul class="list-disc pl-4"><li v-for="(concept, index) in item.thumbnailConcepts" :key="index">{{ concept }}</li></ul>
        <p>Draft headlines: {{ item.thumbnailHeadlines.join(' · ') }}</p>
      </section>
      <section>
        <strong class="text-fg">Independent reviewer findings</strong>
        <p>Ask someone who did not build this edit to watch the master against Raw and record each finding with its output time. FIX FIRST blocks publishing this edited master. The same reviewer can record OK at the same output time after rechecking a false alarm.</p>
        <p v-if="!item.independentReview?.length">No independent findings recorded.</p>
        <ul v-else class="list-disc pl-4"><li v-for="(finding, index) in item.independentReview" :key="index">{{ finding.severity.replace('_', ' ').toUpperCase() }} · {{ finding.outputTime.toFixed(2) }}s · {{ finding.finding }} · {{ finding.reviewer }} · {{ finding.reviewedAt }}<span v-if="finding.masterMd5 !== masterMd5"> · Stale: master changed</span></li></ul>
        <p v-if="item.independentSignoff">Full-master signoff: {{ item.independentSignoff.reviewer }} · {{ item.independentSignoff.reviewedAt }}<span v-if="item.independentSignoff.masterMd5 !== masterMd5"> · Stale: master changed</span> · {{ item.independentSignoff.note }}</p>
        <button type="button" class="text-brand underline" @click="recordFinding">Record reviewer finding</button>
        <button type="button" class="ml-3 text-brand underline" @click="signOff">Sign off after full review</button>
      </section>
      <section>
        <strong class="text-fg">Platform copy drafts</strong>
        <div v-for="(copy, index) in item.platformCopy" :key="index" class="mt-1 rounded border border-line-subtle p-2">
          <strong>{{ copy.platform }} · {{ copy.title }}</strong>
          <p class="whitespace-pre-wrap">{{ copy.description }}</p>
          <p v-if="copy.tags.length">{{ copy.tags.join(' ') }}</p>
          <p>Pinned comment: {{ copy.pinnedComment }}</p>
        </div>
      </section>
    </div>
  </details>
</template>

<script setup lang="ts">
import type { CreatorSkillClaimEvidence, CreatorSkillPackage } from '@clippster/shared-types';
import { computed } from 'vue';
const props = defineProps<{ item: CreatorSkillPackage; sourceCaptures?: Array<{ url: string }>; claimEvidence?: CreatorSkillClaimEvidence[]; masterMd5?: string }>();
const emit = defineEmits<{ review: [claimIndex: number, decision: 'source_checked' | 'label_checked' | 'needs_changes', note: string]; reviewFootage: [footageIndex: number, decision: 'frame_checked' | 'needs_changes', note: string]; reviewFinding: [finding: { reviewer: string; severity: 'fix_first' | 'should_fix' | 'ok'; outputTime: number; finding: string }]; reviewSignoff: [input: { reviewer: string; note: string }] }>();
const capturedUrls = computed(() => new Set(props.sourceCaptures?.map(capture => capture.url) ?? []));
const claimReview = (index: number) => props.item.claimReviews?.find(review => review.claimIndex === index);
const claimEvidenceFor = (index: number) => props.claimEvidence?.find(evidence => evidence.claimIndex === index);
const footageReview = (index: number) => props.item.footageReviews?.find(review => review.footageIndex === index);
function review(index: number, decision: 'source_checked' | 'label_checked' | 'needs_changes') {
  const note = window.prompt('Record what you checked, including the source date or the change needed:', claimReview(index)?.note ?? '');
  if (note !== null) emit('review', index, decision, note);
}
function reviewFootage(index: number, decision: 'frame_checked' | 'needs_changes') {
  const note = window.prompt('Record which source and rendered frames you inspected, or what needs changing:', footageReview(index)?.note ?? '');
  if (note !== null) emit('reviewFootage', index, decision, note);
}
function recordFinding() {
  const reviewer = window.prompt('Name of the reviewer who did not build this edit:');
  if (reviewer === null) return;
  const severity = window.prompt('Severity: FIX FIRST, SHOULD FIX, or OK:', 'FIX FIRST')?.trim().toLowerCase().replace(/\s+/g, '_');
  if (severity !== 'fix_first' && severity !== 'should_fix' && severity !== 'ok') return;
  const time = window.prompt('Output time in seconds:', '0');
  if (time === null) return;
  const finding = window.prompt('Evidence and specific correction (at least 10 characters):');
  if (finding === null) return;
  emit('reviewFinding', { reviewer, severity, outputTime: Number(time), finding });
}
function signOff() {
  const reviewer = window.prompt('Name of the reviewer who watched the full edited master against Raw:');
  if (reviewer === null) return;
  const note = window.prompt('Describe the full-master review, including source cards, privacy, speech, captions, audio, sponsor terms, and thumbnails (at least 20 characters):');
  if (note !== null) emit('reviewSignoff', { reviewer, note });
}
</script>

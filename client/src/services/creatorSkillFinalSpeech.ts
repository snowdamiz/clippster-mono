/** Compare the source transcript with a fresh transcription of the rendered master. */
export interface CreatorSkillSpeechComparison { sourceWords: number; renderedWords: number; matchedWords: number; missingWords: number; addedWords: number; missingTokens: Array<{ index: number; word: string }>; addedTokens: Array<{ index: number; word: string }>; missingExamples: string[]; addedExamples: string[]; matchPercent: number }
export function compareCreatorSkillFinalSpeech(source: string[], rendered: string[]): CreatorSkillSpeechComparison {
  const tokens = (parts: string[]) => parts.flatMap(part => part.toLocaleLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []);
  const expected = tokens(source), actual = tokens(rendered);
  if (expected.length > 6000 || actual.length > 6000) throw new Error('The transcript is too long for an automatic word diff; review the final audio manually.');
  if (!expected.length || !actual.length) return { sourceWords: expected.length, renderedWords: actual.length, matchedWords: 0, missingWords: expected.length, addedWords: actual.length, missingTokens: expected.map((word, index) => ({ index, word })), addedTokens: actual.map((word, index) => ({ index, word })), missingExamples: expected.slice(0, 12), addedExamples: actual.slice(0, 12), matchPercent: 0 };
  const columns = actual.length + 1;
  const matrix = new Uint16Array((expected.length + 1) * columns);
  for (let row = 1; row <= expected.length; row++) {
    for (let column = 1; column <= actual.length; column++) {
      const index = row * columns + column;
      matrix[index] = expected[row - 1] === actual[column - 1]
        ? matrix[index - columns - 1] + 1
        : Math.max(matrix[index - columns], matrix[index - 1]);
    }
  }
  const matchedWords = matrix[matrix.length - 1];
  const missingTokens: Array<{ index: number; word: string }> = [];
  const addedTokens: Array<{ index: number; word: string }> = [];
  let row = expected.length, column = actual.length;
  while (row > 0 || column > 0) {
    if (column > 0 && expected[row - 1] === actual[column - 1]) { row--; column--; }
    else if (column > 0 && (row === 0 || matrix[row * columns + column - 1] >= matrix[(row - 1) * columns + column])) { addedTokens.push({ index: column - 1, word: actual[column - 1] }); column--; }
    else { missingTokens.push({ index: row - 1, word: expected[row - 1] }); row--; }
  }
  missingTokens.reverse();
  addedTokens.reverse();
  const missingExamples = missingTokens.slice(0, 12).map(token => token.word);
  const addedExamples = addedTokens.slice(0, 12).map(token => token.word);
  return { sourceWords: expected.length, renderedWords: actual.length, matchedWords, missingWords: expected.length - matchedWords, addedWords: actual.length - matchedWords, missingTokens, addedTokens, missingExamples, addedExamples, matchPercent: Math.round(matchedWords / expected.length * 1000) / 10 };
}

export function creatorSkillFinalSpeechReport(result: CreatorSkillSpeechComparison): string {
  return ['# Final audio word comparison', '', 'Draft comparison of source transcript and fresh rendered-audio transcription. Recognition errors can appear as mismatches; inspect the audio before deciding a word was cut.', '',
    `Source tokens: ${result.sourceWords}`, `Rendered tokens: ${result.renderedWords}`, `Matched in order: ${result.matchedWords} (${result.matchPercent}%)`, `Unmatched source tokens: ${result.missingWords}`, '',
    '## Unmatched source tokens', ...(result.missingTokens.length ? result.missingTokens.map(token => `- Source token ${token.index + 1}: ${token.word}`) : ['- None']), '',
    '## Unmatched rendered tokens', ...(result.addedTokens.length ? result.addedTokens.map(token => `- Rendered token ${token.index + 1}: ${token.word}`) : ['- None']), '',
    'Review status: pending human audio inspection.'].join('\n');
}

export function creatorSkillFinalSpeechReview(comparison: CreatorSkillSpeechComparison): string {
  if (!comparison.sourceWords) return 'No timed source words were available for a final re-transcription comparison; review the rendered speech against Raw.';
  if (!comparison.renderedWords) return 'The rendered audio re-transcription returned no words; review the final audio against Raw.';
  return `Final audio re-transcription matched ${comparison.matchedWords}/${comparison.sourceWords} source words in order (${comparison.matchPercent}%). ${comparison.missingWords ? `Review ${comparison.missingWords} unmatched source word${comparison.missingWords === 1 ? '' : 's'} against Raw, including: ${comparison.missingExamples.join(', ')}.` : 'No source words were missing from this text comparison.'} ${comparison.addedWords ? `Review ${comparison.addedWords} unmatched rendered word${comparison.addedWords === 1 ? '' : 's'}, including: ${comparison.addedExamples.join(', ')}.` : 'No extra rendered words were found in this text comparison.'} Speech recognition can differ; confirm by listening.`;
}

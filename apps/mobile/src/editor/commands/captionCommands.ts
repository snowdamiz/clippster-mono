import type { SubtitleSettings } from '@clippster/shared-types';

import type {
  CaptionDocument,
  CaptionPhrase,
  MobileEditProjectV3,
} from '../model/schema';
import type { EditorCommand } from './command';

class RestoreCaptionDocumentCommand implements EditorCommand {
  readonly type = 'RestoreCaptionDocument';

  constructor(
    private readonly captionDocument: CaptionDocument | undefined,
    private readonly updatedAt: number,
  ) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    return { ...document, captionDocument: this.captionDocument, updatedAt: this.updatedAt };
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    return new RestoreCaptionDocumentCommand(before.captionDocument, this.updatedAt);
  }
}

abstract class CaptionCommand implements EditorCommand {
  abstract readonly type: string;

  constructor(protected readonly updatedAt: number) {}

  abstract apply(document: MobileEditProjectV3): MobileEditProjectV3;

  invert(before: MobileEditProjectV3): EditorCommand {
    return new RestoreCaptionDocumentCommand(before.captionDocument, this.updatedAt);
  }

  protected captions(document: MobileEditProjectV3): CaptionDocument {
    if (!document.captionDocument) throw new Error('Document has no caption document');
    return document.captionDocument;
  }
}

export class InitializeTranscriptCaptionsCommand extends CaptionCommand {
  readonly type = 'InitializeTranscriptCaptions';

  constructor(
    private readonly words: CaptionDocument['words'],
    private readonly phrases: CaptionDocument['phrases'],
    updatedAt: number,
  ) {
    super(updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const captions = this.captions(document);
    return {
      ...document,
      captionDocument: {
        ...captions,
        source: 'transcript',
        words: this.words.map((word) => ({ ...word })),
        phrases: this.phrases.map((phrase) => ({ ...phrase, wordIds: [...phrase.wordIds] })),
      },
      updatedAt: this.updatedAt,
    };
  }
}

export class UpdateCaptionStyleCommand extends CaptionCommand {
  readonly type = 'UpdateCaptionStyle';
  readonly coalescingKey = this.type;

  constructor(
    readonly patch: {
      enabled?: boolean;
      presetId?: string;
      settings?: SubtitleSettings;
      effect?: CaptionDocument['effect'];
    },
    updatedAt: number,
  ) {
    super(updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const captions = this.captions(document);
    return {
      ...document,
      captionDocument: {
        ...captions,
        ...this.patch,
        settings: this.patch.settings ? { ...this.patch.settings } : captions.settings,
        effect: this.patch.effect ? { ...this.patch.effect } : captions.effect,
      },
      updatedAt: this.updatedAt,
    };
  }

  coalesce(next: EditorCommand): EditorCommand | null {
    return next instanceof UpdateCaptionStyleCommand
      ? new UpdateCaptionStyleCommand(
          { ...this.patch, ...next.patch },
          next.updatedAt,
        )
      : null;
  }
}

export class EditCaptionWordCommand extends CaptionCommand {
  readonly type = 'EditCaptionWord';
  readonly coalescingKey: string;

  constructor(
    readonly wordId: string,
    readonly text: string,
    updatedAt: number,
  ) {
    super(updatedAt);
    this.coalescingKey = `${this.type}:${wordId}`;
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const captions = this.captions(document);
    const text = this.text.trim();
    if (!text) throw new Error('Caption words cannot be empty');
    let found = false;
    const words = captions.words.map((word) => {
      if (word.id !== this.wordId) return word;
      found = true;
      return { ...word, word: text };
    });
    return found
      ? {
          ...document,
          captionDocument: { ...captions, words },
          updatedAt: this.updatedAt,
        }
      : document;
  }

  coalesce(next: EditorCommand): EditorCommand | null {
    return next instanceof EditCaptionWordCommand && next.wordId === this.wordId ? next : null;
  }
}

export class RetimeCaptionWordCommand extends CaptionCommand {
  readonly type = 'RetimeCaptionWord';
  readonly coalescingKey: string;

  constructor(
    readonly wordId: string,
    readonly start: number,
    readonly end: number,
    updatedAt: number,
  ) {
    super(updatedAt);
    this.coalescingKey = `${this.type}:${wordId}`;
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    if (!Number.isSafeInteger(this.start) || !Number.isSafeInteger(this.end) || this.end <= this.start) {
      throw new Error('Caption timing must be positive integer ticks');
    }
    const captions = this.captions(document);
    const words = captions.words.map((word) =>
      word.id === this.wordId ? { ...word, start: this.start, end: this.end } : word,
    );
    if (words.every((word, index) => word === captions.words[index])) return document;
    const phrases = captions.phrases.map((phrase) => retimePhrase(phrase, words));
    return {
      ...document,
      captionDocument: { ...captions, words, phrases },
      updatedAt: this.updatedAt,
    };
  }

  coalesce(next: EditorCommand): EditorCommand | null {
    return next instanceof RetimeCaptionWordCommand && next.wordId === this.wordId ? next : null;
  }
}

export class SplitCaptionPhraseCommand extends CaptionCommand {
  readonly type = 'SplitCaptionPhrase';

  constructor(
    readonly phraseId: string,
    readonly splitBeforeWordId: string,
    readonly newPhraseId: string,
    updatedAt: number,
  ) {
    super(updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const captions = this.captions(document);
    const index = captions.phrases.findIndex((phrase) => phrase.id === this.phraseId);
    const phrase = captions.phrases[index];
    if (!phrase) return document;
    const splitIndex = phrase.wordIds.indexOf(this.splitBeforeWordId);
    if (splitIndex <= 0) return document;
    const left = retimePhrase({ ...phrase, wordIds: phrase.wordIds.slice(0, splitIndex) }, captions.words);
    const right = retimePhrase(
      { ...phrase, id: this.newPhraseId, wordIds: phrase.wordIds.slice(splitIndex) },
      captions.words,
    );
    const phrases = [...captions.phrases];
    phrases.splice(index, 1, left, right);
    return {
      ...document,
      captionDocument: { ...captions, phrases },
      updatedAt: this.updatedAt,
    };
  }
}

export class MergeCaptionPhrasesCommand extends CaptionCommand {
  readonly type = 'MergeCaptionPhrases';

  constructor(
    readonly firstPhraseId: string,
    readonly secondPhraseId: string,
    updatedAt: number,
  ) {
    super(updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const captions = this.captions(document);
    const firstIndex = captions.phrases.findIndex((phrase) => phrase.id === this.firstPhraseId);
    const secondIndex = captions.phrases.findIndex((phrase) => phrase.id === this.secondPhraseId);
    if (firstIndex < 0 || secondIndex !== firstIndex + 1) return document;
    const merged = retimePhrase(
      {
        ...captions.phrases[firstIndex],
        wordIds: [
          ...captions.phrases[firstIndex].wordIds,
          ...captions.phrases[secondIndex].wordIds,
        ],
      },
      captions.words,
    );
    const phrases = [...captions.phrases];
    phrases.splice(firstIndex, 2, merged);
    return {
      ...document,
      captionDocument: { ...captions, phrases },
      updatedAt: this.updatedAt,
    };
  }
}

function retimePhrase(
  phrase: CaptionPhrase,
  words: CaptionDocument['words'],
): CaptionPhrase {
  const included = phrase.wordIds
    .map((wordId) => words.find((word) => word.id === wordId))
    .filter((word): word is NonNullable<typeof word> => Boolean(word));
  if (included.length === 0) throw new Error(`Caption phrase ${phrase.id} has no words`);
  return {
    ...phrase,
    start: Math.min(...included.map((word) => word.start)),
    end: Math.max(...included.map((word) => word.end)),
  };
}

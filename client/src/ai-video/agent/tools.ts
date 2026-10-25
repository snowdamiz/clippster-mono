import { compileDocument, placeShots, type CompileContext } from '../compiler/compile';
import { COMPOSITION_PATH, documentDuration, validateDocument } from '../director/validate';
import type { CheckFinding, CheckReport, HyperframesWorkspace } from '../runtime/workspace';
import type { EditDocument, MediaItem, ToolCall, ToolResult } from '../types';

const MAX_STILLS = 12;
const MAX_IMAGES_PER_TURN = 24;
const MAX_FINDINGS = 40;
const MAX_FILE_CHARS = 200_000;

export interface AgentToolDeps {
  workspace: Pick<
    HyperframesWorkspace,
    'writeFile' | 'readFile' | 'deleteFile' | 'listFiles' | 'check' | 'snapshot'
  >;
  compileContext: CompileContext;
  media: MediaItem[];
  maxSeconds: number;
  /** Keyframe path of every example shot, by shot index. */
  exampleKeyframes: Array<string | null>;
  snapshotDir: string;
  encodeImage: (path: string) => Promise<string>;
  signal?: AbortSignal;
}

/** What the agent has done so far, for the progress steps. */
export interface AgentProgress {
  edited: boolean;
  built: boolean;
  checking: boolean;
  stillsViewed: number;
  problemsFound: number;
  lastCheckOk: boolean | null;
  /** Text overlays in the latest saved edit. */
  titles: number;
  /** Designed scenes in the latest saved edit. */
  scenes: number;
  /** Labels of the graphics overlays in the latest saved edit. */
  graphics: string[];
}

/** Executes the agent's client-side tools against the Hyperframes workspace. */
export class AgentTools {
  document: EditDocument | null;
  readonly progress: AgentProgress = {
    edited: false,
    built: false,
    checking: false,
    stillsViewed: 0,
    problemsFound: 0,
    lastCheckOk: null,
    titles: 0,
    scenes: 0,
    graphics: [],
  };

  constructor(
    private readonly deps: AgentToolDeps,
    initialDocument: EditDocument | null
  ) {
    this.document = initialDocument;
  }

  async run(calls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    let imageBudget = MAX_IMAGES_PER_TURN;
    for (const call of calls) {
      if (this.deps.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      try {
        const result = await this.execute(call, imageBudget);
        imageBudget -= result.images?.length ?? 0;
        results.push({ id: call.id, ...result });
      } catch (error) {
        if (this.deps.signal?.aborted) throw error;
        results.push({
          id: call.id,
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
    return results;
  }

  private async execute(call: ToolCall, imageBudget: number): Promise<Omit<ToolResult, 'id'>> {
    const args = call.arguments ?? {};
    switch (call.name) {
      case 'set_edit':
        return { content: await this.setEdit(args.document) };
      case 'write_file':
        return { content: await this.writeFile(args.path, args.content) };
      case 'read_file':
        return { content: await this.readFile(args.path) };
      case 'list_files':
        return { content: (await this.authoredFiles()).join('\n') || 'No files yet.' };
      case 'delete_file':
        return { content: await this.deleteFile(args.path) };
      case 'check':
        return { content: await this.check() };
      case 'snapshot':
        return this.snapshot(args.times, imageBudget);
      default:
        return { content: `Unknown tool ${String(call.name)}.` };
    }
  }

  private async authoredFiles(): Promise<string[]> {
    return (await this.deps.workspace.listFiles()).filter(
      (path) => path === 'index.html' || COMPOSITION_PATH.test(path)
    );
  }

  private async compositionFiles(): Promise<string[]> {
    return (await this.authoredFiles()).filter((path) => path !== 'index.html');
  }

  private async setEdit(input: unknown): Promise<string> {
    const { document, errors, warnings } = validateDocument(input, {
      media: this.deps.media,
      maxSeconds: this.deps.maxSeconds,
      exampleShots: this.deps.exampleKeyframes.length,
      files: await this.compositionFiles(),
      requireFiles: false,
    });
    if (errors.length)
      return `Not saved. Fix these and resubmit the whole document:\n- ${errors.join('\n- ')}`;

    await this.deps.workspace.writeFile(
      'index.html',
      compileDocument(document, this.deps.compileContext)
    );
    this.document = document;
    const text = document.overlays.filter((overlay) => overlay.lane === 'text').length;
    const scenes = document.shots.filter((shot) => shot.scene).length;
    this.progress.edited = true;
    this.progress.titles = text;
    this.progress.scenes = scenes;
    this.progress.graphics = document.overlays
      .filter((overlay) => overlay.lane === 'graphics')
      .map((overlay) => overlay.label);

    const starts = placeShots(document)
      .map((shot) => `${shot.id}@${shot.start}`)
      .join(' ');
    const lines = [
      `Saved and compiled: ${document.shots.length} shots (${scenes} designed scenes), ${documentDuration(document)} s, ${text} text and ${document.overlays.length - text} graphics overlays.`,
      `Shot starts (frame-snapped): ${starts}`,
    ];
    if (warnings.length) lines.push(`Notes:\n- ${warnings.join('\n- ')}`);
    return lines.join('\n');
  }

  private async writeFile(path: unknown, content: unknown): Promise<string> {
    if (typeof path !== 'string' || !COMPOSITION_PATH.test(path))
      return 'Only compositions/<name>.html can be written.';
    if (typeof content !== 'string' || !content.trim()) return 'The file content is empty.';
    if (content.length > MAX_FILE_CHARS)
      return `The file is too large (limit ${MAX_FILE_CHARS} characters).`;
    await this.deps.workspace.writeFile(path, content);
    this.progress.built = true;
    return `Saved ${path}.`;
  }

  private async readFile(path: unknown): Promise<string> {
    if (typeof path !== 'string' || (path !== 'index.html' && !COMPOSITION_PATH.test(path))) {
      return 'Only index.html and compositions/<name>.html can be read.';
    }
    if (!(await this.authoredFiles()).includes(path)) return `${path} doesn't exist.`;
    return this.deps.workspace.readFile(path);
  }

  private async deleteFile(path: unknown): Promise<string> {
    if (typeof path !== 'string' || !COMPOSITION_PATH.test(path))
      return 'Only compositions/<name>.html can be deleted.';
    const users = [
      ...(this.document?.shots.filter((shot) => shot.scene?.composition === path) ?? []),
      ...(this.document?.overlays.filter((overlay) => overlay.composition === path) ?? []),
    ].map((block) => block.id);
    if (users.length) return `Not deleted: ${path} is still used by ${users.join(', ')}.`;
    await this.deps.workspace.deleteFile(path);
    return `Deleted ${path}.`;
  }

  private async check(): Promise<string> {
    if (!this.document) return 'Submit the edit with set_edit first.';
    this.progress.checking = true;
    const report = await this.deps.workspace.check({ signal: this.deps.signal });
    const findings = collectFindings(report);
    const errors = findings.filter((finding) => finding.severity === 'error').length;
    this.progress.problemsFound += errors;
    this.progress.lastCheckOk = report.ok;
    if (!findings.length) return 'All checks passed: lint, runtime, layout and contrast.';
    const lines = findings.slice(0, MAX_FINDINGS).map(formatFinding);
    if (findings.length > MAX_FINDINGS) lines.push(`…and ${findings.length - MAX_FINDINGS} more.`);
    return `${report.ok ? 'Passed with warnings' : `Failed with ${errors} error${errors === 1 ? '' : 's'}`}:\n${lines.join('\n')}`;
  }

  private async snapshot(times: unknown, imageBudget: number): Promise<Omit<ToolResult, 'id'>> {
    if (!this.document) return { content: 'Submit the edit with set_edit first.' };
    this.progress.checking = true;
    const placed = placeShots(this.document);
    const total = documentDuration(this.document);
    const lastFrame = Math.max(0, total - 1 / this.document.format.fps);
    const requested = Array.isArray(times)
      ? times.filter((t): t is number => typeof t === 'number' && Number.isFinite(t))
      : [];
    const stillLimit = Math.min(MAX_STILLS, Math.floor(imageBudget / 2));
    const at = [
      ...new Set(
        requested.map((t) => Math.round(Math.min(Math.max(t, 0), lastFrame) * 1000) / 1000)
      ),
    ]
      .sort((a, b) => a - b)
      .slice(0, stillLimit);
    if (!at.length)
      return {
        content:
          imageBudget < 2
            ? 'No room for more stills this turn.'
            : 'Give at least one time inside the video.',
      };

    const { files } = await this.deps.workspace.snapshot(at, this.deps.snapshotDir, undefined, {
      signal: this.deps.signal,
    });
    const byIndex = new Map(
      files.map((file) => [Number(/frame-(\d+)-/.exec(file)?.[1] ?? -1), file])
    );
    const images: NonNullable<ToolResult['images']> = [];
    const missing: number[] = [];

    for (const [index, time] of at.entries()) {
      const file = byIndex.get(index);
      if (!file) {
        missing.push(time);
        continue;
      }
      images.push({ label: `Yours at ${time} s`, data: await this.deps.encodeImage(file) });
      const shot =
        this.document.shots[placed.findIndex((entry) => time >= entry.start && time < entry.end)];
      const keyframe = shot?.refShot != null ? this.deps.exampleKeyframes[shot.refShot] : null;
      if (keyframe)
        images.push({
          label: `Example shot ${shot.refShot} (matched to ${shot.id})`,
          data: await this.deps.encodeImage(keyframe),
        });
    }
    this.progress.stillsViewed += images.filter((image) => image.label.startsWith('Yours')).length;

    const notes = [
      this.deps.exampleKeyframes.length
        ? `${images.length} images below: each of your stills, followed by the example frame of the shot it answers (when it has one).`
        : `${images.length} stills below.`,
    ];
    if (requested.length > at.length) notes.push(`Only ${at.length} stills fit in this turn.`);
    if (missing.length) notes.push(`No still came back for ${missing.join(', ')} s.`);
    return { content: notes.join(' '), images };
  }
}

function collectFindings(report: CheckReport): CheckFinding[] {
  return [report.lint, report.runtime, report.layout, report.contrast]
    .flatMap((section) => section?.findings ?? [])
    .sort((a, b) =>
      a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : b.severity === 'error' ? 1 : 0
    );
}

function formatFinding(finding: CheckFinding): string {
  const where = [
    finding.sourceFile,
    finding.selector,
    finding.time != null ? `@${finding.time}s` : null,
  ]
    .filter(Boolean)
    .join(' ');
  return `[${finding.severity}] ${finding.code}: ${finding.message}${where ? ` (${where})` : ''}${finding.fixHint ? ` Fix: ${finding.fixHint}` : ''}`;
}

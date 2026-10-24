import { describe, expect, it, vi } from 'vitest';
import type { CheckReport } from '../runtime/workspace';
import type { MediaItem, ToolCall } from '../types';
import { AgentTools, type AgentToolDeps } from './tools';

const media: MediaItem[] = [
  { id: 'm1', name: 'a.mp4', kind: 'video', path: 'C:/a.mp4', duration: 30, width: 1920, height: 1080, hasAudio: false, contentHash: 'h1' },
];

const section = (findings: CheckReport['lint']['findings'] = []) => ({
  ok: !findings.some((f) => f.severity === 'error'),
  errorCount: 0,
  warningCount: 0,
  findings,
});

function setup() {
  const files = new Map<string, string>();
  const workspace = {
    writeFile: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
      return { path, bytes: content.length };
    }),
    readFile: vi.fn(async (path: string) => files.get(path) ?? ''),
    deleteFile: vi.fn(async (path: string) => files.delete(path)),
    listFiles: vi.fn(async () => [...files.keys(), 'hyperframes.json'].sort()),
    check: vi.fn(async (): Promise<CheckReport> => ({
      ok: false,
      lint: section([{ code: 'missing_timeline', severity: 'error', message: 'No timeline', sourceFile: 'compositions/title.html', fixHint: 'Register it' }]),
      runtime: section(),
      layout: section([{ code: 'overflow', severity: 'warning', message: 'Text overflows', time: 1.5 }]),
      contrast: section(),
    })),
    snapshot: vi.fn(async (times: number[], outDir: string) => ({ outDir, files: times.map((t, i) => `${outDir}/frame-0${i}-at-${t}s.png`) })),
  };
  const deps: AgentToolDeps = {
    workspace,
    compileContext: { gsapSrc: 'assets/vendor/gsap.min.js', fonts: [], media: { m1: { src: 'assets/media/m1.mp4', kind: 'video', duration: 30, hasAudio: false } } },
    media,
    maxSeconds: 60,
    exampleKeyframes: ['C:/ref/keyframes/shot-0000.jpg', null],
    snapshotDir: 'C:/session/snapshots',
    encodeImage: vi.fn(async (path: string) => `b64:${path}`),
  };
  return { tools: new AgentTools(deps, null), workspace, files };
}

const call = (name: ToolCall['name'], args: Record<string, unknown> = {}, id: string = name): ToolCall => ({ id, name, arguments: args });

const document = {
  title: 'Test',
  format: { width: 1920, height: 1080, fps: 30 },
  music: null,
  shots: [
    { id: 's1', mediaId: 'm1', sourceIn: 0, duration: 2, refShot: 0 },
    { id: 's2', mediaId: 'm1', sourceIn: 4, duration: 3, refShot: 1 },
  ],
  overlays: [{ id: 't1', lane: 'text', start: 0, duration: 2, label: 'Hi', composition: 'compositions/title.html', variables: { text: 'HI' } }],
};

describe('AgentTools', () => {
  it('validates and compiles set_edit, noting unwritten compositions', async () => {
    const { tools, files } = setup();
    const [bad] = await tools.run([call('set_edit', { document: { ...document, shots: [] } })]);
    expect(bad.content).toContain('Not saved.');
    expect(tools.document).toBeNull();

    const [ok] = await tools.run([call('set_edit', { document })]);
    expect(ok.content).toContain('Saved and compiled: 2 shots, 5 s, 1 text and 0 graphics overlays.');
    expect(ok.content).toContain('Shot starts (frame-snapped): s1@0 s2@2');
    expect(ok.content).toContain("compositions/title.html hasn't been written yet.");
    expect(files.get('index.html')).toContain('data-composition-src="compositions/title.html"');
    expect(tools.progress.edited).toBe(true);
  });

  it('guards file paths and deleting compositions in use', async () => {
    const { tools } = setup();
    await tools.run([call('set_edit', { document })]);
    const results = await tools.run([
      call('write_file', { path: 'index.html', content: 'x' }, 'a'),
      call('write_file', { path: 'compositions/title.html', content: '<html></html>' }, 'b'),
      call('read_file', { path: 'compositions/title.html' }, 'c'),
      call('list_files', {}, 'd'),
      call('delete_file', { path: 'compositions/title.html' }, 'e'),
    ]);
    expect(results.map((r) => r.content)).toEqual([
      'Only compositions/<name>.html can be written.',
      'Saved compositions/title.html.',
      '<html></html>',
      'compositions/title.html\nindex.html',
      'Not deleted: overlays t1 still use compositions/title.html.',
    ]);
  });

  it('formats check findings with errors first', async () => {
    const { tools } = setup();
    expect((await tools.run([call('check')]))[0].content).toBe('Submit the edit with set_edit first.');
    await tools.run([call('set_edit', { document })]);
    const [result] = await tools.run([call('check')]);
    expect(result.content).toBe(
      'Failed with 1 error:\n[error] missing_timeline: No timeline (compositions/title.html) Fix: Register it\n[warning] overflow: Text overflows (@1.5s)'
    );
    expect(tools.progress).toMatchObject({ problemsFound: 1, lastCheckOk: false, checking: true });
  });

  it('pairs stills with the matched example keyframe and clamps times', async () => {
    const { tools, workspace } = setup();
    await tools.run([call('set_edit', { document })]);
    const [result] = await tools.run([call('snapshot', { times: [3, 1, 1, 99, 'x'] })]);
    expect(workspace.snapshot).toHaveBeenCalledWith([1, 3, 4.967], 'C:/session/snapshots', undefined, { signal: undefined });
    expect(result.images?.map((image) => image.label)).toEqual(['Yours at 1 s', 'Example shot 0 (matched to s1)', 'Yours at 3 s', 'Yours at 4.967 s']);
    expect(result.images?.[1].data).toBe('b64:C:/ref/keyframes/shot-0000.jpg');
    expect(tools.progress.stillsViewed).toBe(3);
  });
});

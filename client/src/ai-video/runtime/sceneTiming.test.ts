import { expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { withSceneTiming, withoutSceneTiming } from './sceneTiming';
it('scales the actual GSAP child timing once and strips its runtime helper from authored files', () => {
  const source =
    '<html><body><template><div data-composition-id="test"></div></template></body></html>';
  const output = withSceneTiming(source);
  expect(withSceneTiming(output)).toBe(output);
  expect(withoutSceneTiming(output)).toBe(source);
  const children = [
    { start: 0.5, duration: 1 },
    { start: 2, duration: 0.5 },
  ].map((value) => ({
    startTime(next?: number) {
      if (next !== undefined) value.start = next;
      return value.start;
    },
    duration(next?: number) {
      if (next !== undefined) value.duration = next;
      return value.duration;
    },
    value,
  }));
  const window = {
    __hyperframes: { getVariables: () => ({ __editorTimeScale: 1.5 }) },
    __timelines: { test: { getChildren: () => children, invalidate() {} } },
  };
  runInNewContext(output.match(/<script data-ai-editor-timing>([\s\S]*?)<\/script>/)![1], {
    window,
  });
  expect(children.map((child) => child.value)).toEqual([
    { start: 0.75, duration: 1.5 },
    { start: 3, duration: 0.75 },
  ]);
});

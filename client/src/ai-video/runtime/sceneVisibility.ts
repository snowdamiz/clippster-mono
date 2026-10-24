/** Measure authored visibility on the output frame grid, including animated ancestors and offscreen motion. */
export const SCENE_VISIBILITY_SCRIPT = String.raw`
function measureSceneLayers() {
  const entries = layers.filter(layer => layer.kind === 'element' && !overrides[layer.key]?.deleted)
    .map(layer => ({ layer, node: root.querySelector(layer.selector), ranges: [], open: null }));
  if (!entries.length || !timeline?.totalTime || !root.getBoundingClientRect) return;
  const fps = Number(root.closest('[data-fps]')?.getAttribute('data-fps') || 30);
  const duration = Number(variables.__editorDuration || timeline.duration());
  const saved = timeline.totalTime();
  const visibility = root.style.getPropertyValue('visibility');
  const priority = root.style.getPropertyPriority('visibility');
  root.style.setProperty('visibility', 'visible', 'important');
  const bounds = root.getBoundingClientRect();
  if (!bounds.width || !bounds.height) {
    if (visibility) root.style.setProperty('visibility', visibility, priority); else root.style.removeProperty('visibility');
    return;
  }
  function visible(node) {
    if (!node?.isConnected) return false;
    const rect = node.getBoundingClientRect();
    if (rect.right <= bounds.left || rect.left >= bounds.right || rect.bottom <= bounds.top || rect.top >= bounds.bottom || !rect.width || !rect.height) return false;
    let opacity = 1;
    for (let current = node; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      opacity *= Number(style.opacity);
      if (opacity <= .001 || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      if (current === root) break;
    }
    return true;
  }
  try {
    const frames = Math.ceil(duration * fps);
    for (let frame = 0; frame <= frames; frame++) {
      const time = Math.min(duration, frame / fps);
      if (frame < frames) timeline.totalTime(time, true);
      for (const entry of entries) {
        const shown = frame < frames && visible(entry.node);
        if (shown && entry.open === null) entry.open = time;
        if (!shown && entry.open !== null) {
          entry.ranges.push({ start: entry.open, duration: time - entry.open });
          entry.open = null;
        }
      }
    }
    for (const { layer, ranges } of entries) {
      layer.ranges = ranges;
      if (ranges.length) {
        layer.start = overrides[layer.key]?.start ?? ranges[0].start;
        const last = ranges[ranges.length - 1];
        layer.duration = overrides[layer.key]?.duration ?? last.start + last.duration - layer.start;
      }
    }
  } finally {
    timeline.totalTime(saved, true);
    if (visibility) root.style.setProperty('visibility', visibility, priority); else root.style.removeProperty('visibility');
  }
}
`;

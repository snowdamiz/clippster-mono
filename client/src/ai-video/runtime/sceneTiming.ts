import { sceneLayerScript } from './sceneLayers';
/** Scale authored scene animation when the user ripple-trims its owning segment. */
const MARKER = /<script data-ai-editor-timing>[\s\S]*?<\/script>\s*/g;
const LAYERS = /<script data-ai-editor-layers>[\s\S]*?<\/script>\s*/g;
export function withSceneTiming(source: string): string {
  const clean = withoutSceneTiming(source);
  const id = /data-composition-id\s*=\s*["']([^"']+)["']/.exec(clean)?.[1];
  if (!id) return clean;
  const script = `<script data-ai-editor-timing>(function(){const scale=Number(window.__hyperframes.getVariables().__editorTimeScale || 1);const tl=window.__timelines[${JSON.stringify(id)}];if(!tl || !Number.isFinite(scale) || scale<=0 || scale===1)return;const children=tl.getChildren(false,true,true).map(child=>({child,start:child.startTime(),duration:child.duration()}));for(const item of children){item.child.duration(item.duration*scale);item.child.startTime(item.start*scale);}tl.invalidate();})();</script>`;
  return /<\/template>/i.test(clean)
    ? clean.replace(/<\/template>/i, `${script}${sceneLayerScript(id)}</template>`)
    : clean.replace(/<\/body>/i, `${script}${sceneLayerScript(id)}</body>`);
}
export function withoutSceneTiming(source: string): string {
  return source.replace(MARKER, '').replace(LAYERS, '');
}

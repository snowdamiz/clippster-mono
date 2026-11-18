import type { EditDocument } from '../ai-video/types';
import { escapeHtml } from '../ai-video/compiler/compile';

/** Static, deterministic Hyperframes card; all user text is escaped before HTML insertion. */
export function creatorSkillCardComposition(
  id: string,
  label: string,
  format: EditDocument['format'],
  placement: 'top-left' | 'top-right',
  extra: { style?: string; markup?: string; timeline?: string } = {},
): string {
  const fontSize = Math.max(26, Math.round(format.width * (placement === 'top-left' ? 0.039 : 0.035)));
  const position = placement === 'top-left' ? 'top:5%;left:5%;border-left:.16em solid #facc15' : 'top:2%;right:4%;border:2px solid #facc15;border-radius:.2em';
  return `<!doctype html><html lang="en"><body><template>
<style>#root{position:absolute;inset:0;overflow:hidden;font-family:Arial,sans-serif;color:#fff}#card{position:absolute;${position};max-width:90%;padding:.35em .55em;background:rgba(5,9,17,.92);font-size:${fontSize}px;font-weight:800;line-height:1.15;overflow-wrap:anywhere;box-sizing:border-box}${extra.style ?? ''}</style>
<div id="root" data-composition-id="${id}" data-width="${format.width}" data-height="${format.height}"><div id="card">${escapeHtml(label)}</div>${extra.markup ?? ''}</div>
<script>(function(){const tl=gsap.timeline({paused:true});${extra.timeline ?? ''}window.__timelines[${JSON.stringify(id)}]=tl;})();</script>
</template></body></html>`;
}

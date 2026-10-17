import type { ClipTextBoxState } from '@clippster/shared-types'

/** Positions use the desktop percentage coordinates; canvas adapters provide PNG export. */
export function drawClipText(context: CanvasRenderingContext2D, box: ClipTextBoxState, width: number, height: number) {
  const style = box.style, scale = height / (box.previewHeight || 1080), size = style.fontSize * scale
  context.font = `${style.fontWeight} ${size}px "${style.fontFamily}", sans-serif`; context.textBaseline = 'middle'
  const padding = style.padding * scale, maxWidth = Math.max(1, width * box.widthPct / 100 - padding * 2)
  let text = box.text
  if (style.textTransform === 'uppercase') text = text.toUpperCase()
  if (style.textTransform === 'lowercase') text = text.toLowerCase()
  if (style.textTransform === 'capitalize') text = text.replace(/\b\w/g, value => value.toUpperCase())
  const spacing = style.letterSpacing * scale
  const measure = (value: string) => context.measureText(value).width + Math.max(0, [...value].length - 1) * spacing
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) { const next = line ? `${line} ${word}` : word; if (line && measure(next) > maxWidth) { lines.push(line); line = word } else line = next }
    lines.push(line)
  }
  const lineHeight = size * style.lineHeight, blockWidth = Math.min(maxWidth, Math.max(0, ...lines.map(measure))), blockHeight = lines.length * lineHeight
  const x = width * box.positionX / 100 + style.textOffsetX * scale, y = height * box.positionY / 100 + style.textOffsetY * scale
  if (style.backgroundEnabled && style.backgroundColor) {
    context.fillStyle = style.backgroundColor; context.beginPath(); context.roundRect(x - blockWidth / 2 - padding, y - blockHeight / 2 - padding, blockWidth + padding * 2, blockHeight + padding * 2, Math.min(style.borderRadius * scale, (blockHeight + padding * 2) / 2)); context.fill()
  }
  context.fillStyle = style.color; context.lineJoin = 'round'
  if (style.shadowEnabled) { context.shadowColor = style.shadowColor; context.shadowBlur = style.shadowBlur * scale; context.shadowOffsetX = style.shadowOffsetX * scale; context.shadowOffsetY = style.shadowOffsetY * scale }
  lines.forEach((line, index) => {
    let left = x - (style.textAlign === 'center' ? measure(line) / 2 : blockWidth / 2)
    if (style.textAlign === 'right') left = x + blockWidth / 2 - measure(line)
    const top = y - blockHeight / 2 + (index + 0.5) * lineHeight
    for (const character of line) {
      for (const [stroke, color] of [[style.border1Width + style.border2Width, style.border2Color], [style.border1Width, style.border1Color], [style.strokeEnabled ? style.strokeWidth : 0, style.strokeColor]] as const) if (stroke > 0) { context.strokeStyle = color; context.lineWidth = stroke * scale * 2; context.strokeText(character, left, top) }
      context.fillText(character, left, top); left += context.measureText(character).width + spacing
    }
  })
}

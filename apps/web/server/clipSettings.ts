import { z } from 'zod'
import { createDefaultSubtitleSettings, createDefaultClipTextBoxState } from '@clippster/shared-types'
import type { ManualFramingConfig, SubtitleSettings, ClipTextBoxState, WebBranding } from '@clippster/shared-types'
import { requireValue } from './errors'
const bounded = (low: number, high: number) => z.number().finite().min(low).max(high)
const rectangle = z.object({ x: bounded(0, 1), y: bounded(0, 1), width: bounded(0.01, 1), height: bounded(0.01, 1) })
  .refine(rect => rect.x + rect.width <= 1.001 && rect.y + rect.height <= 1.001, 'Region must fit inside the frame')
const color = z.string().max(80).regex(/^(?:#[0-9a-f]{3,8}|transparent|rgba?\([\d.% ,]+\))$/i)
const font = z.string().min(1).max(100).regex(/^[a-zA-Z0-9 _,-]+$/)
const region = z.object({ id: z.string().max(100), color, label: z.string().max(80).optional(), source: rectangle, output: rectangle, aspectRatioLocked: z.boolean().optional(), cornerRadiusEnabled: z.boolean().optional(), cornerRadiusPx: bounded(0, 500).optional(), mediaAssetId: z.string().uuid().optional(), mediaType: z.enum(['video-crop', 'image', 'video']).optional(), mediaSourceOffset: bounded(0, 86400).optional() })
const framing = z.object({ mode: z.literal('manual'), targetAspectRatio: z.enum(['9:16', '16:9', '1:1', '4:5']), sourceAspectRatio: z.string().regex(/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/).max(40).optional(), regions: z.array(region).max(6), sourceFrameMode: z.enum(['none', 'scale', 'use16x9']).optional(), blurEnabled: z.boolean().optional(), blurAmount: bounded(0, 30).optional(), sourceTransform: z.object({ scale: bounded(0.1, 4), x: bounded(-1, 1), y: bounded(-1, 1) }).optional(),
  segmentConfigs: z.array(z.object({ segmentId: z.string().max(100), startTime: bounded(0, 86400), endTime: bounded(0, 86400), regions: z.array(region).max(6) }).refine(segment => segment.endTime > segment.startTime)).max(50)
    .refine(segments => [...segments].sort((a, b) => a.startTime - b.startTime).every((segment, i, all) => i === 0 || segment.startTime >= all[i - 1].endTime), 'Framing segments must not overlap').optional(),
  brollConfigs: z.array(z.object({ brollId: z.string().uuid(), startTime: bounded(0, 86400), endTime: bounded(0, 86400), region, suggestionId: z.string().max(100).optional() }).refine(part => part.endTime > part.startTime)).max(30).optional() })
const subtitles = z.object({ enabled: z.boolean().optional(), fontFamily: font, fontSize: bounded(8, 200), fontWeight: bounded(100, 900), textColor: color, highlightColor: color,
  border1Color: color, border1Width: bounded(0, 20), border2Color: color, border2Width: bounded(0, 20), shadowBlur: bounded(0, 50), positionPercentage: bounded(0, 100), letterSpacing: bounded(-5, 20), animationStyle: z.enum(['none', 'karaoke', 'zoom', 'pop', 'glow', 'box-highlight', 'typewriter', 'wave', 'single-word']),
  backgroundColor: color.optional(), backgroundEnabled: z.boolean().optional(), shadowOffsetX: bounded(-50, 50).optional(), shadowOffsetY: bounded(-50, 50).optional(), shadowColor: color.optional(), position: z.enum(['top', 'middle', 'bottom']).optional(), maxWidth: bounded(10, 100).optional(), multiColorEnabled: z.boolean().optional(), multiColorMode: z.enum(['default', 'custom']).optional(), colorPalette: z.array(color).max(12).optional(), lineHeight: bounded(0.5, 3).optional(), textAlign: z.enum(['left', 'center', 'right']).optional(), textOffsetX: bounded(-1000, 1000).optional(), textOffsetY: bounded(-1000, 1000).optional(), padding: bounded(0, 80).optional(), borderRadius: bounded(0, 100).optional(), wordSpacing: bounded(0, 3).optional(), selectedPresetId: z.string().max(100).nullable().optional() })
const textStyle = z.object({ fontFamily: font, fontSize: bounded(8, 200), fontWeight: bounded(100, 900), color, backgroundEnabled: z.boolean(), backgroundColor: color.nullable().optional(), highlightColor: color.optional(), border1Width: bounded(0, 48).optional(), border1Color: color.optional(), border2Width: bounded(0, 48).optional(), border2Color: color.optional(), strokeEnabled: z.boolean().optional(), strokeColor: color.optional(), strokeWidth: bounded(0, 48).optional(), shadowEnabled: z.boolean().optional(), shadowColor: color.optional(), shadowBlur: bounded(0, 100).optional(), shadowOffsetX: bounded(-100, 100).optional(), shadowOffsetY: bounded(-100, 100).optional(), borderRadius: bounded(0, 100).optional(), padding: bounded(0, 100).optional(), letterSpacing: bounded(-10, 50).optional(), lineHeight: bounded(0.5, 3).optional(), wordSpacing: bounded(0, 3).optional(), textAlign: z.enum(['left', 'center', 'right']).optional(), maxWidth: bounded(10, 100).optional(), width: bounded(10, 100).optional(), textOffsetX: bounded(-1000, 1000).optional(), textOffsetY: bounded(-1000, 1000).optional(), textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional() })
const ratios = z.enum(['16:9', '9:16', '1:1', '4:5'])
export function validateFramingConfigs(value: unknown): Record<string, ManualFramingConfig> {
  const parsed = z.record(ratios, framing).safeParse(value)
  requireValue(parsed.success, 400, 'Invalid aspect ratio framing configurations.')
  return parsed.data
}
const position = z.object({ x: bounded(0, 100), y: bounded(0, 100) })
const subtitleOverride = subtitles.partial().omit({ position: true }).extend({ fontSize: bounded(8, 200), positionPercentage: bounded(0, 100), position: position.optional(), presetId: z.string().max(100).optional() })
const subtitlesWithRatios = subtitles.extend({ perRatioConfigs: z.record(ratios, subtitleOverride).optional() })
const textBox = z.object({ enabled: z.boolean(), text: z.string().max(500), startTime: bounded(0, 86400), endTime: bounded(0.1, 86400), positionX: bounded(0, 100), positionY: bounded(0, 100), widthPct: bounded(10, 100), previewHeight: bounded(100, 4320).optional(), style: textStyle, perRatioConfigs: z.record(ratios, z.object({ position, style: textStyle, rotation: bounded(-360, 360).optional(), scale: bounded(.1, 10).optional() })).optional() }).refine(box => box.endTime > box.startTime)
const branding = z.object({ organizationId: z.number().int().positive().optional(), brandingProfileId: z.number().int().positive().optional(), campaignId: z.number().int().positive().optional(), creatorId: z.number().int().positive().optional(), introId: z.number().int().positive().nullable().optional(), outroId: z.number().int().positive().nullable().optional(), watermarkId: z.number().int().positive().nullable().optional(), watermarkCustom: z.boolean().optional(), watermarkOpacity: bounded(0, 1).optional(), watermarkX: bounded(0, 1), watermarkY: bounded(0, 1), watermarkWidth: bounded(0.02, 0.8) })
export function validateClipSettings(input: Record<string, unknown>): { framingConfig: ManualFramingConfig | null; subtitleSettings: SubtitleSettings | null; textBox: ClipTextBoxState | null; branding: WebBranding | null } {
  const frame = input.framingConfig == null ? null : framing.safeParse(input.framingConfig)
  requireValue(frame === null || frame.success, 400, 'Invalid framing regions.')
  const subtitle = input.subtitleSettings == null ? null : subtitlesWithRatios.safeParse(input.subtitleSettings)
  requireValue(subtitle === null || subtitle.success, 400, 'Invalid subtitle settings.')
  const text = input.textBox == null ? null : textBox.safeParse(input.textBox)
  requireValue(text === null || text.success, 400, 'Invalid text overlay settings.')
  const brand = input.branding == null ? null : branding.safeParse(input.branding)
  requireValue(brand === null || brand.success, 400, 'Invalid branding settings.')
  return {
    framingConfig: frame?.success ? frame.data : null,
    subtitleSettings: subtitle?.success ? { ...createDefaultSubtitleSettings(), ...subtitle.data } : null,
    textBox: text?.success ? { ...createDefaultClipTextBoxState(text.data.endTime), ...text.data, style: { ...createDefaultClipTextBoxState(1).style, ...text.data.style }, perRatioConfigs: text.data.perRatioConfigs ? Object.fromEntries(Object.entries(text.data.perRatioConfigs).map(([ratio, value]) => [ratio, { ...value, style: { ...createDefaultClipTextBoxState(1).style, ...value.style } }])) : undefined } : null,
    branding: brand?.success ? brand.data : null,
  }
}

import { join } from 'node:path'
import { rename } from 'node:fs/promises'
import { TARGET_DIMENSIONS, isFreePlan } from '@clippster/shared-types'
import type { WebClip, PlanAccount } from '@clippster/shared-types'
import type { ApiClient } from '@clippster/api-client'
import type { Config } from './config'
import { downloadAsset } from './network'
import { probe } from './media'
import { run } from './process'
import { requireValue } from './errors'
import { targetBranding } from './targetBranding'

interface Asset { id: number; asset_type: string; url: string }
interface Profile { id: number; intro_id?: number; outro_id?: number; watermark_id?: number; intro_ratio_settings?: Record<string, { assetId?: number; enabled?: boolean }>; outro_ratio_settings?: Record<string, { assetId?: number; enabled?: boolean }>; watermark_settings?: Record<string, { watermarkId?: number; enabled?: boolean; position?: { x?: number; y?: number; scale?: number; opacity?: number } }> }

export async function applyBranding(clip: WebClip, clipPath: string, work: string, config: Config, signal: AbortSignal, upstream: ApiClient, user: PlanAccount) {
  let intro: string | undefined, outro: string | undefined, watermark: string | undefined
  let x = clip.branding?.watermarkX ?? 0.95, y = clip.branding?.watermarkY ?? 0.05, size = clip.branding?.watermarkWidth ?? 0.15
  let opacity = 1, centered = false
  if (isFreePlan(user)) {
    const result = await upstream.get<{ success: boolean; branding?: { watermark_url?: string; watermark_settings?: Record<string, { position?: { x?: number; y?: number; scale?: number; opacity?: number } }>; intro_settings?: Record<string, { url?: string }>; outro_settings?: Record<string, { url?: string }> } }>('/app-settings/free-tier-branding')
    requireValue(result.success, 502, 'Unable to check Free plan branding. Please retry.')
    watermark = result.branding?.watermark_url
    intro = result.branding?.intro_settings?.[clip.aspectRatio]?.url
    outro = result.branding?.outro_settings?.[clip.aspectRatio]?.url
    const position = result.branding?.watermark_settings?.[clip.aspectRatio]?.position
    const percent = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) / 100 : fallback
    x = percent(position?.x, 0.12); y = percent(position?.y, 0.92); size = Math.max(0.01, percent(position?.scale, 0.2)); opacity = percent(position?.opacity, 0.8); centered = true
  } else if (clip.branding?.organizationId) {
    const branding = await targetBranding(clip.branding, clip.aspectRatio, upstream)
    intro = branding.intro; outro = branding.outro; watermark = branding.watermark
    if (branding.position) { x = branding.position.x / 100; y = branding.position.y / 100; size = branding.position.scale / 100; opacity = branding.position.opacity / 100; centered = true }
  } else if (clip.branding) {
    const result = await upstream.get<{ success: boolean; assets: Asset[]; profiles: Profile[] }>('/user/branding')
    requireValue(result.success, 502, 'Unable to load creator branding.')
    const profile = clip.branding.creatorId ? result.profiles.find(profile => profile.id === clip.branding!.creatorId) : undefined
    requireValue(!clip.branding.creatorId || profile, 403, 'Creator profile is no longer available.')
    const resolve = (id: number | null | undefined, type: string) => {
      if (!id) return undefined
      const asset = result.assets.find(asset => asset.id === id && asset.asset_type === type)
      requireValue(asset, 403, `The selected ${type} is not available in your account.`)
      return asset.url
    }
    const introRatio = profile?.intro_ratio_settings?.[clip.aspectRatio], outroRatio = profile?.outro_ratio_settings?.[clip.aspectRatio], watermarkRatio = profile?.watermark_settings?.[clip.aspectRatio]
    intro = resolve(clip.branding.introId !== undefined ? clip.branding.introId : introRatio?.enabled === false ? null : introRatio?.assetId || profile?.intro_id, 'intro')
    outro = resolve(clip.branding.outroId !== undefined ? clip.branding.outroId : outroRatio?.enabled === false ? null : outroRatio?.assetId || profile?.outro_id, 'outro')
    watermark = resolve(clip.branding.watermarkId !== undefined ? clip.branding.watermarkId : watermarkRatio?.enabled === false ? undefined : watermarkRatio?.watermarkId || profile?.watermark_id, 'watermark')
    if (clip.branding.watermarkCustom) { opacity = clip.branding.watermarkOpacity ?? .8; centered = true }
    else if (watermarkRatio?.position) { const percent = (value: number | undefined, fallback: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, Number(value) / 100)) : fallback; x = percent(watermarkRatio.position.x, .12); y = percent(watermarkRatio.position.y, .92); size = Math.max(.01, percent(watermarkRatio.position.scale, .2)); opacity = percent(watermarkRatio.position.opacity, .8); centered = true }
  }
  if (!intro && !outro && !watermark) return
  const { width, height } = TARGET_DIMENSIONS[clip.aspectRatio]
  const local = ['-protocol_whitelist', 'file,pipe']
  const fps = clip.exportSettings?.frameRate || 30
  const encode = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(clip.exportSettings?.quality === 'low' ? 28 : clip.exportSettings?.quality === 'high' ? 18 : 23), '-r', String(fps), '-threads', '2', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', '-fs', String(config.maxSourceBytes)]
  const verifyDuration = async (path: string, expected: number) => {
    const output = await probe(path, config, signal)
    requireValue(Math.abs(output.duration - expected) < 1, 400, 'Branded output exceeded the size limit or could not be rendered completely.')
  }
  if (watermark) {
    const input = join(work, 'watermark')
    await downloadAsset(watermark, input, signal, 10 * 1024 ** 2)
    const original = await probe(clipPath, config, signal)
    await run(config.ffmpeg, ['-hide_banner', '-loglevel', 'error', ...local, '-i', clipPath, ...local, '-format_whitelist', 'png_pipe,jpeg_pipe,mjpeg,webp_pipe', '-i', input,
      '-filter_complex', `[1:v]scale=${Math.round(width * size)}:-1,format=rgba,colorchannelmixer=aa=${opacity}[wm];[0:v][wm]overlay=${centered ? `W*${x}-w/2:H*${y}-h/2` : `(W-w)*${x}:(H-h)*${y}`}:eof_action=repeat[v]`, '-map', '[v]', '-map', '0:a?', ...encode, '-y', join(work, 'watermarked.mp4')], signal)
    await verifyDuration(join(work, 'watermarked.mp4'), original.duration)
    await rename(join(work, 'watermarked.mp4'), clipPath)
  }
  if (intro || outro) {
    const inputs: string[] = []
    if (intro) { const path = join(work, 'intro-source'); await downloadAsset(intro, path, signal); inputs.push(path) }
    inputs.push(clipPath)
    if (outro) { const path = join(work, 'outro-source'); await downloadAsset(outro, path, signal); inputs.push(path) }
    const normalized: string[] = []
    let totalDuration = 0
    for (const [index, input] of inputs.entries()) {
      const metadata = await probe(input, config, signal)
      totalDuration += metadata.duration
      requireValue(input === clipPath || metadata.duration <= 60, 400, 'Intro and outro assets must be at most 60 seconds.')
      const output = join(work, `branding-${index}.mp4`)
      await run(config.ffmpeg, ['-hide_banner', '-loglevel', 'error', ...local, '-i', input,
        ...(!metadata.hasAudio ? ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'] : []),
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}`, '-map', '0:v:0', '-map', metadata.hasAudio ? '0:a:0' : '1:a:0', '-ar', '48000', '-ac', '2', '-t', String(metadata.duration), ...encode, '-y', output], signal)
      await verifyDuration(output, metadata.duration)
      normalized.push(output)
    }
    await run(config.ffmpeg, ['-hide_banner', '-loglevel', 'error', ...normalized.flatMap(path => [...local, '-i', path]), '-filter_complex', `${normalized.map((_, i) => `[${i}:v][${i}:a]`).join('')}concat=n=${normalized.length}:v=1:a=1[v][a]`, '-map', '[v]', '-map', '[a]', ...encode, '-y', join(work, 'branded.mp4')], signal)
    await verifyDuration(join(work, 'branded.mp4'), totalDuration)
    await rename(join(work, 'branded.mp4'), clipPath)
  }
}

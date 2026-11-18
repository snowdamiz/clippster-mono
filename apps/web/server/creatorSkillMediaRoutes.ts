import { Router } from 'express'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import type { WebClip } from '@clippster/shared-types'
import { CREATOR_SKILL_DOCUMENT_NAMES } from '@clippster/shared-types'
import type { Store } from './store'
import type { Config } from './config'
import { projectDirectory } from './storage'
import { requireValue } from './errors'
import { creatorSkillDocuments } from '../../../client/src/services/creatorSkillDocuments'
import { creatorSkillZip, type CreatorSkillZipEntry } from './creatorSkillZip'

async function deliveryDocuments(clip: WebClip, skillDir: string): Promise<Record<string, string>> {
  const state = clip.creatorSkill
  requireValue(state?.playbookPackage, 404, 'Playbook package not found.')
  const build = clip.builds?.slice().reverse().find(item => item.origin === 'creator_skill' && item.revision === clip.revision)
  const availableFiles = [
    ...(build && clip.builtRevision === clip.revision ? ['Edited master MP4'] : []),
    ...(state.captionsAvailable ? ['Draft captions SRT'] : []),
    ...(state.contactSheetAvailable ? ['Visual contact sheet JPEG'] : []),
    ...(state.phonePreviewAvailable ? ['Phone preview MP4'] : []),
    ...(state.noMusicAvailable ? ['No-music edited master MP4'] : []),
    ...(state.tiktokSafeAvailable ? ['TikTok cut before sponsor read MP4'] : []),
    ...(state.tiktokCaptionsAvailable ? ['Sponsor-free TikTok captions SRT'] : []),
    ...(state.thumbnailVariants?.map(variant => `Thumbnail review draft ${String.fromCharCode(65 + variant.index)} PNG`) ?? []),
    ...(state.sourceCaptures?.map(capture => `Public ${capture.kind} page capture ${capture.index + 1} TXT`) ?? []),
    ...(state.sourceCaptures?.filter(capture => capture.screenshotAvailable).map(capture => `Static public page screenshot ${capture.index + 1} PNG`) ?? []),
    ...CREATOR_SKILL_DOCUMENT_NAMES,
  ]
  const speechDiff = state.speechDiffAvailable ? await readFile(join(skillDir, 'speech-diff.md'), 'utf8').catch(() => undefined) : undefined
  return creatorSkillDocuments(state.playbookPackage, {
    selectedVersion: clip.selectedVersion, durationSeconds: build?.duration, availableFiles,
    reviewItems: state.reviewItems, rawClipMd5: state.rawClipMd5, masterMd5: state.masterMd5,
    sourceCaptures: state.sourceCaptures, claimEvidence: state.claimEvidence, speechDiff, soundScan: state.soundScan, creatorProfile: state.creatorProfile,
  })
}

/** Opaque, owner-scoped access to local stills and draft captions. */
export function creatorSkillMediaRoutes(store: Store, config: Config) {
  const router = Router()
  router.get('/projects/:id/clips/:clipId/creator-skill/thumbnails/:index', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(item => item.id === req.params.clipId)
    const index = Number(req.params.index)
    requireValue(clip, 404, 'Clip not found.')
    requireValue(clip.creatorSkill?.thumbnailCandidates?.some(item => item.index === index), 404, 'Thumbnail not found.')
    res.type('image/jpeg').sendFile(join(projectDirectory(config, project.id), 'creator-skill', clip.id, `thumbnail-${index}.jpg`), { cacheControl: false })
  })
  router.get('/projects/:id/clips/:clipId/creator-skill/thumbnail-variants/:index', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(item => item.id === req.params.clipId)
    const index = Number(req.params.index)
    requireValue(clip, 404, 'Clip not found.')
    requireValue(clip.creatorSkill?.thumbnailVariants?.some(item => item.index === index), 404, 'Thumbnail draft not found.')
    res.type('image/png').sendFile(join(projectDirectory(config, project.id), 'creator-skill', clip.id, `thumbnail-variant-${index}.png`), { cacheControl: false })
  })
  router.get('/projects/:id/clips/:clipId/creator-skill/captions', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(item => item.id === req.params.clipId)
    requireValue(clip?.creatorSkill?.captionsAvailable, 404, 'Draft captions not found.')
    res.type('text/plain').attachment(`${clip.id}-draft-captions.srt`)
      .sendFile(join(projectDirectory(config, project.id), 'creator-skill', clip.id, 'captions.srt'), { cacheControl: false })
  })
  router.get('/projects/:id/clips/:clipId/creator-skill/contact-sheet', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(item => item.id === req.params.clipId)
    requireValue(clip?.creatorSkill?.contactSheetAvailable, 404, 'Visual contact sheet not found.')
    res.type('image/jpeg').sendFile(join(projectDirectory(config, project.id), 'creator-skill', clip.id, 'contact-sheet.jpg'), { cacheControl: false })
  })
  router.get('/projects/:id/clips/:clipId/creator-skill/phone-preview', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(item => item.id === req.params.clipId)
    requireValue(clip?.creatorSkill?.phonePreviewAvailable, 404, 'Phone preview not found.')
    res.type('video/mp4').attachment(`${clip.id}-phone-preview.mp4`)
      .sendFile(join(projectDirectory(config, project.id), 'creator-skill', clip.id, 'phone-preview.mp4'), { cacheControl: false })
  })
  router.get('/projects/:id/clips/:clipId/creator-skill/tiktok-no-sponsor', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(item => item.id === req.params.clipId)
    requireValue(clip?.creatorSkill?.tiktokSafeAvailable, 404, 'Sponsor-free TikTok cut not found.')
    res.type('video/mp4').attachment(`${clip.id}-tiktok-no-sponsor.mp4`)
      .sendFile(join(projectDirectory(config, project.id), 'creator-skill', clip.id, 'tiktok-no-sponsor.mp4'), { cacheControl: false })
  })
  router.get('/projects/:id/clips/:clipId/creator-skill/no-music', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(item => item.id === req.params.clipId)
    requireValue(clip?.creatorSkill?.noMusicAvailable, 404, 'No-music edit not found.')
    res.type('video/mp4').attachment(`${clip.id}-edited-no-music.mp4`)
      .sendFile(join(projectDirectory(config, project.id), 'creator-skill', clip.id, 'edited-no-music.mp4'), { cacheControl: false })
  })
  router.get('/projects/:id/clips/:clipId/creator-skill/tiktok-no-sponsor-captions', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(item => item.id === req.params.clipId)
    requireValue(clip?.creatorSkill?.tiktokCaptionsAvailable, 404, 'Sponsor-free TikTok captions not found.')
    res.type('text/plain').attachment(`${clip.id}-tiktok-no-sponsor.srt`)
      .sendFile(join(projectDirectory(config, project.id), 'creator-skill', clip.id, 'tiktok-no-sponsor.srt'), { cacheControl: false })
  })
  router.get('/projects/:id/clips/:clipId/creator-skill/source-captures/:index', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(item => item.id === req.params.clipId)
    const index = Number(req.params.index)
    requireValue(clip, 404, 'Clip not found.')
    requireValue(Number.isSafeInteger(index) && index >= 0 && clip.creatorSkill?.sourceCaptures?.some(capture => capture.index === index), 404, 'Source capture not found.')
    res.type('text/plain').attachment(`${clip.id}-source-${index}.txt`)
      .sendFile(join(projectDirectory(config, project.id), 'creator-skill', clip.id, 'source-captures', `${index}.txt`), { cacheControl: false })
  })
  router.get('/projects/:id/clips/:clipId/creator-skill/source-captures/:index/screenshot', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(item => item.id === req.params.clipId)
    const index = Number(req.params.index)
    requireValue(clip, 404, 'Clip not found.')
    requireValue(clip?.creatorSkill?.sourceCaptures?.some(capture => capture.index === index && capture.screenshotAvailable), 404, 'Static page screenshot not found.')
    res.type('image/png').sendFile(join(projectDirectory(config, project.id), 'creator-skill', clip.id, 'source-captures', `${index}.png`), { cacheControl: false })
  })
  router.get('/projects/:id/clips/:clipId/creator-skill/documents/:name', async (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(item => item.id === req.params.clipId)
    requireValue(clip, 404, 'Clip not found.')
    const documents = await deliveryDocuments(clip, join(projectDirectory(config, project.id), 'creator-skill', clip.id))
    const name = String(req.params.name)
    requireValue(Object.hasOwn(documents, name), 404, 'Document not found.')
    res.type('text/markdown').attachment(`${clip.id}-${name}`).send(documents[name])
  })
  router.get('/projects/:id/clips/:clipId/creator-skill/delivery', async (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(item => item.id === req.params.clipId)
    requireValue(clip?.creatorSkill?.playbookPackage, 404, 'Playbook package not found.')
    requireValue(clip.creatorSkill.status === 'needs_review' && clip.builtRevision === clip.revision, 409, 'The edited delivery is not ready.')
    const directory = projectDirectory(config, project.id)
    const skillDir = join(directory, 'creator-skill', clip.id)
    const state = clip.creatorSkill
    const documents = await deliveryDocuments(clip, skillDir)
    const entries: CreatorSkillZipEntry[] = [
      { name: 'raw.mp4', path: join(skillDir, `creator-skill-${clip.id}.mp4`) },
      { name: 'edited-master.mp4', path: join(directory, `${clip.id}.mp4`) },
      ...(state.captionsAvailable ? [{ name: 'captions.srt', path: join(skillDir, 'captions.srt') }] : []),
      ...(state.contactSheetAvailable ? [{ name: 'contact-sheet.jpg', path: join(skillDir, 'contact-sheet.jpg') }] : []),
      ...(state.phonePreviewAvailable ? [{ name: 'phone-preview.mp4', path: join(skillDir, 'phone-preview.mp4') }] : []),
      ...(state.noMusicAvailable ? [{ name: 'edited-no-music.mp4', path: join(skillDir, 'edited-no-music.mp4') }] : []),
      ...(state.tiktokSafeAvailable ? [{ name: 'tiktok-no-sponsor.mp4', path: join(skillDir, 'tiktok-no-sponsor.mp4') }] : []),
      ...(state.tiktokCaptionsAvailable ? [{ name: 'tiktok-no-sponsor.srt', path: join(skillDir, 'tiktok-no-sponsor.srt') }] : []),
      ...(state.thumbnailCandidates?.map(candidate => ({ name: `thumbnail-source-frames/${candidate.index}.jpg`, path: join(skillDir, `thumbnail-${candidate.index}.jpg`) })) ?? []),
      ...(state.thumbnailVariants?.map(variant => ({ name: `thumbnails/${String.fromCharCode(65 + variant.index)}.png`, path: join(skillDir, `thumbnail-variant-${variant.index}.png`) })) ?? []),
      ...(state.sourceCaptures?.map(capture => ({ name: `source-captures/${capture.index}.txt`, path: join(skillDir, 'source-captures', `${capture.index}.txt`) })) ?? []),
      ...(state.sourceCaptures?.filter(capture => capture.screenshotAvailable).map(capture => ({ name: `source-captures/${capture.index}.png`, path: join(skillDir, 'source-captures', `${capture.index}.png`) })) ?? []),
      ...Object.entries(documents).map(([name, content]) => ({ name, content: Buffer.from(content) })),
    ]
    const folder = `${new Date().toISOString().slice(0, 10)}-${clip.id}`
    res.type('application/zip').attachment(`${folder}.zip`)
    await pipeline(Readable.from(creatorSkillZip(entries, folder, { 'raw.mp4': state.rawClipMd5 ?? '', 'edited-master.mp4': state.masterMd5 ?? '' })), res)
  })
  return router
}

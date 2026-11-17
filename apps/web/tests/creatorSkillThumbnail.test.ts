import { expect, it } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { CREATOR_SKILL_THUMBNAIL_SIZE, drawCreatorSkillThumbnail } from '../../../client/src/services/creatorSkillThumbnail'

it('renders a full-size A/B draft without recoloring the source frame', () => {
  const frame = createCanvas(1080, 1920)
  const source = frame.getContext('2d')
  source.fillStyle = '#ff0000'
  source.fillRect(0, 0, frame.width, frame.height)
  for (const index of [0, 1]) {
    const output = createCanvas(CREATOR_SKILL_THUMBNAIL_SIZE.width, CREATOR_SKILL_THUMBNAIL_SIZE.height)
    const context = output.getContext('2d')
    drawCreatorSkillThumbnail(context as unknown as CanvasRenderingContext2D, frame as unknown as CanvasImageSource, frame, 'WHAT HAPPENED', index)
    const imageX = index === 0 ? 870 : 410
    expect([...context.getImageData(imageX, 100, 1, 1).data].slice(0, 3)).toEqual([255, 0, 0])
    const paddingX = index === 0 ? 500 : 25
    expect([...context.getImageData(paddingX, 100, 1, 1).data].slice(0, 3)).toEqual([17, 24, 39])
    expect(output.toBuffer('image/png').subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  }
})

it('uses a saved hex brand accent without changing the VOD frame', () => {
  const frame = createCanvas(1280, 720)
  const source = frame.getContext('2d')
  source.fillStyle = '#ff0000'
  source.fillRect(0, 0, frame.width, frame.height)
  const output = createCanvas(CREATOR_SKILL_THUMBNAIL_SIZE.width, CREATOR_SKILL_THUMBNAIL_SIZE.height)
  const context = output.getContext('2d')
  drawCreatorSkillThumbnail(context as unknown as CanvasRenderingContext2D, frame as unknown as CanvasImageSource, frame, 'WHAT HAPPENED', 0, undefined, ['#123456'])
  expect([...context.getImageData(5, 100, 1, 1).data].slice(0, 3)).toEqual([18, 52, 86])
  expect([...context.getImageData(870, 200, 1, 1).data].slice(0, 3)).toEqual([255, 0, 0])
})

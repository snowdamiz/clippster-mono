import { it, expect } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { randomUUID } from 'node:crypto'
import { renderLayoutRaster } from '../server/layoutRaster'
it('renders private creator overlays with opacity, position, and ratio-specific disabling', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'layout-raster-')), id = randomUUID()
  try {
    await mkdir(join(directory, 'assets'))
    const source = createCanvas(10, 10), paint = source.getContext('2d'); paint.fillStyle = '#ff0000'; paint.fillRect(0, 0, 10, 10)
    await writeFile(join(directory, 'assets', `${id}.png`), source.toBuffer('image/png'))
    const overlay = { id: randomUUID(), type: 'image', imagePath: id, x: 50, y: 50, opacity: 50, perRatioSettings: { '1:1': { scale: 20 }, '4:5': null } }
    const path = await renderLayoutRaster([overlay], '1:1', directory, directory)
    const image = await loadImage(path!), canvas = createCanvas(1080, 1080), context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
    expect([...context.getImageData(540, 540, 1, 1).data]).toEqual([255, 0, 0, 128])
    expect(context.getImageData(10, 10, 1, 1).data[3]).toBe(0)
    const disabled = await renderLayoutRaster([overlay], '4:5', directory, directory); context.clearRect(0, 0, 1080, 1080); context.drawImage(await loadImage(disabled!), 0, 0)
    expect(context.getImageData(540, 540, 1, 1).data[3]).toBe(0)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { ImageAsset, ImageAssetType, ImageSourceType, ImageExportFormat } from './types';

export interface CreateImageAssetOptions {
  name: string;
  filePath: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
  imageType?: ImageAssetType;
  sourceType?: ImageSourceType;
  sourceClipId?: string;
  sourceProjectId?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  exportFormat?: ImageExportFormat;
  editorProjectJson?: string;
}

export async function createImageAsset(opts: CreateImageAssetOptions): Promise<string>;
export async function createImageAsset(
  name: string,
  filePath: string,
  width?: number,
  height?: number,
  fileSize?: number,
  mimeType?: string
): Promise<string>;
export async function createImageAsset(
  nameOrOpts: string | CreateImageAssetOptions,
  filePath?: string,
  width?: number,
  height?: number,
  fileSize?: number,
  mimeType?: string
): Promise<string> {
  const opts: CreateImageAssetOptions = typeof nameOrOpts === 'string'
    ? { name: nameOrOpts, filePath: filePath!, width, height, fileSize, mimeType }
    : nameOrOpts;

  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    `INSERT INTO image_assets (
      id, name, file_path, width, height, file_size, mime_type,
      image_type, source_type, source_clip_id, source_project_id,
      canvas_width, canvas_height, export_format, editor_project_json,
      user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      opts.name,
      opts.filePath,
      opts.width || null,
      opts.height || null,
      opts.fileSize || null,
      opts.mimeType || null,
      opts.imageType || null,
      opts.sourceType || null,
      opts.sourceClipId || null,
      opts.sourceProjectId || null,
      opts.canvasWidth || null,
      opts.canvasHeight || null,
      opts.exportFormat || null,
      opts.editorProjectJson || null,
      userId,
      now,
      now,
    ]
  );

  return id;
}

export async function getAllImageAssets(): Promise<ImageAsset[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<ImageAsset[]>(
      'SELECT * FROM image_assets WHERE user_id IS NULL ORDER BY created_at DESC'
    );
  }

  return await db.select<ImageAsset[]>(
    'SELECT * FROM image_assets WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC',
    [userId]
  );
}

export async function getImageAssetsByType(imageType: ImageAssetType): Promise<ImageAsset[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<ImageAsset[]>(
      'SELECT * FROM image_assets WHERE user_id IS NULL AND image_type = ? ORDER BY created_at DESC',
      [imageType]
    );
  }

  return await db.select<ImageAsset[]>(
    'SELECT * FROM image_assets WHERE (user_id = ? OR user_id IS NULL) AND image_type = ? ORDER BY created_at DESC',
    [userId, imageType]
  );
}

export async function getImageAssetsBySource(sourceType: ImageSourceType): Promise<ImageAsset[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<ImageAsset[]>(
      'SELECT * FROM image_assets WHERE user_id IS NULL AND source_type = ? ORDER BY created_at DESC',
      [sourceType]
    );
  }

  return await db.select<ImageAsset[]>(
    'SELECT * FROM image_assets WHERE (user_id = ? OR user_id IS NULL) AND source_type = ? ORDER BY created_at DESC',
    [userId, sourceType]
  );
}

export async function getImageAsset(id: string): Promise<ImageAsset | null> {
  const db = await getDatabase();
  const results = await db.select<ImageAsset[]>('SELECT * FROM image_assets WHERE id = ?', [id]);
  return results.length > 0 ? results[0] : null;
}

export interface UpdateImageAssetOptions {
  name?: string;
  width?: number;
  height?: number;
  file_size?: number;
  mime_type?: string;
  image_type?: ImageAssetType;
  source_type?: ImageSourceType;
  source_clip_id?: string;
  source_project_id?: string;
  canvas_width?: number;
  canvas_height?: number;
  export_format?: ImageExportFormat;
  editor_project_json?: string;
}

export async function updateImageAsset(
  id: string,
  updates: UpdateImageAssetOptions
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const setClause: string[] = ['updated_at = ?'];
  const params: any[] = [now];

  const fields: (keyof UpdateImageAssetOptions)[] = [
    'name', 'width', 'height', 'file_size', 'mime_type',
    'image_type', 'source_type', 'source_clip_id', 'source_project_id',
    'canvas_width', 'canvas_height', 'export_format', 'editor_project_json',
  ];

  for (const field of fields) {
    if (updates[field] !== undefined) {
      setClause.push(`${field} = ?`);
      params.push(updates[field]);
    }
  }

  params.push(id);
  await db.execute(`UPDATE image_assets SET ${setClause.join(', ')} WHERE id = ?`, params);
}

export async function deleteImageAsset(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM image_assets WHERE id = ?', [id]);
}

import { getDatabase, timestamp, generateId } from './core';

export interface CustomFont {
  id: string;
  name: string;
  file_name: string;
  file_path: string;
  file_type: string;
  created_at: number;
  updated_at: number;
}

/**
 * Create a new custom font entry
 */
export async function createCustomFont(
  name: string,
  fileName: string,
  filePath: string,
  fileType: string
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO custom_fonts (id, name, file_name, file_path, file_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, fileName, filePath, fileType, now, now]
  );

  return id;
}

/**
 * Get all custom fonts
 */
export async function getAllCustomFonts(): Promise<CustomFont[]> {
  const db = await getDatabase();
  const fonts = await db.select<CustomFont[]>(
    'SELECT * FROM custom_fonts ORDER BY name ASC'
  );
  return fonts;
}

/**
 * Get a custom font by ID
 */
export async function getCustomFontById(id: string): Promise<CustomFont | null> {
  const db = await getDatabase();
  const fonts = await db.select<CustomFont[]>(
    'SELECT * FROM custom_fonts WHERE id = ?',
    [id]
  );
  return fonts[0] || null;
}

/**
 * Delete a custom font
 */
export async function deleteCustomFont(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM custom_fonts WHERE id = ?', [id]);
}

/**
 * Update a custom font name
 */
export async function updateCustomFontName(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();
  await db.execute(
    'UPDATE custom_fonts SET name = ?, updated_at = ? WHERE id = ?',
    [name, now, id]
  );
}


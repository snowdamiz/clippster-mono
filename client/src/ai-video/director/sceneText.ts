import type { EditDocument, ShotScene } from '../types';

export interface SceneTextField {
  id: string;
  shotId: string;
  key: string;
  label: string;
  value: string;
}
const PREFIX = 'scene-text:';
const NON_TEXT = /color|accent|font|image|photo|screen|background|\bsrc\b|url|texture/i;

/** Expose declared copy as editable fields without flattening a designed scene or losing its animation. */
export function sceneTextFields(
  shotId: string,
  scene: ShotScene,
  files: Record<string, string> = {}
): SceneTextField[] {
  const declaration = /data-composition-variables\s*=\s*(['"])([\s\S]*?)\1/.exec(
    files[scene.composition] ?? ''
  );
  let definitions: Array<{ id: string; type?: string; label?: string; default?: unknown }> = [];
  try {
    const parsed: unknown = JSON.parse(
      (declaration?.[2] ?? '[]')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, '&')
    );
    if (Array.isArray(parsed)) definitions = parsed.filter((v) => v && typeof v.id === 'string');
  } catch {
    /* Existing projects may only have the saved variable values. */
  }
  const keys = new Set([...definitions.map((v) => v.id), ...Object.keys(scene.variables)]);
  return [...keys].flatMap((key) => {
    const definition = definitions.find((v) => v.id === key);
    const value = scene.variables[key] ?? definition?.default;
    if (
      typeof value !== 'string' ||
      key.startsWith('__editor') ||
      (definition?.type != null && definition.type !== 'string') ||
      (!definition &&
        !/text|title|headline|wordmark|caption|subtitle|heading|tagline|copy|label|cta|line\d*|brand|name/i.test(
          key
        )) ||
      NON_TEXT.test(key) ||
      /^(media:|https?:|#(?:[\da-f]{3,8})$)/i.test(value)
    )
      return [];
    return [
      {
        id: `${PREFIX}${encodeURIComponent(shotId)}:${encodeURIComponent(key)}`,
        shotId,
        key,
        label: typeof definition?.label === 'string' ? definition.label : key,
        value,
      },
    ];
  });
}

export function findSceneText(
  document: EditDocument,
  id: string | null,
  files: Record<string, string> = {}
): SceneTextField | null {
  if (!id?.startsWith(PREFIX)) return null;
  for (const shot of document.shots) {
    if (!shot.scene) continue;
    const field = sceneTextFields(shot.id, shot.scene, files).find((field) => field.id === id);
    if (field) return field;
  }
  return null;
}

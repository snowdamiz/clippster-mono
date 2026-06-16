import { ref } from 'vue';
import type { StudioTemplate } from '@/types/studio';
import { createDefaultLayout, migrateTemplate } from '@/composables/studio/useStudioLayout';

const STORAGE_KEY = 'clippster_studio_templates';
const STORAGE_VERSION_KEY = 'clippster_studio_templates_version';
const CURRENT_VERSION = 2;
const REMOVED_DEFAULT_TEMPLATE_IDS = new Set(['tpl-streamer-frame', 'tpl-gameplay-lower-third']);

function getDefaultTemplates(): StudioTemplate[] {
  const now = Date.now();
  return [
    {
      id: 'tpl-camera',
      name: 'Camera Only',
      mode: 'camera',
      aspectRatio: '16:9',
      layout: createDefaultLayout('16:9', 'camera'),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-screen',
      name: 'Screen Only',
      mode: 'screen',
      aspectRatio: '16:9',
      layout: createDefaultLayout('16:9', 'screen'),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-screen-pip',
      name: 'Screen + Camera PiP',
      mode: 'screen_camera',
      aspectRatio: '16:9',
      layout: createDefaultLayout('16:9', 'screen_camera'),
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function loadTemplates(): StudioTemplate[] {
  try {
    const version = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? '1');
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      persist(getDefaultTemplates());
      return getDefaultTemplates();
    }

    const parsed = JSON.parse(raw) as StudioTemplate[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return getDefaultTemplates();
    }

    const migrated = parsed
      .filter((t) => !REMOVED_DEFAULT_TEMPLATE_IDS.has(t.id))
      .map((t) => migrateTemplate(t));

    if (version < CURRENT_VERSION || migrated.length !== parsed.length) {
      persist(migrated);
    }

    return migrated;
  } catch {
    return getDefaultTemplates();
  }
}

function persist(templates: StudioTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_VERSION));
}

export function useStudioTemplates() {
  const templates = ref<StudioTemplate[]>(loadTemplates());

  function refresh() {
    templates.value = loadTemplates();
  }

  function saveTemplate(template: Omit<StudioTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
    const now = Date.now();
    const id = template.id || `tpl-${now}`;
    const existingIdx = templates.value.findIndex((t) => t.id === id);
    const entry: StudioTemplate = {
      ...template,
      id,
      createdAt: existingIdx >= 0 ? templates.value[existingIdx].createdAt : now,
      updatedAt: now,
    };
    if (existingIdx >= 0) {
      templates.value[existingIdx] = entry;
    } else {
      templates.value.push(entry);
    }
    persist(templates.value);
  }

  function deleteTemplate(id: string) {
    templates.value = templates.value.filter((t) => t.id !== id);
    persist(templates.value);
  }

  function applyTemplate(id: string): StudioTemplate | null {
    const found = templates.value.find((t) => t.id === id);
    return found ? migrateTemplate(found) : null;
  }

  return {
    templates,
    refresh,
    saveTemplate,
    deleteTemplate,
    applyTemplate,
  };
}

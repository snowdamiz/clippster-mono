import { toRaw } from 'vue';
import type { EditorCore } from '../core';
import type { TProject } from '../types/project';
import type { TimelineTrack } from '../types/timeline';
import type { Transition } from '../types/transitions';
import type { PreparedTemplateDraft } from './service';

/**
 * Non-history Instant Edit preview: paint a prepared plan onto the active scene
 * so creators can scrub the look before committing. Undo stack stays clean until
 * commitTemplateDraft / discardTemplatePreview.
 */
interface TemplatePreviewBaseline {
  sceneId: string;
  tracks: TimelineTrack[];
  transitions: Transition[];
  project: TProject;
}

let baseline: TemplatePreviewBaseline | null = null;

function restoreBaseline(editor: EditorCore): void {
  if (!baseline) return;
  const currentSceneId = editor.scenes.getActiveScene().id;
  editor.project.setActiveProject({ project: structuredClone(baseline.project) });
  editor.scenes.setScenes({
    scenes: editor.scenes
      .getScenes()
      .map((scene) =>
        scene.id === baseline!.sceneId
          ? {
              ...scene,
              tracks: structuredClone(baseline!.tracks),
              transitions: structuredClone(baseline!.transitions),
            }
          : scene
      ),
    activeSceneId: currentSceneId,
  });
  editor.renderer.invalidatePreviewSceneCache();
}

export function hasTemplatePreviewSession(): boolean {
  return baseline !== null;
}

export function paintTemplatePreview(editor: EditorCore, draft: PreparedTemplateDraft): void {
  const active = editor.project.getActive();
  const currentScene = editor.scenes.getActiveScene();
  if (!baseline) {
    baseline = {
      sceneId: currentScene.id,
      tracks: structuredClone(toRaw(editor.timeline.getTracks())),
      transitions: structuredClone(toRaw(currentScene.transitions ?? [])),
      project: structuredClone(toRaw(active)),
    };
  }
  const project: TProject = {
    ...active,
    settings: {
      ...active.settings,
      canvasSize: { ...draft.plan.canvasSize },
    },
    metadata: {
      ...active.metadata,
      duration: draft.plan.durationSeconds,
    },
  };
  editor.project.setActiveProject({ project });
  editor.scenes.setScenes({
    scenes: editor.scenes
      .getScenes()
      .map((scene) =>
        scene.id === baseline!.sceneId
          ? {
              ...scene,
              tracks: structuredClone(draft.plan.tracks),
              transitions: structuredClone(draft.plan.transitions),
            }
          : scene
      ),
    activeSceneId: currentScene.id,
  });
  editor.renderer.invalidatePreviewSceneCache();
}

export function discardTemplatePreview(editor: EditorCore): void {
  if (!baseline) return;
  restoreBaseline(editor);
  baseline = null;
}

/** Restore the pre-preview composition so ApplyTemplateCommand captures a real undo baseline. */
export function settleTemplatePreviewBeforeCommit(editor: EditorCore): void {
  if (!baseline) return;
  restoreBaseline(editor);
  baseline = null;
}

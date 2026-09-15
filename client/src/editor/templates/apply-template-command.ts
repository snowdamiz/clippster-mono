import { EditorCore } from '../core';
import { Command } from '../lib/commands/base-command';
import { toRaw } from 'vue';
import type { TProject } from '../types/project';
import type { TimelineTrack } from '../types/timeline';
import type { Transition } from '../types/transitions';
import type { CompiledTemplatePlan } from './compiler';

/**
 * Commits a fully-preflighted draft as one history entry, matching BytePlus's
 * prepareSource/composeSource boundary without exposing partial timeline state.
 */
export class ApplyTemplateCommand extends Command {
  private previousTracks: TimelineTrack[] | null = null;
  private previousProject: TProject | null = null;
  private previousTransitions: Transition[] | null = null;
  private sceneId: string | null = null;

  private readonly plan: CompiledTemplatePlan;

  constructor(plan: CompiledTemplatePlan) {
    super();
    this.plan = structuredClone(toRaw(plan));
  }

  execute(): void {
    const editor = EditorCore.getInstance();
    const active = editor.project.getActive();
    const currentScene = editor.scenes.getActiveScene();
    if (!this.previousTracks) {
      this.previousTracks = structuredClone(toRaw(editor.timeline.getTracks()));
      this.previousProject = structuredClone(toRaw(active));
      this.previousTransitions = structuredClone(toRaw(currentScene.transitions ?? []));
      this.sceneId = currentScene.id;
    }
    const project: TProject = {
      ...active,
      settings: {
        ...active.settings,
        canvasSize: { ...this.plan.canvasSize },
        templateInstance: structuredClone(this.plan.provenance),
      },
      metadata: {
        ...active.metadata,
        duration: this.plan.durationSeconds,
        updatedAt: new Date(),
      },
    };
    editor.project.setActiveProject({ project });
    editor.scenes.setScenes({
      scenes: editor.scenes
        .getScenes()
        .map((scene) =>
          scene.id === this.sceneId
            ? {
                ...scene,
                tracks: structuredClone(this.plan.tracks),
                transitions: structuredClone(this.plan.transitions),
              }
            : scene
        ),
      activeSceneId: currentScene.id,
    });
    editor.renderer.invalidatePreviewSceneCache();
    editor.save.markDirty();
  }

  undo(): void {
    if (
      !this.previousTracks ||
      !this.previousProject ||
      !this.previousTransitions ||
      !this.sceneId
    )
      return;
    const editor = EditorCore.getInstance();
    const currentSceneId = editor.scenes.getActiveScene().id;
    editor.project.setActiveProject({ project: structuredClone(this.previousProject) });
    editor.scenes.setScenes({
      scenes: editor.scenes
        .getScenes()
        .map((scene) =>
          scene.id === this.sceneId
            ? {
                ...scene,
                tracks: structuredClone(this.previousTracks!),
                transitions: structuredClone(this.previousTransitions!),
              }
            : scene
        ),
      activeSceneId: currentSceneId,
    });
    editor.renderer.invalidatePreviewSceneCache();
    editor.save.markDirty();
  }
}

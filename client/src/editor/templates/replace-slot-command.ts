import { EditorCore } from '../core';
import { Command } from '../lib/commands/base-command';
import { toRaw } from 'vue';
import type { TProjectSettings } from '../types/project';
import type { TimelineTrack } from '../types/timeline';

export class ReplaceTemplateSlotMediaCommand extends Command {
  private previousTracks: TimelineTrack[] | null = null;
  private previousSettings: TProjectSettings | null = null;
  private sceneId: string | null = null;

  constructor(
    private readonly trackId: string,
    private readonly elementId: string,
    private readonly slotId: string,
    private readonly mediaId: string,
    private readonly sourceFingerprint: string
  ) {
    super();
  }

  execute(): void {
    const editor = EditorCore.getInstance();
    const project = editor.project.getActive();
    const currentScene = editor.scenes.getActiveScene();
    if (!this.previousTracks) {
      this.previousTracks = structuredClone(toRaw(editor.timeline.getTracks()));
      this.previousSettings = structuredClone(toRaw(project.settings));
      this.sceneId = currentScene.id;
    }
    const sourceTracks =
      editor.scenes.getScenes().find((scene) => scene.id === this.sceneId)?.tracks ?? [];
    const tracks = sourceTracks.map((track) =>
      track.id === this.trackId
        ? ({
            ...track,
            elements: track.elements.map((element) =>
              element.id === this.elementId ? { ...element, mediaId: this.mediaId } : element
            ),
          } as TimelineTrack)
        : track
    );
    const instance = project.settings.templateInstance;
    const previousFingerprint = instance?.bindings.find(
      (binding) => binding.slotId === this.slotId
    )?.sourceFingerprint;
    const previousStillUsed = instance?.bindings.some(
      (binding) =>
        binding.slotId !== this.slotId && binding.sourceFingerprint === previousFingerprint
    );
    const remainingLineage =
      instance?.sourceLineage.filter(
        (source) =>
          (previousStillUsed || source.sourceFingerprint !== previousFingerprint) &&
          source.sourceFingerprint !== this.sourceFingerprint
      ) ?? [];
    const settings: TProjectSettings = {
      ...project.settings,
      templateInstance: instance
        ? {
            ...instance,
            sourceLineage: [
              ...remainingLineage,
              { assetId: this.mediaId, sourceFingerprint: this.sourceFingerprint },
            ],
            bindings: instance.bindings.map((binding) =>
              binding.slotId === this.slotId
                ? {
                    ...binding,
                    assetId: this.mediaId,
                    sourceFingerprint: this.sourceFingerprint,
                    reasonCodes: ['creator-selected'],
                    locked: true,
                  }
                : binding
            ),
          }
        : instance,
    };
    editor.project.setActiveProject({ project: { ...project, settings } });
    editor.scenes.setScenes({
      scenes: editor.scenes
        .getScenes()
        .map((scene) => (scene.id === this.sceneId ? { ...scene, tracks } : scene)),
      activeSceneId: currentScene.id,
    });
    editor.renderer.invalidatePreviewSceneCache();
    editor.save.markDirty();
  }

  undo(): void {
    if (!this.previousTracks || !this.previousSettings || !this.sceneId) return;
    const editor = EditorCore.getInstance();
    const project = editor.project.getActive();
    const currentSceneId = editor.scenes.getActiveScene().id;
    editor.project.setActiveProject({ project: { ...project, settings: this.previousSettings } });
    editor.scenes.setScenes({
      scenes: editor.scenes
        .getScenes()
        .map((scene) =>
          scene.id === this.sceneId
            ? { ...scene, tracks: structuredClone(this.previousTracks!) }
            : scene
        ),
      activeSceneId: currentSceneId,
    });
    editor.renderer.invalidatePreviewSceneCache();
    editor.save.markDirty();
  }
}

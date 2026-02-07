import { Command } from "../../../lib/commands/base-command";
import { EditorCore } from "../../../core";
import type { TProject, TProjectSettings } from "../../../types/project";
import type { TimelineTrack, Transform } from "../../../types/timeline";

export class UpdateProjectSettingsCommand extends Command {
	private savedSettings: TProjectSettings | null = null;
	private savedUpdatedAt: Date | null = null;
	private savedTracks: TimelineTrack[] | null = null;

	constructor(private updates: Partial<TProjectSettings>) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const activeProject = editor.project.getActive();
		if (!activeProject) return;

		this.savedSettings = activeProject.settings;
		this.savedUpdatedAt = activeProject.metadata.updatedAt;
		this.savedTracks = editor.timeline.getTracks();

		const updatedProject: TProject = {
			...activeProject,
			settings: { ...activeProject.settings, ...this.updates },
			metadata: { ...activeProject.metadata, updatedAt: new Date() },
		};

		editor.project.setActiveProject({ project: updatedProject });

		// Scale all timeline elements when canvas size changes
		if (this.updates.canvasSize && this.savedSettings.canvasSize) {
			const oldW = this.savedSettings.canvasSize.width;
			const oldH = this.savedSettings.canvasSize.height;
			const newW = this.updates.canvasSize.width;
			const newH = this.updates.canvasSize.height;

			if (oldW !== newW || oldH !== newH) {
				const scaleX = newW / oldW;
				const scaleY = newH / oldH;
				this.scaleAllElements(editor, scaleX, scaleY);
			}
		}

		editor.save.markDirty();
	}

	undo(): void {
		if (!this.savedSettings || !this.savedUpdatedAt) return;
		const editor = EditorCore.getInstance();
		const activeProject = editor.project.getActive();
		if (!activeProject) return;

		const updatedProject: TProject = {
			...activeProject,
			settings: this.savedSettings,
			metadata: { ...activeProject.metadata, updatedAt: this.savedUpdatedAt },
		};

		editor.project.setActiveProject({ project: updatedProject });

		// Restore original tracks to undo element scaling
		if (this.savedTracks) {
			editor.timeline.updateTracks(this.savedTracks);
		}

		editor.save.markDirty();
	}

	private scaleTransform(transform: Transform, scaleX: number, scaleY: number): Transform {
		return {
			...transform,
			position: {
				x: transform.position.x * scaleX,
				y: transform.position.y * scaleY,
			},
		};
	}

	private scaleAllElements(editor: EditorCore, scaleX: number, scaleY: number): void {
		const tracks = editor.timeline.getTracks();
		const scaleFactor = Math.min(scaleX, scaleY);

		const scaledTracks = tracks.map((track) => {
			if (track.type === "audio" || track.type === "effect") return track;

			const scaledElements = track.elements.map((el) => {
				if (el.type === "text") {
					return {
						...el,
						fontSize: Math.round(el.fontSize * scaleFactor),
						transform: this.scaleTransform(el.transform, scaleX, scaleY),
					};
				}
				if (el.type === "sticker") {
					return {
						...el,
						transform: this.scaleTransform(el.transform, scaleX, scaleY),
					};
				}
				if (el.type === "video" || el.type === "image") {
					return {
						...el,
						transform: this.scaleTransform(el.transform, scaleX, scaleY),
					};
				}
				return el;
			});

			return { ...track, elements: scaledElements } as typeof track;
		});

		editor.timeline.updateTracks(scaledTracks);
	}
}

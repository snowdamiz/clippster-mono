import { Command } from "../../../lib/commands/base-command";
import { EditorCore } from "../../../core";
import type { Transition } from "../../../types/transitions";

/**
 * Command to add, update, or remove a transition between two adjacent elements.
 * Integrates with the undo/redo system.
 */
export class SetTransitionCommand extends Command {
	private previousTransitions: Transition[] | null = null;

	constructor(
		/** The new transition to set. Pass null to remove the transition for targetElementId. */
		private transition: Transition | null,
		/** The targetElementId whose transition should be replaced/removed */
		private targetElementId: string,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		let scene;
		try {
			scene = editor.scenes.getActiveScene();
		} catch {
			return;
		}

		this.previousTransitions = scene.transitions ? [...scene.transitions] : [];

		const filtered = (scene.transitions ?? []).filter(
			(t) => t.targetElementId !== this.targetElementId,
		);

		const nextTransitions = this.transition
			? [...filtered, this.transition]
			: filtered;

		const updatedScene = { ...scene, transitions: nextTransitions };
		const scenes = editor.scenes.getScenes().map((s) =>
			s.id === scene.id ? updatedScene : s,
		);
		editor.scenes.setScenes({ scenes, activeSceneId: scene.id });
	}

	undo(): void {
		if (this.previousTransitions === null) return;
		const editor = EditorCore.getInstance();
		let scene;
		try {
			scene = editor.scenes.getActiveScene();
		} catch {
			return;
		}
		const updatedScene = { ...scene, transitions: this.previousTransitions };
		const scenes = editor.scenes.getScenes().map((s) =>
			s.id === scene.id ? updatedScene : s,
		);
		editor.scenes.setScenes({ scenes, activeSceneId: scene.id });
	}
}

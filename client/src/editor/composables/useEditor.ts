/**
 * Vue composable equivalent of OpenCut's use-editor.ts React hook.
 * Provides reactive access to the EditorCore singleton.
 * 
 * In React, useSyncExternalStore subscribes to manager changes.
 * In Vue, we use shallowRef + subscribe to trigger reactivity.
 */
import { shallowRef, onUnmounted, onMounted } from "vue";
import { EditorCore } from "../core";

export function useEditor() {
	const editor = EditorCore.getInstance();
	const version = shallowRef(0);

	let unsubscribers: Array<() => void> = [];

	const handleChange = () => {
		version.value += 1;
	};

	onMounted(() => {
		unsubscribers = [
			editor.playback.subscribe(handleChange),
			editor.timeline.subscribe(handleChange),
			editor.scenes.subscribe(handleChange),
			editor.project.subscribe(handleChange),
			editor.media.subscribe(handleChange),
			editor.renderer.subscribe(handleChange),
			editor.selection.subscribe(handleChange),
		];
	});

	onUnmounted(() => {
		for (const unsub of unsubscribers) {
			unsub();
		}
		unsubscribers = [];
	});

	return {
		editor,
		/** Reactive version counter — watch this to react to any editor state change */
		version,
	};
}

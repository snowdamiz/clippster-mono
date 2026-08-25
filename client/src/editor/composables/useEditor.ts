/**
 * Vue composable equivalent of OpenCut's use-editor.ts React hook.
 * Provides reactive access to the EditorCore singleton.
 * 
 * In React, useSyncExternalStore subscribes to manager changes.
 * In Vue, we use shallowRef + subscribe to trigger reactivity.
 */
import { shallowRef, onUnmounted, onMounted } from "vue";
import { EditorCore } from "../core";

type EditorSubscriptionKey =
	| "playback"
	| "timeline"
	| "scenes"
	| "project"
	| "media"
	| "selection";

type EditorSubscriptionOptions = Partial<Record<EditorSubscriptionKey, boolean>>;

const DEFAULT_SUBSCRIPTIONS: Record<EditorSubscriptionKey, boolean> = {
	// Playback emits on every animation frame. Most editor components only need
	// structural state and should opt in explicitly when they display the clock.
	playback: false,
	timeline: true,
	scenes: true,
	project: true,
	media: true,
	selection: true,
};

export function useEditor(options?: { subscribe?: EditorSubscriptionOptions | false }) {
	const editor = EditorCore.getInstance();
	const version = shallowRef(0);
	const subscriptions = options?.subscribe === false
		? {
			playback: false,
			timeline: false,
			scenes: false,
			project: false,
			media: false,
			selection: false,
		}
		: { ...DEFAULT_SUBSCRIPTIONS, ...options?.subscribe };

	let unsubscribers: Array<() => void> = [];

	const handleChange = () => {
		version.value += 1;
	};

	onMounted(() => {
		unsubscribers = [];

		if (subscriptions.playback) {
			unsubscribers.push(editor.playback.subscribe(handleChange));
		}
		if (subscriptions.timeline) {
			unsubscribers.push(editor.timeline.subscribe(handleChange));
		}
		if (subscriptions.scenes) {
			unsubscribers.push(editor.scenes.subscribe(handleChange));
		}
		if (subscriptions.project) {
			unsubscribers.push(editor.project.subscribe(handleChange));
		}
		if (subscriptions.media) {
			unsubscribers.push(editor.media.subscribe(handleChange));
		}
		if (subscriptions.selection) {
			unsubscribers.push(editor.selection.subscribe(handleChange));
		}
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

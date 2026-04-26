import type { EditorCore } from "../../core";
import type { MediaAsset } from "../../types/assets";
import type { TimelineTrack, VideoElement } from "../../types/timeline";
import { videoCache } from "../../video-cache/service";

function isVideoTimelineElement(el: unknown): el is VideoElement {
	if (typeof el !== "object" || el === null) return false;
	const o = el as { type?: unknown; mediaId?: unknown };
	return (
		String(o.type ?? "").toLowerCase() === "video" &&
		typeof o.mediaId === "string" &&
		o.mediaId.length > 0
	);
}

function isUsableVideoAsset(a: MediaAsset | undefined): a is MediaAsset {
	return !!(
		a &&
		String(a.type).toLowerCase() === "video" &&
		a.file instanceof File &&
		a.file.size > 0
	);
}

/** Timeline video mediaIds that are missing or not decodable (matches collectAudioClips). */
function collectUnusableVideoMediaIds(editor: EditorCore): Set<string> {
	const assets = editor.media.getAssets();
	const byId = new Map(assets.map((x) => [x.id, x]));
	const out = new Set<string>();

	for (const scene of editor.scenes.getScenes()) {
		for (const track of scene.tracks ?? []) {
			for (const el of track.elements ?? []) {
				if (!isVideoTimelineElement(el)) continue;
				const mid = el.mediaId;
				if (!mid) continue;
				if (!isUsableVideoAsset(byId.get(mid))) {
					out.add(mid);
				}
			}
		}
	}
	return out;
}

/**
 * Rewires timeline video elements whose mediaId has no loaded MediaAsset (e.g. duplicate
 * splits, failed imports, or DB drift) to a real video asset on the same project.
 * If the timeline cannot be rewired, injects in-memory MediaAsset aliases that share the
 * donor file so collectAudioClips / buildScene resolve mediaId → File.
 */
export function healOrphanVideoMediaReferences({
	editor,
	projectId,
}: {
	editor: EditorCore;
	projectId: string;
}): boolean {
	const assets = editor.media.getAssets();
	const usableVideoAssets = assets.filter((a) => isUsableVideoAsset(a));
	if (usableVideoAssets.length === 0) return false;

	const usableIds = new Set(usableVideoAssets.map((a) => a.id));
	const normalizedProject = projectId.toLowerCase();

	const donor =
		usableVideoAssets.find((a) => {
			if (!a.filePath) return false;
			const norm = a.filePath.replace(/\\/g, "/").toLowerCase();
			return norm.includes(normalizedProject) && /clip_[0-9a-f-]{36}/i.test(a.filePath);
		}) ?? usableVideoAssets[0];

	let changed = false;

	let anySceneChange = false;
	const nextScenes = editor.scenes.getScenes().map((scene) => {
		let sceneChanged = false;
		const tracks: TimelineTrack[] = (scene.tracks ?? []).map((track) => {
			let trackChanged = false;
			const elements = (track.elements ?? []).map((el) => {
				if (!isVideoTimelineElement(el)) return el;
				if (usableIds.has(el.mediaId)) return el;
				if (el.mediaId === donor.id) return el;
				trackChanged = true;
				sceneChanged = true;
				anySceneChange = true;
				return { ...el, mediaId: donor.id };
			});

			return trackChanged ? { ...track, elements } : track;
		});

		return sceneChanged ? { ...scene, tracks, updatedAt: new Date() } : scene;
	});

	if (anySceneChange) {
		const active = editor.scenes.getActiveSceneOrNull();
		editor.scenes.setScenes({
			scenes: nextScenes,
			activeSceneId: active?.id ?? nextScenes[0]?.id,
		});
		changed = true;
	}

	const orphans = collectUnusableVideoMediaIds(editor);
	if (orphans.size > 0) {
		const current = editor.media.getAssets();
		const filtered = current.filter((a) => !orphans.has(a.id));
		const extras: MediaAsset[] = [...orphans].map((oid) => ({
			...donor,
			id: oid,
			name: donor.name,
		}));
		editor.media.setAssets({ assets: [...filtered, ...extras] });
		changed = true;
	}

	if (changed) {
		videoCache.clearAll();
	}

	return changed;
}

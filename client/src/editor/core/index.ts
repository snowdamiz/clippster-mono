import { PlaybackManager } from "./managers/playback-manager";
import { TimelineManager } from "./managers/timeline-manager";
import { ScenesManager } from "./managers/scenes-manager";
import { ProjectManager } from "./managers/project-manager";
import { MediaManager } from "./managers/media-manager";
import { RendererManager } from "./managers/renderer-manager";
import { CommandManager } from "./managers/commands";
import { SaveManager } from "./managers/save-manager";
import { AudioManager } from "./managers/audio-manager";
import { SelectionManager } from "./managers/selection-manager";
import { TranscriptManager } from "./managers/transcript-manager";

export class EditorCore {
	private static instance: EditorCore | null = null;
	private static _nextImageMode = false;

	public readonly command: CommandManager;
	public readonly playback: PlaybackManager;
	public readonly timeline: TimelineManager;
	public readonly scenes: ScenesManager;
	public readonly project: ProjectManager;
	public readonly media: MediaManager;
	public readonly renderer: RendererManager;
	public readonly save: SaveManager;
	public readonly audio: AudioManager;
	public readonly selection: SelectionManager;
	public readonly transcript: TranscriptManager;

	private _previewCanvas: HTMLCanvasElement | null = null;
	private _imageMode: boolean;
	private _livePreviewCanvas: HTMLCanvasElement | null = null;
	private _interactiveDrag = false;
	private disposed = false;

	private constructor() {
		this._imageMode = EditorCore._nextImageMode;
		EditorCore._nextImageMode = false;
		this.command = new CommandManager();
		this.playback = new PlaybackManager(this);
		this.timeline = new TimelineManager(this);
		this.scenes = new ScenesManager(this);
		this.project = new ProjectManager(this);
		this.media = new MediaManager(this);
		this.renderer = new RendererManager(this);
		this.save = new SaveManager(this);
		this.audio = new AudioManager(this);
		this.selection = new SelectionManager(this);
		this.transcript = new TranscriptManager(this);
		this.save.start();
	}

	get imageMode(): boolean {
		return this._imageMode;
	}

	setPreviewCanvas(canvas: HTMLCanvasElement | null): void {
		this._previewCanvas = canvas;
	}

	getPreviewCanvas(): HTMLCanvasElement | null {
		return this._previewCanvas;
	}

	setLivePreviewCanvas(canvas: HTMLCanvasElement | null): void {
		this._livePreviewCanvas = canvas;
	}

	getLivePreviewCanvas(): HTMLCanvasElement | null {
		return this._livePreviewCanvas;
	}

	setInteractiveDrag(value: boolean): void {
		this._interactiveDrag = value;
	}

	getInteractiveDrag(): boolean {
		return this._interactiveDrag;
	}

	static getInstance(): EditorCore {
		if (!EditorCore.instance) {
			EditorCore.instance = new EditorCore();
		}
		return EditorCore.instance;
	}

	/** Call before getInstance() to create an image-mode editor */
	static setNextImageMode(enabled: boolean): void {
		EditorCore._nextImageMode = enabled;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;

		this.save.stop();
		this.playback.pause();
		this.audio.dispose();
		this.renderer.setRenderTree({ renderTree: null });
		this.renderer.invalidatePreviewSceneCache();
		this.media.clearAllAssets();

		const previewCanvas = this._previewCanvas;
		this._previewCanvas = null;
		this._livePreviewCanvas = null;
		if (previewCanvas) {
			// Releasing the backing store drops retained preview GPU/bitmap memory.
			previewCanvas.width = 0;
			previewCanvas.height = 0;
		}
		this._interactiveDrag = false;
	}

	static reset(expectedInstance?: EditorCore): void {
		const instance = EditorCore.instance;
		if (!instance || (expectedInstance && instance !== expectedInstance)) return;
		instance.dispose();
		EditorCore.instance = null;
	}
}

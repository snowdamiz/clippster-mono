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

	static reset(): void {
		EditorCore.instance?.save.stop();
		EditorCore.instance?.playback.pause();
		EditorCore.instance = null;
	}
}

export type TransitionType =
	| "crossfade"
	| "fadeToBlack"
	| "fadeToWhite"
	| "dissolve"
	| "fadegrays"
	| "slideLeft"
	| "slideRight"
	| "slideUp"
	| "slideDown"
	| "wipeLeft"
	| "wipeRight"
	| "wipeUp"
	| "wipeDown"
	| "zoomIn"
	| "circleWipe"
	| "diamondWipe"
	| "clockWipe"
	| "pushLeft"
	| "pushRight"
	| "pushUp"
	| "pushDown"
	| "coverLeft"
	| "coverRight"
	| "revealLeft"
	| "revealRight"
	| "prismSweep"
	| "glitchBlocks"
	| "shutterFlash"
	| "inkBloom"
	| "diagTl"
	| "diagTr"
	| "diagBl"
	| "diagBr"
	| "wipeTl"
	| "wipeTr"
	| "wipeBl"
	| "wipeBr"
	| "squeezeH"
	| "squeezeV"
	| "hlSlice"
	| "hrSlice"
	| "vuSlice"
	| "vdSlice"
	| "circleClose"
	| "horzOpen"
	| "horzClose"
	| "vertOpen"
	| "vertClose"
	| "hblurTransition"
	| "fadefast"
	| "fadeslow";

export type TransitionCategory =
	| "fade"
	| "slide"
	| "wipe"
	| "zoom"
	| "push"
	| "cover"
	| "modern"
	| "shape";

export interface Transition {
	id: string;
	type: TransitionType;
	/** Duration in seconds (how long the overlap is) */
	duration: number;
	/** ID of the element this transition leads INTO (the second element) */
	targetElementId: string;
	/** ID of the track containing the elements */
	trackId: string;
}

export interface TransitionPreset {
	type: TransitionType;
	label: string;
	description: string;
	category: TransitionCategory;
	defaultDuration: number;
	/** FFmpeg xfade transition name (source of truth for export) */
	ffmpegName: string;
	/** Canvas preview implementation key. Must intentionally mirror ffmpegName/custom expression. */
	previewRenderer: TransitionType;
	/** User-facing presets must be export-supported. */
	exportSupported: boolean;
	/** Sort/ranking hint for modern packs. Lower appears earlier. */
	modernRank: number;
}

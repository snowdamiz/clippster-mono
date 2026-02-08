export type TransitionType =
	| "crossfade"
	| "fadeToBlack"
	| "fadeToWhite"
	| "slideLeft"
	| "slideRight"
	| "slideUp"
	| "slideDown"
	| "wipeLeft"
	| "wipeRight"
	| "wipeUp"
	| "wipeDown"
	| "zoomIn"
	| "zoomOut"
	| "blur"
	| "dissolve";

export type TransitionCategory = "fade" | "slide" | "wipe" | "zoom" | "stylize";

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
}

export interface ChromakeySettings {
	enabled: boolean;
	/** Key color in hex */
	color: string;
	/** Similarity threshold 0-100 (how close a pixel must be to the key color) */
	similarity: number;
	/** Smoothness of the edge 0-100 */
	smoothness: number;
	/** Spill reduction 0-100 */
	spillReduction: number;
}

export const DEFAULT_CHROMAKEY: ChromakeySettings = {
	enabled: false,
	color: "#00ff00",
	similarity: 40,
	smoothness: 10,
	spillReduction: 50,
};

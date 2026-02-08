import type { SoundEffect } from "../types/sounds";

const FREESOUND_BASE_URL = "https://freesound.org/apiv2";

function getApiKey(): string {
	const key = import.meta.env.VITE_FREESOUND_API_KEY;
	if (!key) {
		throw new Error(
			"VITE_FREESOUND_API_KEY is not set. Get a free API key at https://freesound.org/apiv2/apply/",
		);
	}
	return key;
}

export interface FreesoundSearchParams {
	query: string;
	page?: number;
	pageSize?: number;
	sort?: "score" | "duration_desc" | "duration_asc" | "created_desc" | "created_asc" | "downloads_desc" | "downloads_asc" | "rating_desc" | "rating_asc";
	filter?: string;
}

export interface FreesoundSearchResponse {
	count: number;
	next: string | null;
	previous: string | null;
	results: SoundEffect[];
}

const FIELDS = [
	"id",
	"name",
	"description",
	"url",
	"previews",
	"download",
	"duration",
	"filesize",
	"type",
	"channels",
	"bitrate",
	"bitdepth",
	"samplerate",
	"username",
	"tags",
	"license",
	"created",
	"num_downloads",
	"avg_rating",
	"num_ratings",
].join(",");

interface FreesoundRawResult {
	id: number;
	name: string;
	description: string;
	url: string;
	previews?: {
		"preview-hq-mp3"?: string;
		"preview-lq-mp3"?: string;
		"preview-hq-ogg"?: string;
		"preview-lq-ogg"?: string;
	};
	download?: string;
	duration: number;
	filesize: number;
	type: string;
	channels: number;
	bitrate: number;
	bitdepth: number;
	samplerate: number;
	username: string;
	tags: string[];
	license: string;
	created: string;
	num_downloads?: number;
	avg_rating?: number;
	num_ratings?: number;
}

function transformResult(result: FreesoundRawResult): SoundEffect {
	return {
		id: result.id,
		name: result.name,
		description: result.description,
		url: result.url,
		previewUrl:
			result.previews?.["preview-hq-mp3"] ||
			result.previews?.["preview-lq-mp3"],
		downloadUrl: result.download,
		duration: result.duration,
		filesize: result.filesize,
		type: result.type,
		channels: result.channels,
		bitrate: result.bitrate,
		bitdepth: result.bitdepth,
		samplerate: result.samplerate,
		username: result.username,
		tags: result.tags,
		license: result.license,
		created: result.created,
		downloads: result.num_downloads || 0,
		rating: result.avg_rating || 0,
		ratingCount: result.num_ratings || 0,
	};
}

export async function searchSounds(
	params: FreesoundSearchParams,
): Promise<FreesoundSearchResponse> {
	const apiKey = getApiKey();

	const urlParams = new URLSearchParams({
		query: params.query,
		token: apiKey,
		page: (params.page || 1).toString(),
		page_size: (params.pageSize || 15).toString(),
		sort: params.sort || "score",
		fields: FIELDS,
	});

	if (params.filter) {
		urlParams.append("filter", params.filter);
	}

	const response = await fetch(
		`${FREESOUND_BASE_URL}/search/text/?${urlParams.toString()}`,
	);

	if (!response.ok) {
		const errorText = await response.text();
		console.error("Freesound API error:", response.status, errorText);
		throw new Error(`Freesound API error: ${response.status}`);
	}

	const data = await response.json();

	return {
		count: data.count,
		next: data.next,
		previous: data.previous,
		results: (data.results || []).map(transformResult),
	};
}

export function isFreesoundConfigured(): boolean {
	return !!import.meta.env.VITE_FREESOUND_API_KEY;
}

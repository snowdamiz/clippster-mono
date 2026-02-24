import api from "../../services/api";
import type { SoundEffect } from "../types/sounds";

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
	const queryParams: Record<string, string> = {
		query: params.query,
		page: (params.page || 1).toString(),
		page_size: (params.pageSize || 15).toString(),
		sort: params.sort || "score",
	};

	if (params.filter) {
		queryParams.filter = params.filter;
	}

	const response = await api.get("/freesound/search", { params: queryParams });
	const data = response.data;

	return {
		count: data.count,
		next: data.next,
		previous: data.previous,
		results: (data.results || []).map(transformResult),
	};
}

export function isFreesoundConfigured(): boolean {
	// Always configured — the API key lives server-side
	return true;
}

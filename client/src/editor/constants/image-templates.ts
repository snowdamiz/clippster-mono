/**
 * Built-in design templates for the image editor.
 * Each template defines a canvas size, background, and optional pre-placed elements.
 */

export type TemplateCategory = 'thumbnail' | 'social' | 'banner' | 'poster' | 'minimal';

export interface TemplateTextElement {
	content: string;
	fontSize: number;
	fontFamily: string;
	fontWeight: string;
	color: string;
	textAlign: 'left' | 'center' | 'right';
	position: { x: number; y: number };
	letterSpacing?: number;
	textCase?: 'none' | 'uppercase' | 'lowercase';
	stroke?: { width: number; color: string };
	shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
	gradient?: { enabled: boolean; colors: [string, string]; angle: number };
}

export interface ImageTemplate {
	id: string;
	name: string;
	category: TemplateCategory;
	description: string;
	canvasWidth: number;
	canvasHeight: number;
	backgroundColor: string;
	textElements: TemplateTextElement[];
	previewGradient?: string;
}

export const IMAGE_TEMPLATES: ImageTemplate[] = [
	// ═══ THUMBNAIL TEMPLATES ═══
	{
		id: 'thumb-bold-title',
		name: 'Bold Title',
		category: 'thumbnail',
		description: 'YouTube thumbnail with bold centered title',
		canvasWidth: 1280,
		canvasHeight: 720,
		backgroundColor: '#1a1a2e',
		previewGradient: 'linear-gradient(135deg, #1a1a2e, #16213e)',
		textElements: [
			{
				content: 'YOUR TITLE HERE',
				fontSize: 72,
				fontFamily: 'Inter',
				fontWeight: 'bold',
				color: '#ffffff',
				textAlign: 'center',
				position: { x: 0, y: -50 },
				textCase: 'uppercase',
				letterSpacing: 2,
				stroke: { width: 3, color: '#000000' },
			},
			{
				content: 'Subtitle text goes here',
				fontSize: 28,
				fontFamily: 'Inter',
				fontWeight: 'normal',
				color: '#94a3b8',
				textAlign: 'center',
				position: { x: 0, y: 60 },
			},
		],
	},
	{
		id: 'thumb-gaming',
		name: 'Gaming',
		category: 'thumbnail',
		description: 'Gaming-style thumbnail with neon accent',
		canvasWidth: 1280,
		canvasHeight: 720,
		backgroundColor: '#0f0f23',
		previewGradient: 'linear-gradient(135deg, #0f0f23, #1a0533)',
		textElements: [
			{
				content: 'EPIC MOMENT',
				fontSize: 80,
				fontFamily: 'Inter',
				fontWeight: 'bold',
				color: '#ff6b6b',
				textAlign: 'center',
				position: { x: 0, y: -40 },
				textCase: 'uppercase',
				letterSpacing: 4,
				stroke: { width: 2, color: '#000000' },
				shadow: { color: '#ff6b6b', blur: 20, offsetX: 0, offsetY: 0 },
			},
			{
				content: '#1 VICTORY ROYALE',
				fontSize: 24,
				fontFamily: 'Inter',
				fontWeight: 'bold',
				color: '#fbbf24',
				textAlign: 'center',
				position: { x: 0, y: 60 },
				textCase: 'uppercase',
				letterSpacing: 6,
			},
		],
	},
	{
		id: 'thumb-reaction',
		name: 'Reaction',
		category: 'thumbnail',
		description: 'Reaction-style with large emoji-friendly text',
		canvasWidth: 1280,
		canvasHeight: 720,
		backgroundColor: '#fbbf24',
		previewGradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
		textElements: [
			{
				content: 'NO WAY!!!',
				fontSize: 96,
				fontFamily: 'Inter',
				fontWeight: 'bold',
				color: '#1a1a2e',
				textAlign: 'center',
				position: { x: 0, y: -20 },
				textCase: 'uppercase',
				stroke: { width: 4, color: '#ffffff' },
			},
		],
	},
	{
		id: 'thumb-clean-gradient',
		name: 'Clean Gradient',
		category: 'thumbnail',
		description: 'Professional gradient thumbnail',
		canvasWidth: 1280,
		canvasHeight: 720,
		backgroundColor: '#0f172a',
		previewGradient: 'linear-gradient(135deg, #667eea, #764ba2)',
		textElements: [
			{
				content: 'Video Title',
				fontSize: 64,
				fontFamily: 'Inter',
				fontWeight: 'bold',
				color: '#ffffff',
				textAlign: 'center',
				position: { x: 0, y: -30 },
				gradient: { enabled: true, colors: ['#667eea', '#764ba2'], angle: 135 },
			},
			{
				content: 'Channel Name',
				fontSize: 24,
				fontFamily: 'Inter',
				fontWeight: 'normal',
				color: '#cbd5e1',
				textAlign: 'center',
				position: { x: 0, y: 50 },
				letterSpacing: 3,
				textCase: 'uppercase',
			},
		],
	},

	// ═══ SOCIAL TEMPLATES ═══
	{
		id: 'social-ig-post',
		name: 'IG Post',
		category: 'social',
		description: 'Instagram post with centered quote',
		canvasWidth: 1080,
		canvasHeight: 1080,
		backgroundColor: '#18181b',
		previewGradient: 'linear-gradient(135deg, #18181b, #27272a)',
		textElements: [
			{
				content: '"Your inspiring quote goes here"',
				fontSize: 42,
				fontFamily: 'Inter',
				fontWeight: 'normal',
				color: '#ffffff',
				textAlign: 'center',
				position: { x: 0, y: -30 },
			},
			{
				content: '— @username',
				fontSize: 20,
				fontFamily: 'Inter',
				fontWeight: 'normal',
				color: '#71717a',
				textAlign: 'center',
				position: { x: 0, y: 60 },
			},
		],
	},
	{
		id: 'social-ig-story',
		name: 'IG Story',
		category: 'social',
		description: 'Instagram story with bold text',
		canvasWidth: 1080,
		canvasHeight: 1920,
		backgroundColor: '#0f172a',
		previewGradient: 'linear-gradient(180deg, #7c3aed, #2563eb)',
		textElements: [
			{
				content: 'SWIPE UP',
				fontSize: 56,
				fontFamily: 'Inter',
				fontWeight: 'bold',
				color: '#ffffff',
				textAlign: 'center',
				position: { x: 0, y: 200 },
				textCase: 'uppercase',
				letterSpacing: 8,
			},
			{
				content: 'Link in bio',
				fontSize: 24,
				fontFamily: 'Inter',
				fontWeight: 'normal',
				color: '#c4b5fd',
				textAlign: 'center',
				position: { x: 0, y: 280 },
			},
		],
	},
	{
		id: 'social-tiktok-cover',
		name: 'TikTok Cover',
		category: 'social',
		description: 'TikTok video cover image',
		canvasWidth: 1080,
		canvasHeight: 1920,
		backgroundColor: '#000000',
		previewGradient: 'linear-gradient(180deg, #000000, #1a1a2e)',
		textElements: [
			{
				content: 'Part 1',
				fontSize: 64,
				fontFamily: 'Inter',
				fontWeight: 'bold',
				color: '#ffffff',
				textAlign: 'center',
				position: { x: 0, y: 0 },
				stroke: { width: 2, color: '#ff0050' },
			},
		],
	},

	// ═══ BANNER TEMPLATES ═══
	{
		id: 'banner-twitter',
		name: 'X/Twitter Banner',
		category: 'banner',
		description: 'Twitter/X profile banner',
		canvasWidth: 1500,
		canvasHeight: 500,
		backgroundColor: '#0f172a',
		previewGradient: 'linear-gradient(90deg, #0f172a, #1e293b)',
		textElements: [
			{
				content: 'Your Name',
				fontSize: 48,
				fontFamily: 'Inter',
				fontWeight: 'bold',
				color: '#ffffff',
				textAlign: 'left',
				position: { x: -300, y: -20 },
			},
			{
				content: 'Content Creator • Streamer • Gamer',
				fontSize: 18,
				fontFamily: 'Inter',
				fontWeight: 'normal',
				color: '#94a3b8',
				textAlign: 'left',
				position: { x: -300, y: 30 },
			},
		],
	},
	{
		id: 'banner-twitch-offline',
		name: 'Twitch Offline',
		category: 'banner',
		description: 'Twitch offline screen',
		canvasWidth: 1920,
		canvasHeight: 1080,
		backgroundColor: '#0e0e10',
		previewGradient: 'linear-gradient(135deg, #0e0e10, #18181b)',
		textElements: [
			{
				content: 'CURRENTLY OFFLINE',
				fontSize: 56,
				fontFamily: 'Inter',
				fontWeight: 'bold',
				color: '#9146ff',
				textAlign: 'center',
				position: { x: 0, y: -40 },
				textCase: 'uppercase',
				letterSpacing: 6,
			},
			{
				content: 'Follow for notifications when I go live!',
				fontSize: 22,
				fontFamily: 'Inter',
				fontWeight: 'normal',
				color: '#adadb8',
				textAlign: 'center',
				position: { x: 0, y: 30 },
			},
		],
	},

	// ═══ POSTER TEMPLATES ═══
	{
		id: 'poster-event',
		name: 'Event Poster',
		category: 'poster',
		description: 'Stream event announcement poster',
		canvasWidth: 1080,
		canvasHeight: 1350,
		backgroundColor: '#0c0a09',
		previewGradient: 'linear-gradient(180deg, #0c0a09, #1c1917)',
		textElements: [
			{
				content: 'LIVE EVENT',
				fontSize: 20,
				fontFamily: 'Inter',
				fontWeight: 'bold',
				color: '#f97316',
				textAlign: 'center',
				position: { x: 0, y: -200 },
				textCase: 'uppercase',
				letterSpacing: 8,
			},
			{
				content: 'Event Title',
				fontSize: 56,
				fontFamily: 'Inter',
				fontWeight: 'bold',
				color: '#ffffff',
				textAlign: 'center',
				position: { x: 0, y: -120 },
			},
			{
				content: 'Saturday, March 15 • 8PM EST',
				fontSize: 20,
				fontFamily: 'Inter',
				fontWeight: 'normal',
				color: '#a8a29e',
				textAlign: 'center',
				position: { x: 0, y: -50 },
			},
		],
	},

	// ═══ MINIMAL TEMPLATES ═══
	{
		id: 'minimal-blank-landscape',
		name: 'Blank Landscape',
		category: 'minimal',
		description: 'Empty 16:9 canvas',
		canvasWidth: 1920,
		canvasHeight: 1080,
		backgroundColor: '#000000',
		textElements: [],
	},
	{
		id: 'minimal-blank-portrait',
		name: 'Blank Portrait',
		category: 'minimal',
		description: 'Empty 9:16 canvas',
		canvasWidth: 1080,
		canvasHeight: 1920,
		backgroundColor: '#000000',
		textElements: [],
	},
	{
		id: 'minimal-blank-square',
		name: 'Blank Square',
		category: 'minimal',
		description: 'Empty 1:1 canvas',
		canvasWidth: 1080,
		canvasHeight: 1080,
		backgroundColor: '#000000',
		textElements: [],
	},
	{
		id: 'minimal-white',
		name: 'White Canvas',
		category: 'minimal',
		description: 'Clean white 16:9 canvas',
		canvasWidth: 1920,
		canvasHeight: 1080,
		backgroundColor: '#ffffff',
		textElements: [],
	},
];

export const TEMPLATE_CATEGORIES: { value: TemplateCategory | 'all'; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'thumbnail', label: 'Thumbnails' },
	{ value: 'social', label: 'Social' },
	{ value: 'banner', label: 'Banners' },
	{ value: 'poster', label: 'Posters' },
	{ value: 'minimal', label: 'Blank' },
];

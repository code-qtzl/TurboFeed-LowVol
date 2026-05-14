import { fal } from '@fal-ai/client';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { VideoLightingPreset } from './types';
import { config } from './config';

const VIBE_FILES: Record<VideoLightingPreset, string> = {
	golden_hour: 'morning_vibe.md',
	afternoon: 'afternoon_vibe.md',
	dusk: 'evening_vibe.md',
};

export interface RelightRequest {
	imageUrl: string;
	lightingPreset: VideoLightingPreset;
}

export interface RelightResult {
	imageBuffer: Buffer;
	prompt: string;
}

/**
 * ImageRelightingService applies a time-of-day style transform to a source
 * image via Fal flux-pro/kontext. The relit still is then fed into Kling
 * image-to-video so the video model sees the requested lighting baked in
 * rather than having to relight from a prompt alone.
 */
export class ImageRelightingService {
	private readonly endpointId: string;
	private readonly vibePromptDir: string;
	private vibeCache: Partial<Record<VideoLightingPreset, string>> = {};

	constructor(
		endpointId = config.fal.imageEditEndpoint,
		vibePromptDir = config.fal.vibePromptDir,
	) {
		this.endpointId = endpointId;
		this.vibePromptDir = vibePromptDir;
		if (config.fal.apiKey) {
			fal.config({ credentials: config.fal.apiKey });
		}
	}

	async loadVibePrompt(preset: VideoLightingPreset): Promise<string> {
		const cached = this.vibeCache[preset];
		if (cached) return cached;
		const filePath = path.resolve(this.vibePromptDir, VIBE_FILES[preset]);
		const text = await fs.readFile(filePath, 'utf-8');
		this.vibeCache[preset] = text;
		return text;
	}

	async relight(request: RelightRequest): Promise<RelightResult> {
		if (!config.fal.apiKey) {
			throw new Error('FAL_KEY is required for image relighting');
		}

		const prompt = await this.loadVibePrompt(request.lightingPreset);

		const result = await fal.subscribe(this.endpointId, {
			input: {
				prompt,
				image_url: request.imageUrl,
			},
		});

		const data =
			(
				result as {
					data?: {
						images?: Array<{ url?: string }>;
						image?: { url?: string };
					};
				}
			).data ?? result;
		const editedUrl: string | undefined =
			data?.images?.[0]?.url ?? data?.image?.url;
		if (!editedUrl || typeof editedUrl !== 'string') {
			throw new Error(
				'Image relighting result did not include an image URL',
			);
		}

		const response = await axios.get<ArrayBuffer>(editedUrl, {
			responseType: 'arraybuffer',
		});

		return {
			imageBuffer: Buffer.from(response.data),
			prompt,
		};
	}
}

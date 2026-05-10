import { fal, type QueueStatus } from '@fal-ai/client';
import axios from 'axios';
import { CampaignBrief, VideoLightingPreset } from './types';
import { config } from './config';

export const VIDEO_LIGHTING_PRESETS: VideoLightingPreset[] = [
	'golden_hour',
	'afternoon',
	'dusk',
];

export interface FalVideoRequest {
	prompt: string;
	imageUrl: string;
	referenceImageUrls: string[];
	aspectRatio: '1:1' | '9:16' | '16:9';
}

export interface FalVideoResult {
	videoUrl: string;
}

export interface FalVideoQueueStatus {
	status: QueueStatus['status'];
}

const NEGATIVE_PROMPT =
	'text, words, letters, typography, captions, subtitles, headlines, titles, labels, signage, signs, billboards, posters, slogans, taglines, written words, printed text, overlay text, watermarks, logos, brand marks, hand lettering, calligraphy, warped geometry, distorted product, unstable camera, jitter, flicker, exposure pumping, relighting, recoloring, time-of-day shift, sun crawl, sky color change, lighting transition, low resolution, blurry, broken architecture';

/**
 * FalVideoService wraps the Fal Kling image-to-video queue endpoint.
 */
export class FalVideoService {
	private readonly endpointId: string;

	constructor(endpointId = config.fal.videoEndpoint) {
		this.endpointId = endpointId;
		if (config.fal.apiKey) {
			fal.config({ credentials: config.fal.apiKey });
		}
	}

	constructPrompt(brief: CampaignBrief, product: string): string {
		void brief;
		return [
			`Create a 5 second cinematic editorial video featuring ${product}.`,
			'Very slow smooth dolly-in with subtle lateral parallax, stable camera motion, consistent exposure, photorealistic commercial film style.',
			'Preserve the source image lighting state exactly as provided; do not relight, recolor, or change time of day.',
			'Maintain one fixed lighting state for the entire clip; do not transition, timelapse, shift, crawl, recede, grow, or progress between times of day.',
			'Preserve the product identity, scene composition, materials, architectural details, white balance, and logical light direction.',
			'Do not render any text, words, letters, captions, subtitles, signage, logos, watermarks, or printed graphics anywhere in the frame.',
		].join(' ');
	}

	buildInput(request: FalVideoRequest): Record<string, unknown> {
		const input: Record<string, unknown> = {
			prompt: request.prompt,
			duration: '5',
			aspect_ratio: request.aspectRatio,
			negative_prompt: NEGATIVE_PROMPT,
			cfg_scale: 0.5,
		};

		if (request.referenceImageUrls.length > 1) {
			input.input_image_urls = request.referenceImageUrls.slice(0, 4);
			input.image_url = request.referenceImageUrls[0];
		} else {
			input.image_url = request.imageUrl;
		}

		return input;
	}

	async uploadImage(buffer: Buffer, mimeType: string): Promise<string> {
		if (!config.fal.apiKey) {
			throw new Error('FAL_KEY is required for video generation');
		}

		const arrayBuffer = buffer.buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength,
		) as ArrayBuffer;
		const blob = new Blob([arrayBuffer], { type: mimeType });
		return fal.storage.upload(blob, {
			lifecycle: { expiresIn: '1d' },
		});
	}

	async submitVideo(request: FalVideoRequest): Promise<string> {
		if (!config.fal.apiKey) {
			throw new Error('FAL_KEY is required for video generation');
		}

		const status = await fal.queue.submit(this.endpointId, {
			input: this.buildInput(request),
		});

		return status.request_id;
	}

	async getStatus(requestId: string): Promise<FalVideoQueueStatus> {
		const status = await fal.queue.status(this.endpointId, { requestId });
		return { status: status.status };
	}

	async getResult(requestId: string): Promise<FalVideoResult> {
		const result = await fal.queue.result<any>(this.endpointId as any, {
			requestId,
		});
		const videoUrl = result.data?.video?.url || result.data?.video_url;
		if (!videoUrl || typeof videoUrl !== 'string') {
			throw new Error('Fal video result did not include a video URL');
		}
		return { videoUrl };
	}

	async downloadVideo(videoUrl: string): Promise<Buffer> {
		const response = await axios.get<ArrayBuffer>(videoUrl, {
			responseType: 'arraybuffer',
		});
		return Buffer.from(response.data);
	}
}

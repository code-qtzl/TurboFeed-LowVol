import axios from 'axios';
import { CampaignBrief } from './types';
import { config } from './config';

/**
 * Request to generate an image via GenAI
 */
export interface GenAIRequest {
	prompt: string;
	width: number;
	height: number;
}

/**
 * Response from GenAI image generation
 */
export interface GenAIResponse {
	imageBuffer: Buffer;
	model: string;
	generatedAt: Date;
}

/**
 * GenAI_Service integrates with OpenAI GPT Image to generate hero images
 * when campaign assets are unavailable.
 */
export class GenAIService {
	/**
	 * Constructs a GenAI prompt from campaign brief data and product name.
	 *
	 * @param brief - The campaign brief containing audience/region/message data
	 * @param product - The product name to feature in the image
	 * @returns A formatted prompt string for the GenAI provider
	 */
	constructPrompt(brief: CampaignBrief, product: string): string {
		return (
			`Professional product photography of ${product} ` +
			`for ${brief.targetAudience} in ${brief.targetRegion}. ` +
			`Convey this mood visually without words: ${brief.campaignMessage}. ` +
			`High quality, commercial use, clean background, ` +
			`well-lit, studio lighting, 4k resolution. ` +
			`Do not render any text, letters, captions, logos, signage, or watermarks in the image.`
		);
	}

	/**
	 * Generates an image using OpenAI GPT Image with retry logic and
	 * exponential backoff.
	 *
	 * @param request - The generation request with prompt and dimensions
	 * @returns GenAIResponse containing the image buffer, model name, and timestamp
	 * @throws Error with descriptive message after all retries are exhausted
	 */
	async generateImage(request: GenAIRequest): Promise<GenAIResponse> {
		const maxRetries = config.genai.maxRetries;
		const timeout = config.genai.timeout;
		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const response = await axios.post(
					'https://api.openai.com/v1/images/generations',
					{
						model: 'gpt-image-1',
						prompt: request.prompt,
						n: 1,
						size: '1024x1024',
						quality: 'medium',
					},
					{
						headers: {
							Authorization: `Bearer ${config.genai.openaiApiKey}`,
							'Content-Type': 'application/json',
						},
						timeout,
					},
				);

				const imageBuffer = Buffer.from(
					response.data.data[0].b64_json,
					'base64',
				);

				return {
					imageBuffer,
					model: 'gpt-image-1',
					generatedAt: new Date(),
				};
			} catch (error) {
				lastError =
					error instanceof Error ? error : new Error(String(error));

				if (attempt < maxRetries) {
					const delay = Math.pow(2, attempt) * 1000;
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		throw new Error(
			`GenAI image generation failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
		);
	}
}

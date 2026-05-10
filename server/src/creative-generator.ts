import { promises as fs } from 'fs';
import path from 'path';
import { CampaignManager } from './campaign-manager';
import { AssetManager } from './asset-manager';
import { GenAIService } from './genai-service';
import { resizeImage, overlayText, ASPECT_RATIOS } from './image-processor';
import { CampaignOutput, Asset } from './types';
import { config } from './config';

/**
 * Request to trigger creative generation for a campaign
 */
export interface GenerationRequest {
	campaignId: string;
	useGenAI?: boolean;
}

/**
 * Result of a creative generation run
 */
export interface GenerationResult {
	campaignId: string;
	outputs: CampaignOutput[];
	generatedAt: Date;
	errors?: string[];
}

/**
 * Creative_Generator orchestrates the full creative generation pipeline.
 * For each product × aspect ratio combination, it resizes the source image
 * and overlays the campaign message text.
 */
export class CreativeGenerator {
	private campaignManager: CampaignManager;
	private assetManager: AssetManager;
	private genAIService?: GenAIService;

	constructor(
		campaignManager: CampaignManager,
		assetManager: AssetManager,
		genAIService?: GenAIService,
	) {
		this.campaignManager = campaignManager;
		this.assetManager = assetManager;
		this.genAIService = genAIService;
	}

	/**
	 * Sanitizes a product name for use as a directory name.
	 * Replaces spaces with underscores and removes special characters.
	 *
	 * @param name - The product name to sanitize
	 * @returns Sanitized name safe for file system use
	 */
	sanitizeHeroName(name: string): string {
		return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
	}

	/**
	 * Formats an aspect ratio string for use as a directory name.
	 * Replaces colons with hyphens (e.g., "1:1" → "1-1").
	 *
	 * @param ratio - The aspect ratio string (e.g., "1:1", "9:16", "16:9")
	 * @returns Formatted ratio string safe for file system use
	 */
	formatAspectRatioDir(ratio: string): string {
		return ratio.replace(/:/g, '-');
	}

	/**
	 * Saves creative outputs to the file system in the correct directory structure.
	 * Structure: outputs/{campaignId}/{product}/{aspectRatio}/creative.jpg
	 *
	 * @param campaignId - The campaign identifier
	 * @param outputs - Array of campaign outputs with attached buffers
	 * @param buffers - Map of "product|aspectRatio" → Buffer
	 */
	async saveOutputs(
		campaignId: string,
		outputs: CampaignOutput[],
		buffers: Map<string, Buffer>,
	): Promise<void> {
		const baseDir = config.storage.outputDir;

		for (const output of outputs) {
			const heroDir = this.sanitizeHeroName(output.hero);
			const ratioDir = this.formatAspectRatioDir(output.aspectRatio);
			const dirPath = path.join(baseDir, campaignId, heroDir, ratioDir);

			await fs.mkdir(dirPath, { recursive: true });

			const filePath = path.join(dirPath, 'creative.jpg');
			const bufferKey = `${output.hero}|${output.aspectRatio}`;
			const buffer = buffers.get(bufferKey);

			if (buffer) {
				await fs.writeFile(filePath, buffer);
				output.filePath = filePath;
			}
		}
	}

	/**
	 * Generates a manifest.json file for the campaign with metadata and output paths.
	 *
	 * @param campaignId - The campaign identifier
	 * @param hero - Hero subject name
	 * @param outputs - Array of campaign outputs with file paths set
	 */
	async generateManifest(
		campaignId: string,
		hero: string,
		outputs: CampaignOutput[],
	): Promise<void> {
		const baseDir = config.storage.outputDir;
		const manifestPath = path.join(baseDir, campaignId, 'manifest.json');

		const manifest = {
			campaignId,
			generatedAt: new Date().toISOString(),
			hero,
			outputs: outputs.map((o) => ({
				kind: o.kind,
				hero: o.hero,
				aspectRatio: o.aspectRatio,
				filePath: o.filePath,
				previewUrl: o.previewUrl,
			})),
		};

		await fs.mkdir(path.join(baseDir, campaignId), { recursive: true });
		await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
	}

	/**
	 * Orchestrates the full creative generation pipeline.
	 * Retrieves the campaign brief and assets, then processes each
	 * product × aspect ratio combination. Saves outputs to file system
	 * and generates a manifest.
	 *
	 * @param request - The generation request with campaignId and optional flags
	 * @returns GenerationResult with all outputs and any errors
	 */
	async generate(request: GenerationRequest): Promise<GenerationResult> {
		const { campaignId } = request;
		const errors: string[] = [];
		const outputs: CampaignOutput[] = [];
		const buffers = new Map<string, Buffer>();

		// Retrieve the campaign
		const campaign = await this.campaignManager.getCampaign(campaignId);
		if (!campaign) {
			throw new Error(`Campaign ${campaignId} not found`);
		}

		// Retrieve assets for the campaign
		const assets = await this.assetManager.getAssetsByCampaign(campaignId);
		// Only use GenAI when no assets are uploaded; uploaded assets always take priority
		const useGenAI = assets.length === 0;

		if (useGenAI && !this.genAIService) {
			throw new Error(
				`No assets found for campaign ${campaignId} and GenAI service is not available`,
			);
		}

		// Update campaign status to generating
		await this.campaignManager.updateCampaignStatus(
			campaignId,
			'generating',
		);

		const { hero, campaignMessage } = campaign.brief;

		// When using GenAI, generate a single source image for the hero
		let genAIBuffer: Buffer | undefined;
		if (useGenAI && this.genAIService) {
			try {
				const prompt = this.genAIService.constructPrompt(
					campaign.brief,
					hero,
				);
				const response = await this.genAIService.generateImage({
					prompt,
					width: 1024,
					height: 1024,
				});
				genAIBuffer = response.imageBuffer;
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				errors.push(`GenAI generation failed for ${hero}: ${message}`);
			}
		}

		const sourceBuffer: Buffer | undefined = useGenAI
			? genAIBuffer
			: assets[0].buffer;

		if (sourceBuffer) {
			for (const aspectRatio of ASPECT_RATIOS) {
				try {
					const processedBuffer = await this.processImage(
						sourceBuffer,
						aspectRatio,
						campaignMessage,
					);

					const output: CampaignOutput = {
						kind: 'image',
						hero,
						aspectRatio: aspectRatio.ratio,
						filePath: '',
						generatedAt: new Date(),
					};

					(output as any).buffer = processedBuffer;
					buffers.set(
						`${hero}|${aspectRatio.ratio}`,
						processedBuffer,
					);
					outputs.push(output);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					errors.push(
						`Failed to generate ${hero} at ${aspectRatio.ratio}: ${message}`,
					);
				}
			}
		}

		// Save outputs to file system and generate manifest
		try {
			await this.saveOutputs(campaignId, outputs, buffers);
			await this.generateManifest(campaignId, hero, outputs);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			errors.push(`Failed to save outputs: ${message}`);
		}

		// Update campaign status and add outputs
		const finalStatus = errors.length > 0 ? 'failed' : 'completed';
		try {
			await this.campaignManager.updateCampaignStatus(
				campaignId,
				finalStatus,
			);
			await this.campaignManager.addOutputs(campaignId, outputs);
		} catch {
			// Status update failure is non-critical
		}

		return {
			campaignId,
			outputs,
			generatedAt: new Date(),
			errors: errors.length > 0 ? errors : undefined,
		};
	}

	/**
	 * Processes a single image: resizes to the target aspect ratio
	 * and overlays the campaign message text.
	 *
	 * @param imageBuffer - Source image buffer
	 * @param aspectRatio - Target aspect ratio configuration
	 * @param text - Campaign message text to overlay
	 * @returns Processed image buffer
	 */
	async processImage(
		imageBuffer: Buffer,
		aspectRatio: { ratio: string; width: number; height: number },
		text: string,
	): Promise<Buffer> {
		// Step 1: Resize to target dimensions
		const resized = await resizeImage(
			imageBuffer,
			aspectRatio.width,
			aspectRatio.height,
		);

		// Step 2: Overlay campaign message text
		const withText = await overlayText(resized, text, {
			width: aspectRatio.width,
			height: aspectRatio.height,
		});

		return withText;
	}
}

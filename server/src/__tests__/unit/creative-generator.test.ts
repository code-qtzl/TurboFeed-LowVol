import sharp from 'sharp';
import { CampaignManager } from '../../campaign-manager';
import { AssetManager } from '../../asset-manager';
import {
	CreativeGenerator,
	GenerationRequest,
	GenerationResult,
} from '../../creative-generator';
import { ASPECT_RATIOS } from '../../image-processor';
import { Campaign, CampaignBrief, Asset } from '../../types';

// Mock fs.promises to prevent actual file system writes during tests
jest.mock('fs', () => {
	const actual = jest.requireActual('fs');
	return {
		...actual,
		promises: {
			mkdir: jest.fn().mockResolvedValue(undefined),
			writeFile: jest.fn().mockResolvedValue(undefined),
		},
	};
});

describe('CreativeGenerator', () => {
	let campaignManager: CampaignManager;
	let assetManager: AssetManager;
	let generator: CreativeGenerator;
	let testImageBuffer: Buffer;

	beforeAll(async () => {
		// Create a valid test image (1000x1000 red square)
		testImageBuffer = await sharp({
			create: {
				width: 1000,
				height: 1000,
				channels: 3,
				background: { r: 255, g: 0, b: 0 },
			},
		})
			.jpeg()
			.toBuffer();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		campaignManager = new CampaignManager();
		assetManager = new AssetManager();
		generator = new CreativeGenerator(campaignManager, assetManager);
	});

	/**
	 * Helper to create a campaign and upload an asset for it.
	 */
	async function setupCampaignWithAsset(
		brief?: Partial<CampaignBrief>,
	): Promise<{ campaign: Campaign; asset: Asset }> {
		const defaultBrief: CampaignBrief = {
			hero: 'Product A',
			targetRegion: 'North America',
			targetAudience: 'Young professionals',
			campaignMessage: 'Discover the difference',
			...brief,
		};

		const campaign = await campaignManager.createCampaign(defaultBrief);

		const mockFile = {
			originalname: 'hero.jpg',
			mimetype: 'image/jpeg',
			buffer: testImageBuffer,
			size: testImageBuffer.length,
		} as Express.Multer.File;

		const asset = await assetManager.uploadAsset(campaign.id, mockFile);
		return { campaign, asset };
	}

	describe('generate', () => {
		it('should throw when campaign does not exist', async () => {
			await expect(
				generator.generate({ campaignId: 'nonexistent-id' }),
			).rejects.toThrow('Campaign nonexistent-id not found');
		});

		it('should throw when campaign has no assets and no GenAI service', async () => {
			const campaign = await campaignManager.createCampaign({
				hero: 'A',
				targetRegion: 'US',
				targetAudience: 'All',
				campaignMessage: 'Hello',
			});

			await expect(
				generator.generate({ campaignId: campaign.id }),
			).rejects.toThrow(
				`No assets found for campaign ${campaign.id} and GenAI service is not available`,
			);
		});

		it('should produce 3 outputs (one per aspect ratio) for the hero', async () => {
			const { campaign } = await setupCampaignWithAsset();
			const result = await generator.generate({
				campaignId: campaign.id,
			});

			expect(result.outputs).toHaveLength(ASPECT_RATIOS.length);
		});

		it('should produce one output per aspect ratio for the configured hero', async () => {
			const { campaign } = await setupCampaignWithAsset({
				hero: 'Alpha',
			});
			const result = await generator.generate({
				campaignId: campaign.id,
			});

			for (const ar of ASPECT_RATIOS) {
				const match = result.outputs.find(
					(o) => o.hero === 'Alpha' && o.aspectRatio === ar.ratio,
				);
				expect(match).toBeDefined();
			}
		});

		it('should return the correct campaignId in the result', async () => {
			const { campaign } = await setupCampaignWithAsset();
			const result = await generator.generate({
				campaignId: campaign.id,
			});

			expect(result.campaignId).toBe(campaign.id);
		});

		it('should return a generatedAt timestamp', async () => {
			const { campaign } = await setupCampaignWithAsset();
			const before = new Date();
			const result = await generator.generate({
				campaignId: campaign.id,
			});
			const after = new Date();

			expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(result.generatedAt.getTime()).toBeLessThanOrEqual(
				after.getTime(),
			);
		});

		it('should have no errors when all processing succeeds', async () => {
			const { campaign } = await setupCampaignWithAsset();
			const result = await generator.generate({
				campaignId: campaign.id,
			});

			expect(result.errors).toBeUndefined();
		});

		it('should collect errors when image processing fails for one aspect ratio', async () => {
			const { campaign } = await setupCampaignWithAsset();

			// Spy on processImage to fail for the first call only
			const originalProcessImage = generator.processImage.bind(generator);
			let callCount = 0;
			jest.spyOn(generator, 'processImage').mockImplementation(
				async (...args) => {
					callCount++;
					if (callCount === 1) {
						throw new Error('Sharp processing failed');
					}
					return originalProcessImage(...args);
				},
			);

			const result = await generator.generate({
				campaignId: campaign.id,
			});

			expect(result.errors).toBeDefined();
			expect(result.errors!.length).toBe(1);
			expect(result.errors![0]).toContain('Sharp processing failed');
			// Remaining aspect ratios should still succeed
			expect(result.outputs).toHaveLength(ASPECT_RATIOS.length - 1);
		});

		it('should attach processed buffer to each output', async () => {
			const { campaign } = await setupCampaignWithAsset();
			const result = await generator.generate({
				campaignId: campaign.id,
			});

			for (const output of result.outputs) {
				expect((output as any).buffer).toBeInstanceOf(Buffer);
				expect((output as any).buffer.length).toBeGreaterThan(0);
			}
		});
	});

	describe('processImage', () => {
		it('should return a buffer with correct dimensions for 1:1', async () => {
			const result = await generator.processImage(
				testImageBuffer,
				ASPECT_RATIOS[0], // 1:1
				'Test message',
			);

			const metadata = await sharp(result).metadata();
			expect(metadata.width).toBe(1080);
			expect(metadata.height).toBe(1080);
		});

		it('should return a buffer with correct dimensions for 9:16', async () => {
			const result = await generator.processImage(
				testImageBuffer,
				ASPECT_RATIOS[1], // 9:16
				'Test message',
			);

			const metadata = await sharp(result).metadata();
			expect(metadata.width).toBe(1080);
			expect(metadata.height).toBe(1920);
		});

		it('should return a buffer with correct dimensions for 16:9', async () => {
			const result = await generator.processImage(
				testImageBuffer,
				ASPECT_RATIOS[2], // 16:9
				'Test message',
			);

			const metadata = await sharp(result).metadata();
			expect(metadata.width).toBe(1920);
			expect(metadata.height).toBe(1080);
		});

		it('should handle empty text', async () => {
			const result = await generator.processImage(
				testImageBuffer,
				ASPECT_RATIOS[0],
				'',
			);

			expect(result).toBeInstanceOf(Buffer);
			expect(result.length).toBeGreaterThan(0);
		});

		it('should handle special characters in text', async () => {
			const result = await generator.processImage(
				testImageBuffer,
				ASPECT_RATIOS[0],
				'Test & <special> "chars"',
			);

			expect(result).toBeInstanceOf(Buffer);
			expect(result.length).toBeGreaterThan(0);
		});
	});
});

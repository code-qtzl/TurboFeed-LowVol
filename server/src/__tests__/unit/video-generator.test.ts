import sharp from 'sharp';
import { CampaignManager } from '../../campaign-manager';
import { AssetManager } from '../../asset-manager';
import { VideoGenerator } from '../../video-generator';
import { ASPECT_RATIOS } from '../../image-processor';
import {
	VIDEO_LIGHTING_PRESETS,
	FalVideoService,
} from '../../fal-video-service';
import { ImageRelightingService } from '../../image-relighting-service';

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

import { promises as fsPromises } from 'fs';

describe('VideoGenerator', () => {
	let campaignManager: CampaignManager;
	let assetManager: AssetManager;
	let testImageBuffer: Buffer;
	let requestCounter: number;
	let uploadCounter: number;
	let falVideoService: jest.Mocked<FalVideoService>;
	let imageRelightingService: jest.Mocked<ImageRelightingService>;
	let normalizeVideo: jest.Mock;
	let generator: VideoGenerator;

	beforeAll(async () => {
		testImageBuffer = await sharp({
			create: {
				width: 1000,
				height: 1000,
				channels: 3,
				background: { r: 255, g: 255, b: 255 },
			},
		})
			.jpeg()
			.toBuffer();
	});

	beforeEach(() => {
		(fsPromises.mkdir as jest.Mock).mockClear();
		(fsPromises.writeFile as jest.Mock).mockClear();
		requestCounter = 0;
		uploadCounter = 0;
		campaignManager = new CampaignManager();
		assetManager = new AssetManager();
		falVideoService = {
			uploadImage: jest.fn().mockImplementation(async () => {
				uploadCounter += 1;
				return `https://fal.test/upload-${uploadCounter}.jpg`;
			}),
			constructPrompt: jest.fn().mockReturnValue('video prompt'),
			submitVideo: jest.fn().mockImplementation(async () => {
				requestCounter += 1;
				return `request-${requestCounter}`;
			}),
			getStatus: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
			getResult: jest
				.fn()
				.mockResolvedValue({ videoUrl: 'https://fal.test/video.mp4' }),
			downloadVideo: jest.fn().mockResolvedValue(Buffer.from('mp4-data')),
		};
		imageRelightingService = {
			relight: jest
				.fn()
				.mockImplementation(async ({ lightingPreset }) => ({
					imageBuffer: Buffer.from(`relit-${lightingPreset}`),
					prompt: `vibe-${lightingPreset}`,
				})),
		};
		normalizeVideo = jest.fn().mockImplementation(async (buffer) => buffer);
		generator = new VideoGenerator(
			campaignManager,
			assetManager,
			falVideoService,
			imageRelightingService,
			normalizeVideo,
		);
	});

	async function setupCampaignWithAssets(assetCount = 5) {
		const campaign = await campaignManager.createCampaign({
			hero: 'Hero Product',
			targetRegion: 'North America',
			targetAudience: 'Architects',
			campaignMessage: 'See every detail',
		});

		for (let i = 0; i < assetCount; i++) {
			await assetManager.uploadAsset(campaign.id, {
				originalname: `hero-${i}.jpg`,
				mimetype: 'image/jpeg',
				buffer: testImageBuffer,
				size: testImageBuffer.length,
			} as Express.Multer.File);
		}

		return campaign;
	}

	it('relights once per lighting preset and submits 9 video jobs from themed stills', async () => {
		const campaign = await setupCampaignWithAssets();

		const result = await generator.start(campaign.id);

		expect(result.totalJobs).toBe(
			VIDEO_LIGHTING_PRESETS.length * ASPECT_RATIOS.length,
		);
		expect(imageRelightingService.relight).toHaveBeenCalledTimes(
			VIDEO_LIGHTING_PRESETS.length,
		);
		// 1 source upload + 1 themed upload per lighting preset
		expect(falVideoService.uploadImage).toHaveBeenCalledTimes(
			1 + VIDEO_LIGHTING_PRESETS.length,
		);
		expect(falVideoService.submitVideo).toHaveBeenCalledTimes(9);
	});

	it('feeds only the themed still URL into Kling (no multi-reference array)', async () => {
		const campaign = await setupCampaignWithAssets();

		await generator.start(campaign.id);

		for (const call of falVideoService.submitVideo.mock.calls) {
			const [request] = call;
			expect(request.referenceImageUrls).toHaveLength(1);
			expect(request.imageUrl).toBe(request.referenceImageUrls[0]);
			expect(request.imageUrl).not.toBe('https://fal.test/upload-1.jpg');
		}
	});

	it('saves a source.jpg per lighting preset before submitting videos', async () => {
		const campaign = await setupCampaignWithAssets(1);

		await generator.start(campaign.id);

		const writeCalls = (fsPromises.writeFile as jest.Mock).mock.calls;
		const sourceWrites = writeCalls.filter(([filePath]) =>
			String(filePath).endsWith('source.jpg'),
		);
		expect(sourceWrites).toHaveLength(VIDEO_LIGHTING_PRESETS.length);
		for (const preset of VIDEO_LIGHTING_PRESETS) {
			expect(
				sourceWrites.some(([filePath]) =>
					String(filePath).includes(`/${preset}/source.jpg`),
				),
			).toBe(true);
		}
	});

	it('polls completed provider jobs and returns video outputs', async () => {
		const campaign = await setupCampaignWithAssets(1);
		const startResult = await generator.start(campaign.id);

		const job = await generator.poll(startResult.jobId);

		expect(job?.status).toBe('completed');
		expect(job?.outputs).toHaveLength(9);
		expect(job?.outputs[0]).toEqual(
			expect.objectContaining({
				kind: 'video',
				hero: 'Hero Product',
				filePath: expect.stringContaining('creative.mp4'),
				previewUrl: expect.stringContaining('/outputs/'),
			}),
		);
		expect(normalizeVideo).toHaveBeenCalledTimes(9);
		expect(normalizeVideo).toHaveBeenCalledWith(
			expect.any(Buffer),
			'1:1',
			'See every detail',
		);
		expect(normalizeVideo).toHaveBeenCalledWith(
			expect.any(Buffer),
			'9:16',
			'See every detail',
		);
		expect(normalizeVideo).toHaveBeenCalledWith(
			expect.any(Buffer),
			'16:9',
			'See every detail',
		);
	});

	it('rejects video generation when no assets are uploaded', async () => {
		const campaign = await campaignManager.createCampaign({
			hero: 'Hero Product',
			targetRegion: 'North America',
			targetAudience: 'Architects',
			campaignMessage: 'See every detail',
		});

		await expect(generator.start(campaign.id)).rejects.toThrow(
			'video generation requires at least one uploaded image',
		);
	});
});

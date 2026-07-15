import axios from 'axios';
import { GenAIService, GenAIRequest } from '../../genai-service';
import { CampaignBrief } from '../../types';
import { config } from '../../config';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GenAIService', () => {
	let service: GenAIService;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
		service = new GenAIService();
	});

	describe('constructPrompt', () => {
		it('should include product name in the prompt', () => {
			const brief: CampaignBrief = {
				hero: 'Organic Face Cream',
				targetRegion: 'North America',
				targetAudience: 'Young professionals aged 25-35',
				campaignMessage: 'Discover the difference',
			};

			const prompt = service.constructPrompt(brief, 'Organic Face Cream');
			expect(prompt).toContain('Organic Face Cream');
		});

		it('should include target audience in the prompt', () => {
			const brief: CampaignBrief = {
				hero: 'Product A',
				targetRegion: 'Europe',
				targetAudience: 'Health-conscious millennials',
				campaignMessage: 'Feel the glow',
			};

			const prompt = service.constructPrompt(brief, 'Product A');
			expect(prompt).toContain('Health-conscious millennials');
		});

		it('should include target region in the prompt', () => {
			const brief: CampaignBrief = {
				hero: 'Product A',
				targetRegion: 'Asia Pacific',
				targetAudience: 'Teens',
				campaignMessage: 'Be bold',
			};

			const prompt = service.constructPrompt(brief, 'Product A');
			expect(prompt).toContain('Asia Pacific');
		});

		it('should include campaign message in the prompt', () => {
			const brief: CampaignBrief = {
				hero: 'Product A',
				targetRegion: 'Europe',
				targetAudience: 'Adults',
				campaignMessage: 'Unleash your potential',
			};

			const prompt = service.constructPrompt(brief, 'Product A');
			expect(prompt).toContain(
				'Convey this mood visually without words: Unleash your potential.',
			);
		});

		it('should follow the expected prompt template format', () => {
			const brief: CampaignBrief = {
				hero: 'Sneakers',
				targetRegion: 'North America',
				targetAudience: 'Athletes',
				campaignMessage: 'Run faster',
			};

			const prompt = service.constructPrompt(brief, 'Sneakers');
			expect(prompt).toBe(
				'Professional product photography of Sneakers ' +
					'for Athletes in North America. ' +
					'Convey this mood visually without words: Run faster. ' +
					'High quality, commercial use, clean background, ' +
					'well-lit, studio lighting, 4k resolution. ' +
					'Do not render any text, letters, captions, logos, signage, or watermarks in the image.',
			);
		});

		it('should explicitly prohibit generated in-frame text', () => {
			const brief: CampaignBrief = {
				hero: 'Product A',
				targetRegion: 'Europe',
				targetAudience: 'Adults',
				campaignMessage: 'Unleash your potential',
			};

			const prompt = service.constructPrompt(brief, 'Product A');
			expect(prompt).toContain(
				'Do not render any text, letters, captions, logos, signage, or watermarks in the image.',
			);
		});

		it('should handle brief with special characters in fields', () => {
			const brief: CampaignBrief = {
				hero: 'Product "Alpha"',
				targetRegion: 'São Paulo & Rio',
				targetAudience: 'Gen-Z / Millennials',
				campaignMessage: "Life's better together!",
			};

			const prompt = service.constructPrompt(brief, 'Product "Alpha"');
			expect(prompt).toContain('Product "Alpha"');
			expect(prompt).toContain('São Paulo & Rio');
			expect(prompt).toContain('Gen-Z / Millennials');
		});
	});

	describe('generateImage', () => {
		const fakeBase64 = Buffer.from('fake-image-data').toString('base64');

		const mockSuccessResponse = {
			data: {
				data: [{ b64_json: fakeBase64 }],
			},
		};

		it('should call OpenAI API with correct parameters', async () => {
			mockedAxios.post.mockResolvedValueOnce(mockSuccessResponse);

			const request: GenAIRequest = {
				prompt: 'Test prompt',
				width: 1024,
				height: 1024,
			};

			await service.generateImage(request);

			expect(mockedAxios.post).toHaveBeenCalledWith(
				'https://api.openai.com/v1/images/generations',
				{
					model: 'gpt-image-1',
					prompt: 'Test prompt',
					n: 1,
					size: '1024x1024',
					quality: 'medium',
				},
				expect.objectContaining({
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
					}),
					timeout: config.genai.timeout,
				}),
			);
		});

		it('should return image buffer from base64 response', async () => {
			mockedAxios.post.mockResolvedValueOnce(mockSuccessResponse);

			const request: GenAIRequest = {
				prompt: 'Test prompt',
				width: 1024,
				height: 1024,
			};

			const result = await service.generateImage(request);

			expect(result.imageBuffer).toBeInstanceOf(Buffer);
			expect(result.imageBuffer.toString()).toBe('fake-image-data');
		});

		it('should return model name and generatedAt timestamp', async () => {
			mockedAxios.post.mockResolvedValueOnce(mockSuccessResponse);

			const before = new Date();
			const result = await service.generateImage({
				prompt: 'Test',
				width: 1024,
				height: 1024,
			});
			const after = new Date();

			expect(result.model).toBe('gpt-image-1');
			expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(result.generatedAt.getTime()).toBeLessThanOrEqual(
				after.getTime(),
			);
		});

		it('should retry on failure with exponential backoff', async () => {
			jest.spyOn(global, 'setTimeout');

			mockedAxios.post
				.mockRejectedValueOnce(new Error('API rate limit'))
				.mockRejectedValueOnce(new Error('API rate limit'))
				.mockResolvedValueOnce(mockSuccessResponse);

			const result = await service.generateImage({
				prompt: 'Test',
				width: 1024,
				height: 1024,
			});

			// Should have been called 3 times (initial + 2 retries)
			expect(mockedAxios.post).toHaveBeenCalledTimes(3);
			expect(result.imageBuffer).toBeInstanceOf(Buffer);
		});

		it('should throw after exhausting all retries', async () => {
			mockedAxios.post.mockRejectedValue(
				new Error('Service unavailable'),
			);

			await expect(
				service.generateImage({
					prompt: 'Test',
					width: 1024,
					height: 1024,
				}),
			).rejects.toThrow(
				`GenAI image generation failed after ${config.genai.maxRetries + 1} attempts: Service unavailable`,
			);

			// initial attempt + maxRetries
			expect(mockedAxios.post).toHaveBeenCalledTimes(
				config.genai.maxRetries + 1,
			);
		});

		it('should include descriptive error message on failure', async () => {
			mockedAxios.post.mockRejectedValue(new Error('Invalid API key'));

			await expect(
				service.generateImage({
					prompt: 'Test',
					width: 1024,
					height: 1024,
				}),
			).rejects.toThrow('Invalid API key');
		});

		it('should handle non-Error thrown values', async () => {
			mockedAxios.post.mockRejectedValue('string error');

			await expect(
				service.generateImage({
					prompt: 'Test',
					width: 1024,
					height: 1024,
				}),
			).rejects.toThrow('string error');
		});

		it('should use timeout from config', async () => {
			mockedAxios.post.mockResolvedValueOnce(mockSuccessResponse);

			await service.generateImage({
				prompt: 'Test',
				width: 1024,
				height: 1024,
			});

			const callArgs = mockedAxios.post.mock.calls[0];
			expect(callArgs[2]?.timeout).toBe(config.genai.timeout);
		});

		it('should succeed on first attempt without retries', async () => {
			mockedAxios.post.mockResolvedValueOnce(mockSuccessResponse);

			const result = await service.generateImage({
				prompt: 'Test',
				width: 1024,
				height: 1024,
			});

			expect(mockedAxios.post).toHaveBeenCalledTimes(1);
			expect(result.imageBuffer).toBeInstanceOf(Buffer);
		});
	});
});

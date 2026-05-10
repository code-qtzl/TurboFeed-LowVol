import path from 'path';

const subscribeMock = jest.fn();

jest.mock('@fal-ai/client', () => ({
	fal: {
		config: jest.fn(),
		subscribe: (...args: unknown[]) => subscribeMock(...args),
	},
}));

jest.mock('axios', () => ({
	__esModule: true,
	default: {
		get: jest.fn().mockResolvedValue({ data: Buffer.from('image-bytes') }),
	},
}));

jest.mock('../../config', () => ({
	config: {
		fal: {
			apiKey: 'test-key',
			imageEditEndpoint: 'fal-ai/test-edit',
			vibePromptDir: '../.github/workflows/time-of-day',
		},
	},
}));

import { ImageRelightingService } from '../../image-relighting-service';

const VIBE_DIR = path.resolve(
	__dirname,
	'../../../../.github/workflows/time-of-day',
);

describe('ImageRelightingService', () => {
	beforeEach(() => {
		subscribeMock.mockReset();
		subscribeMock.mockResolvedValue({
			data: { images: [{ url: 'https://fal.test/relit.jpg' }] },
		});
	});

	it('reads the morning vibe markdown for golden_hour', async () => {
		const service = new ImageRelightingService(
			'fal-ai/test-edit',
			VIBE_DIR,
		);
		const prompt = await service.loadVibePrompt('golden_hour');
		expect(prompt).toContain('Morning');
		expect(prompt).toContain('Transform this photo');
	});

	it('submits the source image with the vibe prompt and returns the relit buffer', async () => {
		const service = new ImageRelightingService(
			'fal-ai/test-edit',
			VIBE_DIR,
		);

		const result = await service.relight({
			imageUrl: 'https://fal.test/source.jpg',
			lightingPreset: 'dusk',
		});

		expect(subscribeMock).toHaveBeenCalledWith(
			'fal-ai/test-edit',
			expect.objectContaining({
				input: expect.objectContaining({
					image_url: 'https://fal.test/source.jpg',
				}),
			}),
		);
		const [, options] = subscribeMock.mock.calls[0];
		expect(options.input.prompt).toContain('Evening');
		expect(result.imageBuffer).toBeInstanceOf(Buffer);
		expect(result.prompt).toContain('Evening');
	});

	it('throws when the relight response has no image URL', async () => {
		subscribeMock.mockResolvedValueOnce({ data: {} });
		const service = new ImageRelightingService(
			'fal-ai/test-edit',
			VIBE_DIR,
		);

		await expect(
			service.relight({
				imageUrl: 'https://fal.test/source.jpg',
				lightingPreset: 'afternoon',
			}),
		).rejects.toThrow('Image relighting result did not include an image URL');
	});
});

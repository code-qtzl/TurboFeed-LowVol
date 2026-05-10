import { FalVideoService } from '../../fal-video-service';
import { CampaignBrief } from '../../types';

describe('FalVideoService', () => {
	const service = new FalVideoService('test-endpoint');
	const brief: CampaignBrief = {
		hero: 'Hero Product',
		targetRegion: 'North America',
		targetAudience: 'Luxury homeowners',
		campaignMessage: 'Bring the room to life',
	};

	describe('constructPrompt', () => {
		it('includes the product and motion-only language', () => {
			const prompt = service.constructPrompt(brief, 'Hero Product');

			expect(prompt).toContain('Hero Product');
			expect(prompt).toContain('5 second');
			expect(prompt).toContain('dolly-in');
			expect(prompt).toContain(
				'Preserve the source image lighting state',
			);
			expect(prompt).toContain('one fixed lighting state');
			expect(prompt).toContain('do not transition');
		});

		it('does not embed campaign message, audience, or region (those become SVG overlay only)', () => {
			const prompt = service.constructPrompt(brief, 'Hero Product');

			expect(prompt).not.toContain('Bring the room to life');
			expect(prompt).not.toContain('Luxury homeowners');
			expect(prompt).not.toContain('North America');
			expect(prompt).not.toContain('Campaign message');
		});

		it('explicitly forbids in-frame text generation', () => {
			const prompt = service.constructPrompt(brief, 'Hero Product');

			expect(prompt).toContain('Do not render any text');
		});

		it('does not embed time-of-day language since lighting is baked into the source still', () => {
			const prompt = service.constructPrompt(brief, 'Hero Product');

			expect(prompt).not.toContain('Morning golden hour');
			expect(prompt).not.toContain('Evening dusk');
			expect(prompt).not.toContain('Time-of-day style guide');
		});
	});

	describe('buildInput', () => {
		it('maps video generation settings for a single themed still', () => {
			const input = service.buildInput({
				prompt: 'Test prompt',
				imageUrl: 'https://example.com/themed.jpg',
				referenceImageUrls: ['https://example.com/themed.jpg'],
				aspectRatio: '9:16',
			});

			expect(input).toEqual(
				expect.objectContaining({
					prompt: 'Test prompt',
					image_url: 'https://example.com/themed.jpg',
					duration: '5',
					aspect_ratio: '9:16',
				}),
			);
			expect(input.input_image_urls).toBeUndefined();
		});

		it('still supports up to 4 reference image URLs when provided', () => {
			const input = service.buildInput({
				prompt: 'Test prompt',
				imageUrl: 'https://example.com/primary.jpg',
				referenceImageUrls: [
					'https://example.com/1.jpg',
					'https://example.com/2.jpg',
					'https://example.com/3.jpg',
					'https://example.com/4.jpg',
					'https://example.com/5.jpg',
				],
				aspectRatio: '1:1',
			});

			expect(input.input_image_urls).toEqual([
				'https://example.com/1.jpg',
				'https://example.com/2.jpg',
				'https://example.com/3.jpg',
				'https://example.com/4.jpg',
			]);
			expect(input.image_url).toBe('https://example.com/1.jpg');
		});
	});
});

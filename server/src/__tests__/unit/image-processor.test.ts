import sharp from 'sharp';
import {
	resizeImage,
	createTextOverlaySVG,
	overlayText,
	ASPECT_RATIOS,
} from '../../image-processor';

describe('Image Processor', () => {
	describe('ASPECT_RATIOS configuration', () => {
		it('should define three aspect ratios', () => {
			expect(ASPECT_RATIOS).toHaveLength(3);
		});

		it('should include 1:1 aspect ratio (1080x1080)', () => {
			const square = ASPECT_RATIOS.find((ar) => ar.ratio === '1:1');
			expect(square).toBeDefined();
			expect(square?.width).toBe(1080);
			expect(square?.height).toBe(1080);
		});

		it('should include 9:16 aspect ratio (1080x1920)', () => {
			const story = ASPECT_RATIOS.find((ar) => ar.ratio === '9:16');
			expect(story).toBeDefined();
			expect(story?.width).toBe(1080);
			expect(story?.height).toBe(1920);
		});

		it('should include 16:9 aspect ratio (1920x1080)', () => {
			const landscape = ASPECT_RATIOS.find((ar) => ar.ratio === '16:9');
			expect(landscape).toBeDefined();
			expect(landscape?.width).toBe(1920);
			expect(landscape?.height).toBe(1080);
		});
	});

	describe('resizeImage', () => {
		let testImageBuffer: Buffer;

		beforeAll(async () => {
			// Create a test image (2000x2000 red square)
			testImageBuffer = await sharp({
				create: {
					width: 2000,
					height: 2000,
					channels: 3,
					background: { r: 255, g: 0, b: 0 },
				},
			})
				.jpeg()
				.toBuffer();
		});

		it('should resize image to 1:1 aspect ratio (1080x1080)', async () => {
			const resized = await resizeImage(testImageBuffer, 1080, 1080);
			const metadata = await sharp(resized).metadata();

			expect(metadata.width).toBe(1080);
			expect(metadata.height).toBe(1080);
		});

		it('should resize image to 9:16 aspect ratio (1080x1920)', async () => {
			const resized = await resizeImage(testImageBuffer, 1080, 1920);
			const metadata = await sharp(resized).metadata();

			expect(metadata.width).toBe(1080);
			expect(metadata.height).toBe(1920);
		});

		it('should resize image to 16:9 aspect ratio (1920x1080)', async () => {
			const resized = await resizeImage(testImageBuffer, 1920, 1080);
			const metadata = await sharp(resized).metadata();

			expect(metadata.width).toBe(1920);
			expect(metadata.height).toBe(1080);
		});

		it('should output JPEG format', async () => {
			const resized = await resizeImage(testImageBuffer, 1080, 1080);
			const metadata = await sharp(resized).metadata();

			expect(metadata.format).toBe('jpeg');
		});

		it('should handle rectangular source images', async () => {
			// Create a wide rectangular image (3000x1500)
			const wideImage = await sharp({
				create: {
					width: 3000,
					height: 1500,
					channels: 3,
					background: { r: 0, g: 255, b: 0 },
				},
			})
				.jpeg()
				.toBuffer();

			const resized = await resizeImage(wideImage, 1080, 1080);
			const metadata = await sharp(resized).metadata();

			expect(metadata.width).toBe(1080);
			expect(metadata.height).toBe(1080);
		});
	});

	describe('createTextOverlaySVG', () => {
		it('should create valid SVG with text', () => {
			const svg = createTextOverlaySVG('Test Message', 1080, 1080);

			expect(svg).toContain('<svg');
			expect(svg).toContain('</svg>');
			expect(svg).toContain('Test Message');
		});

		it('should use 48px font for 1:1 aspect ratio (1080x1080)', () => {
			const svg = createTextOverlaySVG('Test', 1080, 1080);

			expect(svg).toContain('font-size: 48px');
		});

		it('should use 56px font for 9:16 aspect ratio (1080x1920)', () => {
			const svg = createTextOverlaySVG('Test', 1080, 1920);

			expect(svg).toContain('font-size: 56px');
		});

		it('should use 64px font for 16:9 aspect ratio (1920x1080)', () => {
			const svg = createTextOverlaySVG('Test', 1920, 1080);

			expect(svg).toContain('font-size: 64px');
		});

		it('should position text at 85% from top', () => {
			const svg = createTextOverlaySVG('Test', 1080, 1080);

			expect(svg).toContain('y="85%"');
		});

		it('should center-align text', () => {
			const svg = createTextOverlaySVG('Test', 1080, 1080);

			expect(svg).toContain('x="50%"');
			expect(svg).toContain('text-anchor="middle"');
		});

		it('should apply Arial font, bold weight, white color', () => {
			const svg = createTextOverlaySVG('Test', 1080, 1080);

			expect(svg).toContain('font-family: Arial');
			expect(svg).toContain('font-weight: bold');
			expect(svg).toContain('fill: white');
		});

		it('should apply text shadow for contrast', () => {
			const svg = createTextOverlaySVG('Test', 1080, 1080);

			expect(svg).toContain('text-shadow: 2px 2px 4px rgba(0,0,0,0.8)');
		});

		it('should truncate text at 100 characters with ellipsis', () => {
			const longText = 'a'.repeat(150);
			const svg = createTextOverlaySVG(longText, 1080, 1080);

			expect(svg).toContain('a'.repeat(100) + '...');
			expect(svg).not.toContain('a'.repeat(101));
		});

		it('should not truncate text under 100 characters', () => {
			const shortText = 'Short message';
			const svg = createTextOverlaySVG(shortText, 1080, 1080);

			expect(svg).toContain('Short message');
			expect(svg).not.toContain('...');
		});

		it('should escape XML special characters', () => {
			const textWithSpecialChars = 'Test & <tag> "quotes" \'apostrophe\'';
			const svg = createTextOverlaySVG(textWithSpecialChars, 1080, 1080);

			expect(svg).toContain('&amp;');
			expect(svg).toContain('&lt;');
			expect(svg).toContain('&gt;');
			expect(svg).toContain('&quot;');
			expect(svg).toContain('&apos;');
			expect(svg).not.toContain('Test & <tag>');
		});
	});

	describe('overlayText', () => {
		let testImageBuffer: Buffer;

		beforeAll(async () => {
			// Create a test image (1080x1080 blue square)
			testImageBuffer = await sharp({
				create: {
					width: 1080,
					height: 1080,
					channels: 3,
					background: { r: 0, g: 0, b: 255 },
				},
			})
				.jpeg()
				.toBuffer();
		});

		it('should overlay text on image', async () => {
			const result = await overlayText(testImageBuffer, 'Test Message', {
				width: 1080,
				height: 1080,
			});

			expect(result).toBeInstanceOf(Buffer);
			expect(result.length).toBeGreaterThan(0);
		});

		it('should maintain image dimensions', async () => {
			const result = await overlayText(testImageBuffer, 'Test', {
				width: 1080,
				height: 1080,
			});
			const metadata = await sharp(result).metadata();

			expect(metadata.width).toBe(1080);
			expect(metadata.height).toBe(1080);
		});

		it('should work with different aspect ratios', async () => {
			const wideImage = await sharp({
				create: {
					width: 1920,
					height: 1080,
					channels: 3,
					background: { r: 0, g: 255, b: 0 },
				},
			})
				.jpeg()
				.toBuffer();

			const result = await overlayText(wideImage, 'Wide Text', {
				width: 1920,
				height: 1080,
			});
			const metadata = await sharp(result).metadata();

			expect(metadata.width).toBe(1920);
			expect(metadata.height).toBe(1080);
		});

		it('should handle long text with truncation', async () => {
			const longText = 'a'.repeat(150);
			const result = await overlayText(testImageBuffer, longText, {
				width: 1080,
				height: 1080,
			});

			expect(result).toBeInstanceOf(Buffer);
			expect(result.length).toBeGreaterThan(0);
		});

		it('should handle special characters in text', async () => {
			const specialText = 'Test & <special> "chars"';
			const result = await overlayText(testImageBuffer, specialText, {
				width: 1080,
				height: 1080,
			});

			expect(result).toBeInstanceOf(Buffer);
			expect(result.length).toBeGreaterThan(0);
		});
	});
});

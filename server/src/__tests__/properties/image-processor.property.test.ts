import fc from 'fast-check';
import sharp from 'sharp';
import {
	resizeImage,
	createTextOverlaySVG,
	overlayText,
	ASPECT_RATIOS,
} from '../../image-processor';

describe('Image Processor Property Tests', () => {
	// Helper to create test images
	async function createTestImage(
		width: number,
		height: number,
	): Promise<Buffer> {
		return await sharp({
			create: {
				width,
				height,
				channels: 3,
				background: { r: 128, g: 128, b: 128 },
			},
		})
			.jpeg()
			.toBuffer();
	}

	describe('Property 12: Image Processing Dimensions', () => {
		/**
		 * **Validates: Requirements 4.4**
		 * For any source image processed for a specific aspect ratio,
		 * the output image dimensions should exactly match the target dimensions
		 */
		it('should always produce exact target dimensions for any source image', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.integer({ min: 800, max: 4000 }), // source width
					fc.integer({ min: 800, max: 4000 }), // source height
					fc.constantFrom(...ASPECT_RATIOS), // target aspect ratio
					async (sourceWidth, sourceHeight, aspectRatio) => {
						// Create source image
						const sourceImage = await createTestImage(
							sourceWidth,
							sourceHeight,
						);

						// Resize to target dimensions
						const resized = await resizeImage(
							sourceImage,
							aspectRatio.width,
							aspectRatio.height,
						);

						// Verify output dimensions
						const metadata = await sharp(resized).metadata();
						expect(metadata.width).toBe(aspectRatio.width);
						expect(metadata.height).toBe(aspectRatio.height);
					},
				),
				{ numRuns: 100 },
			);
		});
	});

	describe('Property 13: Text Overlay Presence', () => {
		/**
		 * **Validates: Requirements 4.5, 5.1**
		 * For any generated creative output, the image should contain
		 * the campaign message text overlaid on it
		 */
		it('should always include text in SVG overlay for any message', () => {
			fc.assert(
				fc.property(
					fc
						.string({ minLength: 1, maxLength: 200 })
						.filter((s) => s.trim().length > 0), // Non-whitespace messages only
					fc.constantFrom(...ASPECT_RATIOS), // aspect ratio
					(message, aspectRatio) => {
						const svg = createTextOverlaySVG(
							message,
							aspectRatio.width,
							aspectRatio.height,
						);

						// SVG should be valid
						expect(svg).toContain('<svg');
						expect(svg).toContain('</svg>');
						expect(svg).toContain('<text');

						// Escape the expected text the same way the source does
						const expectedText =
							message.length > 100
								? message.substring(0, 100)
								: message;
						const escapedExpected = expectedText
							.replace(/&/g, '&amp;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;')
							.replace(/"/g, '&quot;')
							.replace(/'/g, '&apos;');

						// The SVG should contain the escaped text
						expect(svg).toContain(escapedExpected);
					},
				),
				{ numRuns: 100 },
			);
		});

		it('should produce valid image buffer with text overlay for any input', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.string({ minLength: 1, maxLength: 200 }),
					fc.constantFrom(...ASPECT_RATIOS),
					async (message, aspectRatio) => {
						const sourceImage = await createTestImage(
							aspectRatio.width,
							aspectRatio.height,
						);

						const result = await overlayText(sourceImage, message, {
							width: aspectRatio.width,
							height: aspectRatio.height,
						});

						// Should produce valid buffer
						expect(result).toBeInstanceOf(Buffer);
						expect(result.length).toBeGreaterThan(0);

						// Should maintain dimensions
						const metadata = await sharp(result).metadata();
						expect(metadata.width).toBe(aspectRatio.width);
						expect(metadata.height).toBe(aspectRatio.height);
					},
				),
				{ numRuns: 100 },
			);
		});
	});

	describe('Property 14: Typography Consistency', () => {
		/**
		 * **Validates: Requirements 5.3**
		 * For any campaign, all generated creative outputs should use
		 * the same font family, font weight, and text color
		 */
		it('should use consistent typography across all aspect ratios', () => {
			fc.assert(
				fc.property(
					fc.string({ minLength: 1, maxLength: 100 }),
					(message) => {
						const svgs = ASPECT_RATIOS.map((ar) =>
							createTextOverlaySVG(message, ar.width, ar.height),
						);

						// All should use Arial font
						svgs.forEach((svg) => {
							expect(svg).toContain('font-family: Arial');
						});

						// All should use bold weight
						svgs.forEach((svg) => {
							expect(svg).toContain('font-weight: bold');
						});

						// All should use white color
						svgs.forEach((svg) => {
							expect(svg).toContain('fill: white');
						});

						// All should have text shadow
						svgs.forEach((svg) => {
							expect(svg).toContain(
								'text-shadow: 2px 2px 4px rgba(0,0,0,0.8)',
							);
						});
					},
				),
				{ numRuns: 100 },
			);
		});
	});

	describe('Property 15: Text Overflow Handling', () => {
		/**
		 * **Validates: Requirements 5.4**
		 * For any campaign message exceeding 100 characters,
		 * the rendered text should be truncated to fit
		 */
		it('should truncate any message exceeding 100 characters', () => {
			fc.assert(
				fc.property(
					fc
						.string({ minLength: 101, maxLength: 500 })
						.filter((s) => s.trim().length > 0), // Long non-whitespace messages
					fc.constantFrom(...ASPECT_RATIOS),
					(longMessage, aspectRatio) => {
						const svg = createTextOverlaySVG(
							longMessage,
							aspectRatio.width,
							aspectRatio.height,
						);

						// Should contain ellipsis
						expect(svg).toContain('...');

						// The truncated+escaped first 100 chars should be in the SVG
						const truncated = longMessage.substring(0, 100);
						const escapedTruncated = truncated
							.replace(/&/g, '&amp;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;')
							.replace(/"/g, '&quot;')
							.replace(/'/g, '&apos;');

						// SVG should contain the escaped truncated text followed by ellipsis
						expect(svg).toContain(escapedTruncated + '...');

						// The full original message should NOT appear (it was truncated)
						if (longMessage.length > 100) {
							const escapedFull = longMessage
								.replace(/&/g, '&amp;')
								.replace(/</g, '&lt;')
								.replace(/>/g, '&gt;')
								.replace(/"/g, '&quot;')
								.replace(/'/g, '&apos;');
							expect(svg).not.toContain(escapedFull);
						}
					},
				),
				{ numRuns: 100 },
			);
		});

		it('should not truncate messages under 100 characters', () => {
			fc.assert(
				fc.property(
					fc.string({ minLength: 1, maxLength: 100 }),
					fc.constantFrom(...ASPECT_RATIOS),
					(shortMessage, aspectRatio) => {
						const svg = createTextOverlaySVG(
							shortMessage,
							aspectRatio.width,
							aspectRatio.height,
						);

						// Should NOT contain ellipsis
						expect(svg).not.toContain('...');
					},
				),
				{ numRuns: 100 },
			);
		});
	});

	describe('Text Positioning Properties', () => {
		it('should always position text at 85% from top for any dimensions', () => {
			fc.assert(
				fc.property(
					fc.string({ minLength: 1, maxLength: 100 }),
					fc.constantFrom(...ASPECT_RATIOS),
					(message, aspectRatio) => {
						const svg = createTextOverlaySVG(
							message,
							aspectRatio.width,
							aspectRatio.height,
						);

						expect(svg).toContain('y="85%"');
					},
				),
				{ numRuns: 100 },
			);
		});

		it('should always center-align text horizontally', () => {
			fc.assert(
				fc.property(
					fc.string({ minLength: 1, maxLength: 100 }),
					fc.constantFrom(...ASPECT_RATIOS),
					(message, aspectRatio) => {
						const svg = createTextOverlaySVG(
							message,
							aspectRatio.width,
							aspectRatio.height,
						);

						expect(svg).toContain('x="50%"');
						expect(svg).toContain('text-anchor="middle"');
					},
				),
				{ numRuns: 100 },
			);
		});
	});

	describe('Font Size Responsiveness Properties', () => {
		it('should use 48px font for 1:1 aspect ratio', () => {
			fc.assert(
				fc.property(
					fc.string({ minLength: 1, maxLength: 100 }),
					(message) => {
						const svg = createTextOverlaySVG(message, 1080, 1080);
						expect(svg).toContain('font-size: 48px');
					},
				),
				{ numRuns: 100 },
			);
		});

		it('should use 56px font for 9:16 aspect ratio', () => {
			fc.assert(
				fc.property(
					fc.string({ minLength: 1, maxLength: 100 }),
					(message) => {
						const svg = createTextOverlaySVG(message, 1080, 1920);
						expect(svg).toContain('font-size: 56px');
					},
				),
				{ numRuns: 100 },
			);
		});

		it('should use 64px font for 16:9 aspect ratio', () => {
			fc.assert(
				fc.property(
					fc.string({ minLength: 1, maxLength: 100 }),
					(message) => {
						const svg = createTextOverlaySVG(message, 1920, 1080);
						expect(svg).toContain('font-size: 64px');
					},
				),
				{ numRuns: 100 },
			);
		});
	});

	describe('XML Safety Properties', () => {
		it('should escape all XML special characters in any text', () => {
			fc.assert(
				fc.property(
					fc.string({ minLength: 1, maxLength: 100 }),
					fc.constantFrom(...ASPECT_RATIOS),
					(message, aspectRatio) => {
						const svg = createTextOverlaySVG(
							message,
							aspectRatio.width,
							aspectRatio.height,
						);

						// If original message had special chars, they should be escaped
						if (message.includes('&')) {
							expect(svg).toContain('&amp;');
						}
						if (message.includes('<')) {
							expect(svg).toContain('&lt;');
						}
						if (message.includes('>')) {
							expect(svg).toContain('&gt;');
						}
						if (message.includes('"')) {
							expect(svg).toContain('&quot;');
						}
						if (message.includes("'")) {
							expect(svg).toContain('&apos;');
						}
					},
				),
				{ numRuns: 100 },
			);
		});
	});

	describe('Output Format Properties', () => {
		it('should always output JPEG format for any input image', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.integer({ min: 800, max: 4000 }),
					fc.integer({ min: 800, max: 4000 }),
					fc.constantFrom(...ASPECT_RATIOS),
					async (sourceWidth, sourceHeight, aspectRatio) => {
						const sourceImage = await createTestImage(
							sourceWidth,
							sourceHeight,
						);

						const resized = await resizeImage(
							sourceImage,
							aspectRatio.width,
							aspectRatio.height,
						);

						const metadata = await sharp(resized).metadata();
						expect(metadata.format).toBe('jpeg');
					},
				),
				{ numRuns: 100 },
			);
		});
	});
});

import sharp from 'sharp';

/**
 * Aspect ratio configuration for creative generation
 */
export interface AspectRatioConfig {
	ratio: '1:1' | '9:16' | '16:9';
	width: number;
	height: number;
}

/**
 * Supported aspect ratios for social media platforms
 */
export const ASPECT_RATIOS: AspectRatioConfig[] = [
	{ ratio: '1:1', width: 1080, height: 1080 }, // Instagram square
	{ ratio: '9:16', width: 1080, height: 1920 }, // Instagram/TikTok story
	{ ratio: '16:9', width: 1920, height: 1080 }, // YouTube/Facebook landscape
];

/**
 * Resizes an image to target dimensions using cover fit strategy
 * Maintains aspect ratio and crops excess content from center
 *
 * @param imageBuffer - Input image as Buffer
 * @param width - Target width in pixels
 * @param height - Target height in pixels
 * @returns Resized image as Buffer
 */
export async function resizeImage(
	imageBuffer: Buffer,
	width: number,
	height: number,
): Promise<Buffer> {
	return sharp(imageBuffer)
		.resize(width, height, {
			fit: 'cover',
			position: 'center',
		})
		.jpeg({ quality: 90 })
		.toBuffer();
}

/**
 * Determines appropriate font size based on image dimensions
 * Larger dimensions get larger font sizes for better readability
 *
 * @param dimensions - Image dimensions
 * @returns Font size in pixels
 */
function getFontSizeForDimensions(dimensions: {
	width: number;
	height: number;
}): number {
	const { width, height } = dimensions;

	// 1:1 aspect ratio (1080x1080)
	if (width === 1080 && height === 1080) {
		return 48;
	}

	// 9:16 aspect ratio (1080x1920) - vertical/story
	if (width === 1080 && height === 1920) {
		return 56;
	}

	// 16:9 aspect ratio (1920x1080) - horizontal/landscape
	if (width === 1920 && height === 1080) {
		return 64;
	}

	// Default fallback
	return 48;
}

/**
 * Creates an SVG text overlay with styling for campaign messages
 * Text is positioned at 85% from top, center-aligned with shadow for contrast
 *
 * @param text - Campaign message text to render
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @param fontSize - Font size in pixels (responsive to aspect ratio if not provided)
 * @returns SVG string for text overlay
 */
export function createTextOverlaySVG(
	text: string,
	width: number,
	height: number,
	fontSize?: number,
): string {
	// Determine responsive font size based on dimensions if not provided
	const responsiveFontSize =
		fontSize || getFontSizeForDimensions({ width, height });

	// Truncate text if it exceeds 100 characters (BEFORE escaping)
	const truncatedText =
		text.length > 100 ? text.substring(0, 100) + '...' : text;

	// Escape XML special characters (AFTER truncation)
	const displayText = truncatedText
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');

	return `
    <svg width="${width}" height="${height}">
      <style>
        .title { 
          fill: white; 
          font-size: ${responsiveFontSize}px; 
          font-family: Arial, sans-serif;
          font-weight: bold;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        }
      </style>
      <text x="50%" y="85%" text-anchor="middle" class="title">
        ${displayText}
      </text>
    </svg>
  `;
}

/**
 * Overlays text onto an image using SVG composite
 *
 * @param imageBuffer - Base image as Buffer
 * @param text - Campaign message text
 * @param dimensions - Image dimensions (width and height)
 * @param fontSize - Optional font size (defaults based on aspect ratio)
 * @returns Image with text overlay as Buffer
 */
export async function overlayText(
	imageBuffer: Buffer,
	text: string,
	dimensions: { width: number; height: number },
	fontSize?: number,
): Promise<Buffer> {
	// Determine responsive font size based on aspect ratio if not provided
	const defaultFontSize = fontSize || getFontSizeForDimensions(dimensions);

	const textSvg = createTextOverlaySVG(
		text,
		dimensions.width,
		dimensions.height,
		defaultFontSize,
	);

	return sharp(imageBuffer)
		.composite([
			{
				input: Buffer.from(textSvg),
				top: 0,
				left: 0,
			},
		])
		.toBuffer();
}

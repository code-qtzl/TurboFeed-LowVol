import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import {
	AspectRatioConfig,
	createTextOverlaySVG,
} from './image-processor';

const execFileAsync = promisify(execFile);

export const VIDEO_DIMENSIONS: Record<
	AspectRatioConfig['ratio'],
	{ width: number; height: number }
> = {
	'1:1': { width: 1080, height: 1080 },
	'9:16': { width: 1080, height: 1920 },
	'16:9': { width: 1920, height: 1080 },
};

async function renderTextOverlayPng(
	text: string,
	width: number,
	height: number,
): Promise<Buffer> {
	const svg = createTextOverlaySVG(text, width, height);
	return sharp(Buffer.from(svg))
		.resize(width, height, { fit: 'fill' })
		.png()
		.toBuffer();
}

export async function normalizeVideoAspectRatio(
	buffer: Buffer,
	aspectRatio: AspectRatioConfig['ratio'],
	overlayText?: string,
): Promise<Buffer> {
	const dimensions = VIDEO_DIMENSIONS[aspectRatio];
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'turbofeed-video-'));
	const inputPath = path.join(tempDir, 'input.mp4');
	const outputPath = path.join(tempDir, 'output.mp4');
	const overlayPath = path.join(tempDir, 'overlay.png');

	const trimmedText = overlayText?.trim();
	const hasOverlay = Boolean(trimmedText);

	try {
		await fs.writeFile(inputPath, buffer);

		const args: string[] = ['-y', '-i', inputPath];

		if (hasOverlay) {
			const overlayPng = await renderTextOverlayPng(
				trimmedText!,
				dimensions.width,
				dimensions.height,
			);
			await fs.writeFile(overlayPath, overlayPng);
			args.push('-i', overlayPath);
			args.push(
				'-filter_complex',
				`[0:v]scale=${dimensions.width}:${dimensions.height}:force_original_aspect_ratio=increase,crop=${dimensions.width}:${dimensions.height},setsar=1[bg];[bg][1:v]overlay=0:0:format=auto[out]`,
				'-map',
				'[out]',
			);
		} else {
			args.push(
				'-map',
				'0:v:0',
				'-vf',
				`scale=${dimensions.width}:${dimensions.height}:force_original_aspect_ratio=increase,crop=${dimensions.width}:${dimensions.height},setsar=1`,
			);
		}

		args.push(
			'-an',
			'-c:v',
			'libx264',
			'-preset',
			'medium',
			'-crf',
			'18',
			'-pix_fmt',
			'yuv420p',
			'-movflags',
			'+faststart',
			outputPath,
		);

		await execFileAsync('ffmpeg', args);
		return await fs.readFile(outputPath);
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
	}
}

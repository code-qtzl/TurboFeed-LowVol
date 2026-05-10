import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { CampaignManager, validateCampaignBrief } from './campaign-manager';
import { AssetManager } from './asset-manager';
import { CreativeGenerator } from './creative-generator';
import { GenAIService } from './genai-service';
import { FalVideoService } from './fal-video-service';
import { ImageRelightingService } from './image-relighting-service';
import { VideoGenerator } from './video-generator';
import { ErrorResponse } from './types';
import { config } from './config';

interface Message {
	id: number;
	name: string;
	message: string;
	timestamp: Date;
}

const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/outputs', express.static(config.storage.outputDir));

// Multer configuration for file uploads (in-memory storage)
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: config.assets.maxSize },
});

// Service instances
const campaignManager = new CampaignManager();
const assetManager = new AssetManager();
const genAIService = new GenAIService();
const falVideoService = new FalVideoService();
const imageRelightingService = new ImageRelightingService();
const creativeGenerator = new CreativeGenerator(
	campaignManager,
	assetManager,
	genAIService,
);
const videoGenerator = new VideoGenerator(
	campaignManager,
	assetManager,
	falVideoService,
	imageRelightingService,
);

// --- Legacy message board endpoints ---

let messages: Message[] = [];
let nextId = 1;

app.get('/messages', (req, res) => {
	res.json(messages);
});

app.post('/messages', (req, res) => {
	const { name, message } = req.body;

	if (!name || !message) {
		return res.status(400).json({ error: 'Name and message are required' });
	}

	const newMessage: Message = {
		id: nextId++,
		name,
		message,
		timestamp: new Date(),
	};

	messages.push(newMessage);
	res.status(201).json(newMessage);
});

// --- Helper to build error responses ---

function errorResponse(
	code: ErrorResponse['error']['code'],
	message: string,
	details?: Record<string, any>,
): ErrorResponse {
	return {
		error: {
			code,
			message,
			details,
			timestamp: new Date().toISOString(),
		},
	};
}

// --- Campaign API endpoints (Task 8.1) ---

// POST /api/campaigns - Create a new campaign
app.post('/api/campaigns', async (req, res) => {
	try {
		const validation = validateCampaignBrief(req.body);
		if (!validation.valid) {
			return res
				.status(400)
				.json(
					errorResponse(
						'VALIDATION_ERROR',
						'Invalid campaign brief',
						{ fields: validation.errors },
					),
				);
		}

		const campaign = await campaignManager.createCampaign(req.body);
		res.status(201).json(campaign);
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json(errorResponse('SERVER_ERROR', msg));
	}
});

// GET /api/campaigns/:campaignId - Retrieve campaign details
app.get('/api/campaigns/:campaignId', async (req, res) => {
	try {
		const campaign = await campaignManager.getCampaign(
			req.params.campaignId,
		);
		if (!campaign) {
			return res
				.status(404)
				.json(
					errorResponse(
						'NOT_FOUND',
						`Campaign ${req.params.campaignId} not found`,
					),
				);
		}
		res.status(200).json(campaign);
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json(errorResponse('SERVER_ERROR', msg));
	}
});

// GET /api/campaigns/:campaignId/outputs - Retrieve campaign outputs
app.get('/api/campaigns/:campaignId/outputs', async (req, res) => {
	try {
		const campaign = await campaignManager.getCampaign(
			req.params.campaignId,
		);
		if (!campaign) {
			return res
				.status(404)
				.json(
					errorResponse(
						'NOT_FOUND',
						`Campaign ${req.params.campaignId} not found`,
					),
				);
		}
		res.status(200).json({
			campaignId: campaign.id,
			outputs: campaign.outputs,
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json(errorResponse('SERVER_ERROR', msg));
	}
});

// --- Asset API endpoints (Task 8.2) ---

// POST /api/campaigns/:campaignId/assets - Upload an asset
app.post(
	'/api/campaigns/:campaignId/assets',
	upload.single('file'),
	async (req, res) => {
		try {
			// Verify campaign exists first
			const campaign = await campaignManager.getCampaign(
				req.params.campaignId,
			);
			if (!campaign) {
				return res
					.status(404)
					.json(
						errorResponse(
							'NOT_FOUND',
							`Campaign ${req.params.campaignId} not found`,
						),
					);
			}

			if (!req.file) {
				return res
					.status(400)
					.json(
						errorResponse('VALIDATION_ERROR', 'No file provided'),
					);
			}

			const asset = await assetManager.uploadAsset(
				req.params.campaignId,
				req.file,
			);

			// Return asset without the raw buffer
			const { buffer, ...assetResponse } = asset;
			res.status(201).json(assetResponse);
		} catch (error) {
			const msg =
				error instanceof Error ? error.message : 'Unknown error';
			// Asset validation errors come as thrown errors from AssetManager
			if (
				msg.includes('Unsupported file type') ||
				msg.includes('File too large') ||
				msg.includes('Image dimensions too small') ||
				msg.includes('Failed to process image')
			) {
				return res
					.status(400)
					.json(errorResponse('VALIDATION_ERROR', msg));
			}
			res.status(500).json(errorResponse('SERVER_ERROR', msg));
		}
	},
);

// --- Creative generation API endpoint (Task 8.3) ---

// POST /api/campaigns/:campaignId/generate - Trigger creative generation
app.post('/api/campaigns/:campaignId/generate', async (req, res) => {
	try {
		const campaign = await campaignManager.getCampaign(
			req.params.campaignId,
		);
		if (!campaign) {
			return res
				.status(404)
				.json(
					errorResponse(
						'NOT_FOUND',
						`Campaign ${req.params.campaignId} not found`,
					),
				);
		}

		const result = await creativeGenerator.generate({
			campaignId: req.params.campaignId,
			useGenAI: req.body?.useGenAI ?? false,
		});

		// Strip buffers from output before sending response
		const cleanOutputs = result.outputs.map(
			({ kind, hero, aspectRatio, filePath, previewUrl, generatedAt }) => ({
				kind,
				hero,
				aspectRatio,
				filePath,
				previewUrl,
				generatedAt,
			}),
		);

		res.status(200).json({
			campaignId: result.campaignId,
			outputs: cleanOutputs,
			generatedAt: result.generatedAt,
			errors: result.errors ?? [],
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Unknown error';
		if (msg.includes('not found')) {
			return res.status(404).json(errorResponse('NOT_FOUND', msg));
		}
		if (msg.includes('No assets found')) {
			return res.status(400).json(errorResponse('VALIDATION_ERROR', msg));
		}
		res.status(500).json(errorResponse('SERVER_ERROR', msg));
	}
});

// POST /api/campaigns/:campaignId/generate-video - Start async video generation
app.post('/api/campaigns/:campaignId/generate-video', async (req, res) => {
	try {
		const result = await videoGenerator.start(req.params.campaignId);
		res.status(202).json(result);
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Unknown error';
		if (msg.includes('not found')) {
			return res.status(404).json(errorResponse('NOT_FOUND', msg));
		}
		if (msg.includes('No assets found') || msg.includes('FAL_KEY')) {
			return res.status(400).json(errorResponse('VALIDATION_ERROR', msg));
		}
		res.status(500).json(errorResponse('VIDEO_GENERATION_ERROR', msg));
	}
});

// GET /api/campaigns/:campaignId/video-jobs/:jobId - Poll async video generation
app.get(
	'/api/campaigns/:campaignId/video-jobs/:jobId',
	async (req, res) => {
		try {
			const job = await videoGenerator.poll(req.params.jobId);
			if (!job || job.campaignId !== req.params.campaignId) {
				return res
					.status(404)
					.json(errorResponse('NOT_FOUND', 'Video job not found'));
			}
			res.status(200).json(job);
		} catch (error) {
			const msg = error instanceof Error ? error.message : 'Unknown error';
			res.status(500).json(errorResponse('VIDEO_GENERATION_ERROR', msg));
		}
	},
);

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});

export { app };

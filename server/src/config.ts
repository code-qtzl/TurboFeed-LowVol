// Environment configuration management

export const config = {
	server: {
		port: parseInt(process.env.PORT || '3001', 10),
		nodeEnv: process.env.NODE_ENV || 'development',
	},
	genai: {
		provider: process.env.GENAI_PROVIDER || 'openai',
		openaiApiKey: process.env.OPENAI_API_KEY || '',
		timeout: parseInt(process.env.GENAI_TIMEOUT || '30000', 10),
		maxRetries: parseInt(process.env.GENAI_MAX_RETRIES || '2', 10),
	},
	fal: {
		apiKey: process.env.FAL_KEY || '',
		videoEndpoint:
			process.env.FAL_VIDEO_ENDPOINT ||
			'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
		imageEditEndpoint:
			process.env.FAL_IMAGE_EDIT_ENDPOINT || 'fal-ai/flux-pro/kontext',
		vibePromptDir:
			process.env.VIBE_PROMPT_DIR ||
			'../.github/workflows/time-of-day',
	},
	storage: {
		outputDir: process.env.OUTPUT_DIR || 'outputs',
	},
	assets: {
		maxSize: parseInt(process.env.MAX_ASSET_SIZE || '10485760', 10),
		minDimension: parseInt(process.env.MIN_IMAGE_DIMENSION || '800', 10),
		supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
	},
};

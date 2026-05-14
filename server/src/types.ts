// Core data models for Creative Automation platform

export interface CampaignBrief {
	hero: string;
	targetRegion: string;
	targetAudience: string;
	campaignMessage: string;
}

export interface Campaign {
	id: string;
	brief: CampaignBrief;
	createdAt: Date;
	status: 'draft' | 'generating' | 'completed' | 'failed';
	outputs: CampaignOutput[];
	errorMessage?: string;
}

export interface CampaignOutput {
	kind: 'image' | 'video';
	hero: string;
	aspectRatio: '1:1' | '9:16' | '16:9';
	filePath: string;
	previewUrl?: string;
	lightingPreset?: VideoLightingPreset;
	providerJobId?: string;
	generatedAt: Date;
}

export type VideoLightingPreset = 'golden_hour' | 'afternoon' | 'dusk';

export type VideoJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface VideoGenerationJob {
	id: string;
	campaignId: string;
	status: VideoJobStatus;
	totalJobs: number;
	completedJobs: number;
	failedJobs: number;
	outputs: CampaignOutput[];
	errors: string[];
	createdAt: Date;
	updatedAt: Date;
}

export interface Asset {
	id: string;
	campaignId: string;
	fileName: string;
	mimeType: string;
	buffer: Buffer;
	uploadedAt: Date;
	metadata: {
		width: number;
		height: number;
		size: number;
	};
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

export interface ErrorResponse {
	error: {
		code: ErrorCode;
		message: string;
		details?: Record<string, unknown>;
		timestamp: string;
	};
}

export type ErrorCode =
	| 'VALIDATION_ERROR'
	| 'NOT_FOUND'
	| 'PROCESSING_ERROR'
	| 'GENAI_ERROR'
	| 'VIDEO_GENERATION_ERROR'
	| 'SERVER_ERROR';

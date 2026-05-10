export interface CampaignBrief {
	hero: string;
	targetRegion: string;
	targetAudience: string;
	campaignMessage: string;
}

export interface CampaignOutput {
	kind: 'image' | 'video';
	hero: string;
	aspectRatio: string;
	filePath: string;
	previewUrl?: string;
	lightingPreset?: 'golden_hour' | 'afternoon' | 'dusk';
	providerJobId?: string;
	generatedAt: string;
}

export interface Campaign {
	id: string;
	brief: CampaignBrief;
	createdAt: string;
	status: string;
	outputs: CampaignOutput[];
}

export interface AssetMeta {
	id: string;
	campaignId: string;
	fileName: string;
	mimeType: string;
	uploadedAt: string;
	metadata: { width: number; height: number; size: number };
}

export interface GenerationResult {
	campaignId: string;
	outputs: CampaignOutput[];
	generatedAt: string;
	errors: string[];
}

export interface VideoGenerationStartResult {
	jobId: string;
	campaignId: string;
	status: string;
	totalJobs: number;
}

export interface VideoGenerationJob {
	id: string;
	campaignId: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	totalJobs: number;
	completedJobs: number;
	failedJobs: number;
	outputs: CampaignOutput[];
	errors: string[];
	createdAt: string;
	updatedAt: string;
}

export type Step = 'create' | 'upload' | 'generate' | 'review';

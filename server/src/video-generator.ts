import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CampaignManager } from './campaign-manager';
import { AssetManager } from './asset-manager';
import {
	FalVideoService,
	VIDEO_LIGHTING_PRESETS,
} from './fal-video-service';
import { ImageRelightingService } from './image-relighting-service';
import { ASPECT_RATIOS } from './image-processor';
import {
	CampaignOutput,
	VideoGenerationJob,
	VideoJobStatus,
	VideoLightingPreset,
} from './types';
import { config } from './config';
import { normalizeVideoAspectRatio } from './video-processor';

interface ProviderVideoJob {
	requestId: string;
	hero: string;
	aspectRatio: '1:1' | '9:16' | '16:9';
	lightingPreset: VideoLightingPreset;
	status: VideoJobStatus;
	filePath?: string;
	previewUrl?: string;
	error?: string;
}

interface InternalVideoGenerationJob extends VideoGenerationJob {
	providerJobs: ProviderVideoJob[];
	persisted: boolean;
	campaignMessage: string;
}

export interface VideoGenerationStartResult {
	jobId: string;
	campaignId: string;
	status: VideoJobStatus;
	totalJobs: number;
}

const videoJobs: Map<string, InternalVideoGenerationJob> = new Map();

export class VideoGenerator {
	constructor(
		private readonly campaignManager: CampaignManager,
		private readonly assetManager: AssetManager,
		private readonly falVideoService: FalVideoService,
		private readonly imageRelightingService: ImageRelightingService,
		private readonly normalizeVideo = normalizeVideoAspectRatio,
	) {}

	sanitizeHeroName(name: string): string {
		return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
	}

	formatAspectRatioDir(ratio: string): string {
		return ratio.replace(/:/g, '-');
	}

	async start(campaignId: string): Promise<VideoGenerationStartResult> {
		const campaign = await this.campaignManager.getCampaign(campaignId);
		if (!campaign) {
			throw new Error(`Campaign ${campaignId} not found`);
		}

		const assets = await this.assetManager.getAssetsByCampaign(campaignId);
		if (assets.length === 0) {
			throw new Error(
				`No assets found for campaign ${campaignId}; video generation requires at least one uploaded image`,
			);
		}

		const primaryAsset = assets[0];
		const sourceImageUrl = await this.falVideoService.uploadImage(
			primaryAsset.buffer,
			primaryAsset.mimeType,
		);

		const hero = campaign.brief.hero;

		await this.campaignManager.updateCampaignStatus(
			campaignId,
			'generating',
		);

		const themedStills = await Promise.all(
			VIDEO_LIGHTING_PRESETS.map(async (lightingPreset) => {
				const relit = await this.imageRelightingService.relight({
					imageUrl: sourceImageUrl,
					lightingPreset,
				});
				await this.saveSourceStill(
					campaignId,
					hero,
					lightingPreset,
					relit.imageBuffer,
				);
				const themedImageUrl = await this.falVideoService.uploadImage(
					relit.imageBuffer,
					'image/jpeg',
				);
				return { lightingPreset, themedImageUrl };
			}),
		);

		const prompt = this.falVideoService.constructPrompt(campaign.brief, hero);
		const providerJobs: ProviderVideoJob[] = [];

		for (const { lightingPreset, themedImageUrl } of themedStills) {
			for (const aspectRatio of ASPECT_RATIOS) {
				const requestId = await this.falVideoService.submitVideo({
					prompt,
					imageUrl: themedImageUrl,
					referenceImageUrls: [themedImageUrl],
					aspectRatio: aspectRatio.ratio,
				});

				providerJobs.push({
					requestId,
					hero,
					aspectRatio: aspectRatio.ratio,
					lightingPreset,
					status: 'pending',
				});
			}
		}

		const jobId = uuidv4();
		const now = new Date();
		const job: InternalVideoGenerationJob = {
			id: jobId,
			campaignId,
			status: 'pending',
			totalJobs: providerJobs.length,
			completedJobs: 0,
			failedJobs: 0,
			outputs: [],
			errors: [],
			createdAt: now,
			updatedAt: now,
			providerJobs,
			persisted: false,
			campaignMessage: campaign.brief.campaignMessage,
		};
		videoJobs.set(jobId, job);

		return {
			jobId,
			campaignId,
			status: job.status,
			totalJobs: job.totalJobs,
		};
	}

	async poll(jobId: string): Promise<VideoGenerationJob | null> {
		const job = videoJobs.get(jobId);
		if (!job) {
			return null;
		}

		for (const providerJob of job.providerJobs) {
			if (
				providerJob.status === 'completed' ||
				providerJob.status === 'failed'
			) {
				continue;
			}

			try {
				const status = await this.falVideoService.getStatus(
					providerJob.requestId,
				);
				if (status.status === 'COMPLETED') {
					await this.completeProviderJob(job, providerJob);
				} else {
					providerJob.status = 'running';
				}
			} catch (error) {
				providerJob.status = 'failed';
				providerJob.error =
					error instanceof Error ? error.message : String(error);
				job.errors.push(
					`Video job ${providerJob.requestId} failed: ${providerJob.error}`,
				);
			}
		}

		this.refreshAggregateStatus(job);
		await this.persistCompletedCampaign(job);
		return this.toPublicJob(job);
	}

	private async completeProviderJob(
		job: InternalVideoGenerationJob,
		providerJob: ProviderVideoJob,
	): Promise<void> {
		const result = await this.falVideoService.getResult(
			providerJob.requestId,
		);
		const videoBuffer = await this.falVideoService.downloadVideo(
			result.videoUrl,
		);
		const normalizedVideoBuffer = await this.normalizeVideo(
			videoBuffer,
			providerJob.aspectRatio,
			job.campaignMessage,
		);
		const filePath = await this.saveVideoOutput(
			job.campaignId,
			providerJob.hero,
			providerJob.lightingPreset,
			providerJob.aspectRatio,
			normalizedVideoBuffer,
		);
		const previewUrl = this.toPreviewUrl(filePath);

		providerJob.status = 'completed';
		providerJob.filePath = filePath;
		providerJob.previewUrl = previewUrl;

		const output: CampaignOutput = {
			kind: 'video',
			hero: providerJob.hero,
			aspectRatio: providerJob.aspectRatio,
			lightingPreset: providerJob.lightingPreset,
			providerJobId: providerJob.requestId,
			filePath,
			previewUrl,
			generatedAt: new Date(),
		};
		job.outputs.push(output);
	}

	private async saveSourceStill(
		campaignId: string,
		hero: string,
		lightingPreset: VideoLightingPreset,
		buffer: Buffer,
	): Promise<string> {
		const dirPath = path.join(
			config.storage.outputDir,
			campaignId,
			this.sanitizeHeroName(hero),
			lightingPreset,
		);
		await fs.mkdir(dirPath, { recursive: true });
		const filePath = path.join(dirPath, 'source.jpg');
		await fs.writeFile(filePath, buffer);
		return filePath;
	}

	private async saveVideoOutput(
		campaignId: string,
		hero: string,
		lightingPreset: VideoLightingPreset,
		aspectRatio: string,
		buffer: Buffer,
	): Promise<string> {
		const dirPath = path.join(
			config.storage.outputDir,
			campaignId,
			this.sanitizeHeroName(hero),
			lightingPreset,
			this.formatAspectRatioDir(aspectRatio),
		);
		await fs.mkdir(dirPath, { recursive: true });
		const filePath = path.join(dirPath, 'creative.mp4');
		await fs.writeFile(filePath, buffer);
		return filePath;
	}

	private toPreviewUrl(filePath: string): string {
		const relativePath = path.relative(config.storage.outputDir, filePath);
		return `/outputs/${relativePath.split(path.sep).join('/')}`;
	}

	private refreshAggregateStatus(job: InternalVideoGenerationJob): void {
		job.completedJobs = job.providerJobs.filter(
			(providerJob) => providerJob.status === 'completed',
		).length;
		job.failedJobs = job.providerJobs.filter(
			(providerJob) => providerJob.status === 'failed',
		).length;

		if (job.completedJobs === job.totalJobs) {
			job.status = 'completed';
		} else if (job.completedJobs + job.failedJobs === job.totalJobs) {
			job.status = job.completedJobs > 0 ? 'completed' : 'failed';
		} else if (
			job.providerJobs.some((providerJob) => providerJob.status === 'running')
		) {
			job.status = 'running';
		}

		job.updatedAt = new Date();
	}

	private async persistCompletedCampaign(
		job: InternalVideoGenerationJob,
	): Promise<void> {
		if (
			job.persisted ||
			job.completedJobs + job.failedJobs !== job.totalJobs ||
			job.outputs.length === 0
		) {
			return;
		}

		try {
			await this.campaignManager.addOutputs(job.campaignId, job.outputs);
			await this.campaignManager.updateCampaignStatus(
				job.campaignId,
				job.failedJobs > 0 ? 'failed' : 'completed',
			);
			job.persisted = true;
		} catch {
			// Polling should still return the video outputs if campaign persistence fails.
		}
	}

	private toPublicJob(job: InternalVideoGenerationJob): VideoGenerationJob {
		return {
			id: job.id,
			campaignId: job.campaignId,
			status: job.status,
			totalJobs: job.totalJobs,
			completedJobs: job.completedJobs,
			failedJobs: job.failedJobs,
			outputs: job.outputs,
			errors: job.errors,
			createdAt: job.createdAt,
			updatedAt: job.updatedAt,
		};
	}
}

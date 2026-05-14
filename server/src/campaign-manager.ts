import { v4 as uuidv4 } from 'uuid';
import {
	Campaign,
	CampaignBrief,
	CampaignOutput,
	ValidationResult,
} from './types';

// In-memory storage for campaigns
const campaigns: Map<string, Campaign> = new Map();

/**
 * Validates a campaign brief against requirements
 */
export function validateCampaignBrief(
	brief: Record<string, unknown>,
): ValidationResult {
	const errors: string[] = [];

	if (typeof brief.hero !== 'string') {
		errors.push('hero is required and must be a string');
	} else if (brief.hero.trim() === '') {
		errors.push('hero must be a non-empty string');
	}

	if (!brief.targetRegion || typeof brief.targetRegion !== 'string') {
		errors.push('targetRegion is required and must be a string');
	} else if (brief.targetRegion.trim() === '') {
		errors.push('targetRegion must be a non-empty string');
	}

	if (!brief.targetAudience || typeof brief.targetAudience !== 'string') {
		errors.push('targetAudience is required and must be a string');
	} else if (brief.targetAudience.trim() === '') {
		errors.push('targetAudience must be a non-empty string');
	}

	if (!brief.campaignMessage || typeof brief.campaignMessage !== 'string') {
		errors.push('campaignMessage is required and must be a string');
	} else if (brief.campaignMessage.trim() === '') {
		errors.push('campaignMessage must be a non-empty string');
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Campaign_Manager class for managing campaign lifecycle
 */
export class CampaignManager {
	/**
	 * Creates a new campaign from a validated brief
	 */
	async createCampaign(brief: CampaignBrief): Promise<Campaign> {
		const campaign: Campaign = {
			id: uuidv4(),
			brief,
			createdAt: new Date(),
			status: 'draft',
			outputs: [],
		};

		campaigns.set(campaign.id, campaign);
		return campaign;
	}

	/**
	 * Retrieves a campaign by ID
	 */
	async getCampaign(id: string): Promise<Campaign | null> {
		return campaigns.get(id) || null;
	}

	/**
	 * Updates the status of a campaign
	 */
	async updateCampaignStatus(
		id: string,
		status: Campaign['status'],
	): Promise<void> {
		const campaign = campaigns.get(id);
		if (!campaign) {
			throw new Error(`Campaign ${id} not found`);
		}
		campaign.status = status;
	}

	/**
	 * Adds generated outputs to a campaign
	 */
	async addOutputs(id: string, outputs: CampaignOutput[]): Promise<void> {
		const campaign = campaigns.get(id);
		if (!campaign) {
			throw new Error(`Campaign ${id} not found`);
		}
		campaign.outputs.push(...outputs);
	}
}

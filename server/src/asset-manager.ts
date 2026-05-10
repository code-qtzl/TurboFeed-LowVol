import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { Asset, ValidationResult } from './types';

// In-memory storage for assets
const assets: Map<string, Asset> = new Map();
const assetsByCampaign: Map<string, string[]> = new Map();

// Validation constants
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_IMAGE_DIMENSION = 800;

/**
 * Asset_Manager handles upload, storage, and retrieval of campaign assets
 */
export class AssetManager {
	/**
	 * Upload an asset for a campaign
	 * @param campaignId - The campaign identifier
	 * @param file - The uploaded file (Express.Multer.File format)
	 * @returns Promise resolving to the created Asset
	 * @throws Error if validation fails
	 */
	async uploadAsset(
		campaignId: string,
		file: Express.Multer.File,
	): Promise<Asset> {
		// Validate the file
		const validation = await this.validateAsset(file);
		if (!validation.valid) {
			throw new Error(validation.errors.join(', '));
		}

		// Extract image metadata using Sharp
		const metadata = await sharp(file.buffer).metadata();

		// Create asset object
		const asset: Asset = {
			id: uuidv4(),
			campaignId,
			fileName: file.originalname,
			mimeType: file.mimetype,
			buffer: file.buffer,
			uploadedAt: new Date(),
			metadata: {
				width: metadata.width || 0,
				height: metadata.height || 0,
				size: file.size,
			},
		};

		// Store in memory
		assets.set(asset.id, asset);

		// Update campaign association
		const campaignAssets = assetsByCampaign.get(campaignId) || [];
		campaignAssets.push(asset.id);
		assetsByCampaign.set(campaignId, campaignAssets);

		return asset;
	}

	/**
	 * Retrieve an asset by its ID
	 * @param assetId - The asset identifier
	 * @returns Promise resolving to the Asset or null if not found
	 */
	async getAsset(assetId: string): Promise<Asset | null> {
		return assets.get(assetId) || null;
	}

	/**
	 * Retrieve all assets for a campaign
	 * @param campaignId - The campaign identifier
	 * @returns Promise resolving to array of Assets
	 */
	async getAssetsByCampaign(campaignId: string): Promise<Asset[]> {
		const assetIds = assetsByCampaign.get(campaignId) || [];
		const campaignAssets: Asset[] = [];

		for (const assetId of assetIds) {
			const asset = assets.get(assetId);
			if (asset) {
				campaignAssets.push(asset);
			}
		}

		return campaignAssets;
	}

	/**
	 * Validate an uploaded asset
	 * @param file - The uploaded file
	 * @returns Promise resolving to ValidationResult
	 */
	private async validateAsset(
		file: Express.Multer.File,
	): Promise<ValidationResult> {
		const errors: string[] = [];

		// Validate MIME type
		if (!SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
			errors.push(
				`Unsupported file type: ${file.mimetype}. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`,
			);
		}

		// Validate file size
		if (file.size > MAX_FILE_SIZE) {
			errors.push(
				`File too large: ${file.size} bytes (max: ${MAX_FILE_SIZE} bytes)`,
			);
		}

		// Validate image dimensions using Sharp
		try {
			const metadata = await sharp(file.buffer).metadata();

			if (!metadata.width || !metadata.height) {
				errors.push('Unable to determine image dimensions');
			} else if (
				metadata.width < MIN_IMAGE_DIMENSION ||
				metadata.height < MIN_IMAGE_DIMENSION
			) {
				errors.push(
					`Image dimensions too small: ${metadata.width}x${metadata.height} (minimum: ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION})`,
				);
			}
		} catch (error) {
			errors.push(
				`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}
}

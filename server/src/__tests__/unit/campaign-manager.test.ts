import { validateCampaignBrief } from '../../campaign-manager';

describe('validateCampaignBrief', () => {
	it('accepts a brief with a hero string', () => {
		const validation = validateCampaignBrief({
			hero: 'Hero Subject',
			targetRegion: 'North America',
			targetAudience: 'Home buyers',
			campaignMessage: 'See the light',
		});

		expect(validation.valid).toBe(true);
		expect(validation.errors).toHaveLength(0);
	});

	it('rejects a missing hero field', () => {
		const validation = validateCampaignBrief({
			targetRegion: 'North America',
			targetAudience: 'Home buyers',
			campaignMessage: 'See the light',
		});

		expect(validation.valid).toBe(false);
		expect(validation.errors).toContain(
			'hero is required and must be a string',
		);
	});

	it('rejects an empty-string hero', () => {
		const validation = validateCampaignBrief({
			hero: '   ',
			targetRegion: 'North America',
			targetAudience: 'Home buyers',
			campaignMessage: 'See the light',
		});

		expect(validation.valid).toBe(false);
		expect(validation.errors).toContain(
			'hero must be a non-empty string',
		);
	});
});

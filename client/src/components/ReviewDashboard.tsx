import { useState } from 'react';
import { API_BASE } from '../api/config';
import type { Campaign, CampaignOutput } from '../types';

interface ReviewDashboardProps {
	campaignId: string;
	campaign: Campaign | null;
	setCampaign: (c: Campaign | null) => void;
	setCampaignId: (id: string) => void;
}

export function ReviewDashboard({
	campaignId,
	campaign,
	setCampaign,
	setCampaignId,
}: ReviewDashboardProps) {
	const [lookupId, setLookupId] = useState(campaignId);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const fetchCampaign = async (id: string) => {
		if (!id.trim()) {
			setError('Please enter a campaign ID.');
			return;
		}
		setError('');
		setLoading(true);
		try {
			const res = await fetch(`${API_BASE}/api/campaigns/${id.trim()}`);
			const data = await res.json();
			if (!res.ok) {
				setError(data.error?.message || 'Campaign not found');
				setCampaign(null);
				return;
			}
			setCampaign(data);
			setCampaignId(data.id);
		} catch {
			setError('Network error. Is the server running?');
		} finally {
			setLoading(false);
		}
	};

	const groupedOutputs: Record<string, CampaignOutput[]> = {};
	if (campaign?.outputs) {
		for (const o of campaign.outputs) {
			if (!groupedOutputs[o.hero]) groupedOutputs[o.hero] = [];
			groupedOutputs[o.hero].push(o);
		}
	}

	return (
		<div className='card'>
			<h2>Campaign Review</h2>

			<div className='lookup-row'>
				<input
					type='text'
					placeholder='Enter campaign ID'
					value={lookupId}
					onChange={(e) => setLookupId(e.target.value)}
				/>
				<button onClick={() => fetchCampaign(lookupId)} disabled={loading}>
					{loading ? 'Loading...' : 'Look Up'}
				</button>
			</div>

			{error && <p className='error-msg'>{error}</p>}

			{campaign && (
				<div>
					<div className='info-row'>
						<span>
							<strong>ID:</strong> {campaign.id}
						</span>
						<span>
							<strong>Status:</strong>{' '}
							<span className={`status-badge ${campaign.status}`}>{campaign.status}</span>
						</span>
						<span>
							<strong>Created:</strong> {new Date(campaign.createdAt).toLocaleString()}
						</span>
					</div>

					<div className='section'>
						<h3>Brief</h3>
						<p>
							<strong>Hero:</strong> {campaign.brief.hero}
						</p>
						<p>
							<strong>Region:</strong> {campaign.brief.targetRegion}
						</p>
						<p>
							<strong>Audience:</strong> {campaign.brief.targetAudience}
						</p>
						<p>
							<strong>Message:</strong> {campaign.brief.campaignMessage}
						</p>
					</div>

					{campaign.outputs && campaign.outputs.length > 0 && (
						<div className='section'>
							<h3>Generated Outputs</h3>
							{Object.entries(groupedOutputs).map(([product, outputs]) => (
								<div className='output-group' key={product}>
									<h3>{product}</h3>
									<div className='output-list'>
										{outputs.map((o, i) => (
											<div className='output-item' key={i}>
												<strong>{o.aspectRatio}</strong>
												{o.lightingPreset && <> · {o.lightingPreset}</>}
												<br />
												{o.kind === 'video' && o.previewUrl && (
													<video
														className='video-preview'
														src={`${API_BASE}${o.previewUrl}`}
														controls
													/>
												)}
												<code>{o.filePath}</code>
												<br />
												<span style={{ fontSize: 12, color: '#999' }}>
													{new Date(o.generatedAt).toLocaleString()}
												</span>
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					)}

					{(!campaign.outputs || campaign.outputs.length === 0) && (
						<p style={{ color: '#777', fontStyle: 'italic' }}>No outputs generated yet.</p>
					)}
				</div>
			)}
		</div>
	);
}

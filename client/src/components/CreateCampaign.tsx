import { useState } from 'react';
import { API_BASE } from '../api/config';
import type { Campaign, CampaignBrief } from '../types';

interface CreateCampaignProps {
	onCreated: (c: Campaign) => void;
}

export function CreateCampaign({ onCreated }: CreateCampaignProps) {
	const [hero, setHero] = useState('');
	const [targetRegion, setTargetRegion] = useState('');
	const [targetAudience, setTargetAudience] = useState('');
	const [campaignMessage, setCampaignMessage] = useState('');
	const [error, setError] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [success, setSuccess] = useState<{
		id: string;
		createdAt: string;
	} | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setSuccess(null);

		const trimmedHero = hero.trim();
		if (!trimmedHero) {
			setError('Hero is required.');
			return;
		}
		if (!targetRegion.trim()) {
			setError('Target region is required.');
			return;
		}
		if (!targetAudience.trim()) {
			setError('Target audience is required.');
			return;
		}
		if (!campaignMessage.trim()) {
			setError('Campaign message is required.');
			return;
		}

		const brief: CampaignBrief = {
			hero: trimmedHero,
			targetRegion: targetRegion.trim(),
			targetAudience: targetAudience.trim(),
			campaignMessage: campaignMessage.trim(),
		};

		setSubmitting(true);
		try {
			const res = await fetch(`${API_BASE}/api/campaigns`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(brief),
			});
			const data = await res.json();
			if (!res.ok) {
				setError(data.error?.message || 'Failed to create campaign');
				return;
			}
			setSuccess({ id: data.id, createdAt: data.createdAt });
			onCreated(data);
		} catch {
			setError('Network error. Is the server running?');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className='card'>
			<h2>Create Campaign Brief</h2>
			<form onSubmit={handleSubmit}>
				<label>Hero</label>
				<input
					type='text'
					placeholder='e.g. Hero Product'
					value={hero}
					onChange={(e) => setHero(e.target.value)}
				/>

				<label>Target Region</label>
				<input
					type='text'
					placeholder='e.g. North America'
					value={targetRegion}
					onChange={(e) => setTargetRegion(e.target.value)}
				/>

				<label>Target Audience</label>
				<input
					type='text'
					placeholder='e.g. Young professionals aged 25-35'
					value={targetAudience}
					onChange={(e) => setTargetAudience(e.target.value)}
				/>

				<label>Campaign Message</label>
				<textarea
					placeholder='e.g. Discover the difference'
					value={campaignMessage}
					onChange={(e) => setCampaignMessage(e.target.value)}
				/>

				{error && <p className='error-msg'>{error}</p>}
				{success && (
					<div className='success-msg'>
						Campaign created! ID: <strong>{success.id}</strong>
						<br />
						Created at:{' '}
						{new Date(success.createdAt).toLocaleString()}
					</div>
				)}

				<button type='submit' disabled={submitting}>
					{submitting ? 'Creating...' : 'Create Campaign'}
				</button>
			</form>
		</div>
	);
}

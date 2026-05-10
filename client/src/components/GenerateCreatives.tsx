import { useState } from 'react';
import { API_BASE } from '../api/config';
import type {
	Campaign,
	GenerationResult,
	VideoGenerationJob,
	VideoGenerationStartResult,
} from '../types';

interface GenerateCreativesProps {
	campaignId: string;
	campaign: Campaign | null;
	onDone: (result: GenerationResult) => void;
}

interface ApiErrorResponse {
	error?: {
		message?: string;
	};
}

export function GenerateCreatives({
	campaignId,
	onDone,
}: GenerateCreativesProps) {
	const [generating, setGenerating] = useState(false);
	const [result, setResult] = useState<GenerationResult | null>(null);
	const [videoJob, setVideoJob] = useState<VideoGenerationJob | null>(null);
	const [error, setError] = useState('');
	const [useGenAI, setUseGenAI] = useState(false);
	const [mode, setMode] = useState<'image' | 'video'>('image');

	const handleGenerate = async () => {
		setError('');
		setResult(null);
		setVideoJob(null);
		setGenerating(true);

		try {
			if (mode === 'video') {
				await handleGenerateVideo();
				return;
			}

			const res = await fetch(
				`${API_BASE}/api/campaigns/${campaignId}/generate`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ useGenAI }),
				},
			);
			const data = await res.json();
			if (!res.ok) {
				setError(data.error?.message || 'Generation failed');
				return;
			}
			setResult(data);
			onDone(data);
		} catch {
			setError('Network error. Is the server running?');
		} finally {
			setGenerating(false);
		}
	};

	const handleGenerateVideo = async () => {
		const startRes = await fetch(
			`${API_BASE}/api/campaigns/${campaignId}/generate-video`,
			{ method: 'POST' },
		);
		const startData = (await startRes.json()) as
			| VideoGenerationStartResult
			| ApiErrorResponse;
		if (!startRes.ok) {
			setError(startData.error?.message || 'Video generation failed');
			return;
		}

		let currentJob: VideoGenerationJob | null = null;
		while (!currentJob || ['pending', 'running'].includes(currentJob.status)) {
			await new Promise((resolve) => setTimeout(resolve, 5000));
			const pollRes = await fetch(
				`${API_BASE}/api/campaigns/${campaignId}/video-jobs/${startData.jobId}`,
			);
			const pollData = (await pollRes.json()) as
				| VideoGenerationJob
				| ApiErrorResponse;
			if (!pollRes.ok) {
				setError(pollData.error?.message || 'Video polling failed');
				return;
			}
			currentJob = pollData;
			setVideoJob(currentJob);
		}

		const finalResult: GenerationResult = {
			campaignId,
			outputs: currentJob.outputs,
			generatedAt: currentJob.updatedAt,
			errors: currentJob.errors,
		};
		setResult(finalResult);
		onDone(finalResult);
	};

	const progressPercent = videoJob
		? Math.round((videoJob.completedJobs / videoJob.totalJobs) * 100)
		: 0;

	return (
		<div className='card'>
			<h2>Generate Creatives</h2>
			<p>
				Campaign ID: <strong>{campaignId}</strong>
			</p>

			<div className='generate-options'>
				<label>
					<input
						type='radio'
						name='generation-mode'
						checked={mode === 'image'}
						onChange={() => setMode('image')}
					/>
					Image creatives
				</label>
				<label>
					<input
						type='radio'
						name='generation-mode'
						checked={mode === 'video'}
						onChange={() => setMode('video')}
					/>
					5s videos
				</label>
				<label>
					<input
						type='checkbox'
						checked={useGenAI}
						disabled={mode === 'video'}
						onChange={(e) => setUseGenAI(e.target.checked)}
					/>
					Use GenAI
				</label>
			</div>

			{mode === 'video' && (
				<p className='generation-note'>
					Video mode generates 9 outputs: golden hour, afternoon, and dusk
					across 1:1, 9:16, and 16:9.
				</p>
			)}

			<button onClick={handleGenerate} disabled={generating}>
				{generating
					? 'Generating...'
					: mode === 'video'
						? 'Generate Videos'
						: 'Generate Creatives'}
			</button>

			{generating && (
				<div style={{ marginTop: 12 }}>
					<span className='status-badge generating'>generating</span>
					<div className='progress-bar-container'>
						<div
							className='progress-bar'
							style={{
								width:
									mode === 'video'
										? `${Math.max(progressPercent, 5)}%`
										: '100%',
								animation: 'none',
							}}
						/>
					</div>
					{videoJob && (
						<p className='generation-note'>
							{videoJob.completedJobs} of {videoJob.totalJobs} videos
							complete
						</p>
					)}
				</div>
			)}

			{error && <p className='error-msg'>{error}</p>}

			{result && (
				<div className='section' style={{ marginTop: 16 }}>
					<h3>Generation Results</h3>
					<p>
						Generated at:{' '}
						{new Date(result.generatedAt).toLocaleString()}
					</p>
					<p>Total outputs: {result.outputs.length}</p>

					<div className='output-list'>
						{result.outputs.map((o, i) => (
							<div className='output-item' key={i}>
								<strong>{o.hero}</strong> — {o.aspectRatio}
								{o.lightingPreset && <> — {o.lightingPreset}</>}
								<br />
								{o.kind === 'video' && o.previewUrl && (
									<video
										className='video-preview'
										src={`${API_BASE}${o.previewUrl}`}
										controls
									/>
								)}
								<code>{o.filePath}</code>
							</div>
						))}
					</div>

					{result.errors && result.errors.length > 0 && (
						<div className='error-list'>
							<h4>Errors</h4>
							<ul>
								{result.errors.map((e, i) => (
									<li key={i}>{e}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

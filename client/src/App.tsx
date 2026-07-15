import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { API_BASE } from './api/config';
import type {
	AssetMeta,
	Campaign,
	CampaignBrief,
	CampaignOutput,
	GenerationResult,
} from './types';

type Ratio = '1:1' | '9:16' | '16:9';

interface RatioEditorState {
	text: string;
	x: number;
	y: number;
	fontSize: number;
	color: string;
	align: 'left' | 'center' | 'right';
}

interface VersionSnapshot {
	id: string;
	savedAt: string;
	name: string;
	state: RatioEditorState;
}

interface BriefTemplate {
	name: string;
	brief: CampaignBrief;
}

interface ApiErrorResponse {
	error?: {
		message?: string;
	};
}

const RATIOS: Ratio[] = ['1:1', '9:16', '16:9'];

const ratioDimensions: Record<Ratio, { width: number; height: number }> = {
	'1:1': { width: 640, height: 640 },
	'9:16': { width: 405, height: 720 },
	'16:9': { width: 720, height: 405 },
};

const briefTemplates: BriefTemplate[] = [
	{
		name: 'Product Launch',
		brief: {
			hero: 'Aurora Sparkling Water',
			targetRegion: 'United States',
			targetAudience: 'Health-conscious young professionals',
			campaignMessage: 'Refresh your focus with zero sugar sparkle.',
		},
	},
	{
		name: 'Local Promo',
		brief: {
			hero: 'Momma Mansion Bakery',
			targetRegion: 'Austin, Texas',
			targetAudience: 'Families looking for weekend treats',
			campaignMessage: 'Warm pastries made fresh every morning.',
		},
	},
	{
		name: 'Seasonal Push',
		brief: {
			hero: 'Trail Pro Jacket',
			targetRegion: 'Pacific Northwest',
			targetAudience: 'Outdoor enthusiasts aged 20-45',
			campaignMessage: 'Stay dry, move fast, and own every forecast.',
		},
	},
];

function toCanvasUrl(output: CampaignOutput): string {
	if (output.previewUrl) {
		return `${API_BASE}${output.previewUrl}`;
	}
	return `${API_BASE}/${output.filePath.replace(/^\/+/, '')}`;
}

function defaultRatioState(message: string): Record<Ratio, RatioEditorState> {
	return {
		'1:1': {
			text: message,
			x: 60,
			y: 72,
			fontSize: 42,
			color: '#ffffff',
			align: 'left',
		},
		'9:16': {
			text: message,
			x: 48,
			y: 88,
			fontSize: 40,
			color: '#ffffff',
			align: 'left',
		},
		'16:9': {
			text: message,
			x: 64,
			y: 64,
			fontSize: 44,
			color: '#ffffff',
			align: 'left',
		},
	};
}

function buildGateKey(campaignId: string): string {
	return `tf-editor-gate:${campaignId}`;
}

function storageDraftKey(campaignId: string): string {
	return `tf-editor-draft:${campaignId}`;
}

function storageVersionsKey(campaignId: string): string {
	return `tf-editor-versions:${campaignId}`;
}

// --- App ---

function App() {
	const [campaign, setCampaign] = useState<Campaign | null>(null);
	const [assets, setAssets] = useState<AssetMeta[]>([]);
	const [outputsByRatio, setOutputsByRatio] = useState<
		Partial<Record<Ratio, CampaignOutput>>
	>({});
	const [activeRatio, setActiveRatio] = useState<Ratio>('1:1');
	const [layoutByRatio, setLayoutByRatio] = useState<
		Record<Ratio, RatioEditorState>
	>(defaultRatioState(''));
	const [versionsByRatio, setVersionsByRatio] = useState<
		Record<Ratio, VersionSnapshot[]>
	>({
		'1:1': [],
		'9:16': [],
		'16:9': [],
	});
	const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
		'idle',
	);
	const [onboardingStep, setOnboardingStep] = useState<0 | 1 | 2>(0);
	const [showOnboarding, setShowOnboarding] = useState(true);
	const [brief, setBrief] = useState<CampaignBrief>({
		hero: '',
		targetRegion: '',
		targetAudience: '',
		campaignMessage: '',
	});
	const [useGenAI, setUseGenAI] = useState(false);
	const [creatingCampaign, setCreatingCampaign] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [generating, setGenerating] = useState(false);
	const [onboardingError, setOnboardingError] = useState('');
	const [generationResult, setGenerationResult] =
		useState<GenerationResult | null>(null);
	const [failedRatios, setFailedRatios] = useState<Ratio[]>([]);
	const [versionName, setVersionName] = useState('');
	const [copyFromRatio, setCopyFromRatio] = useState<Ratio>('1:1');

	const canvasRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLDivElement>(null);
	const saveTimeoutRef = useRef<number | null>(null);
	const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

	const campaignId = campaign?.id ?? '';
	const selectedOutput = outputsByRatio[activeRatio];
	const activeLayout = layoutByRatio[activeRatio];
	const dimension = ratioDimensions[activeRatio];

	const hasUnlockedCurrentCampaign = useMemo(() => {
		if (!campaignId) {
			return false;
		}
		return localStorage.getItem(buildGateKey(campaignId)) === 'done';
	}, [campaignId]);

	useEffect(() => {
		if (!campaignId) {
			setShowOnboarding(true);
			return;
		}
		setShowOnboarding(!hasUnlockedCurrentCampaign);
	}, [campaignId, hasUnlockedCurrentCampaign]);

	useEffect(() => {
		if (!campaignId) {
			return;
		}

		const rawDraft = localStorage.getItem(storageDraftKey(campaignId));
		if (rawDraft) {
			try {
				const parsed = JSON.parse(rawDraft) as {
					layoutByRatio: Record<Ratio, RatioEditorState>;
					brief: CampaignBrief;
				};
				setLayoutByRatio(parsed.layoutByRatio);
				setBrief(parsed.brief);
			} catch {
				// Ignore malformed local draft payloads.
			}
		}

		const rawVersions = localStorage.getItem(
			storageVersionsKey(campaignId),
		);
		if (rawVersions) {
			try {
				setVersionsByRatio(
					JSON.parse(rawVersions) as Record<Ratio, VersionSnapshot[]>,
				);
			} catch {
				// Ignore malformed local version payloads.
			}
		}
	}, [campaignId]);

	useEffect(() => {
		if (!campaignId || showOnboarding) {
			return;
		}

		setSaveStatus('saving');
		if (saveTimeoutRef.current) {
			window.clearTimeout(saveTimeoutRef.current);
		}
		saveTimeoutRef.current = window.setTimeout(() => {
			const payload = JSON.stringify({ layoutByRatio, brief });
			localStorage.setItem(storageDraftKey(campaignId), payload);
			localStorage.setItem(
				storageVersionsKey(campaignId),
				JSON.stringify(versionsByRatio),
			);
			setSaveStatus('saved');
		}, 700);

		return () => {
			if (saveTimeoutRef.current) {
				window.clearTimeout(saveTimeoutRef.current);
			}
		};
	}, [brief, campaignId, layoutByRatio, showOnboarding, versionsByRatio]);

	const updateBriefField = (field: keyof CampaignBrief, value: string) => {
		setBrief((prev) => ({ ...prev, [field]: value }));
	};

	const applyTemplate = (template: BriefTemplate) => {
		setBrief(template.brief);
		setLayoutByRatio(defaultRatioState(template.brief.campaignMessage));
	};

	const createCampaign = async (): Promise<Campaign | null> => {
		setOnboardingError('');
		if (
			!brief.hero.trim() ||
			!brief.targetAudience.trim() ||
			!brief.targetRegion.trim() ||
			!brief.campaignMessage.trim()
		) {
			setOnboardingError('Complete all brief fields before continuing.');
			return null;
		}

		setCreatingCampaign(true);
		try {
			const response = await fetch(`${API_BASE}/api/campaigns`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					hero: brief.hero.trim(),
					targetRegion: brief.targetRegion.trim(),
					targetAudience: brief.targetAudience.trim(),
					campaignMessage: brief.campaignMessage.trim(),
				}),
			});

			const payload = (await response.json()) as
				| Campaign
				| ApiErrorResponse;
			if (!response.ok) {
				setOnboardingError(
					payload.error?.message ?? 'Failed to create campaign.',
				);
				return null;
			}

			const nextCampaign = payload as Campaign;
			setCampaign(nextCampaign);
			setLayoutByRatio(
				defaultRatioState(nextCampaign.brief.campaignMessage),
			);
			return nextCampaign;
		} catch {
			setOnboardingError('Network error while creating campaign.');
			return null;
		} finally {
			setCreatingCampaign(false);
		}
	};

	const uploadFiles = async (files: FileList | File[]) => {
		if (!campaignId) {
			setOnboardingError('Create a campaign before uploading assets.');
			return;
		}

		setOnboardingError('');
		for (const file of Array.from(files)) {
			setUploading(true);
			setUploadProgress(0);
			const formData = new FormData();
			formData.append('file', file);

			try {
				const xhr = new XMLHttpRequest();
				xhr.open(
					'POST',
					`${API_BASE}/api/campaigns/${campaignId}/assets`,
				);
				xhr.upload.onprogress = (event) => {
					if (event.lengthComputable) {
						setUploadProgress(
							Math.round((event.loaded / event.total) * 100),
						);
					}
				};

				const asset = await new Promise<AssetMeta>(
					(resolve, reject) => {
						xhr.onload = () => {
							if (xhr.status === 201) {
								resolve(
									JSON.parse(xhr.responseText) as AssetMeta,
								);
								return;
							}
							const errorPayload = JSON.parse(
								xhr.responseText,
							) as ApiErrorResponse;
							reject(
								new Error(
									errorPayload.error?.message ??
										'Upload failed.',
								),
							);
						};
						xhr.onerror = () =>
							reject(new Error('Network error during upload.'));
						xhr.send(formData);
					},
				);

				setAssets((prev) => [...prev, asset]);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Upload failed.';
				setOnboardingError(message);
				break;
			} finally {
				setUploading(false);
			}
		}
	};

	const attemptGeneration = async () => {
		if (!campaignId) {
			setOnboardingError('Create a campaign first.');
			return;
		}

		setOnboardingError('');
		setGenerating(true);
		setGenerationResult(null);

		try {
			const response = await fetch(
				`${API_BASE}/api/campaigns/${campaignId}/generate`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ useGenAI }),
				},
			);

			const payload = (await response.json()) as
				| GenerationResult
				| ApiErrorResponse;

			if (!response.ok) {
				setOnboardingError(
					payload.error?.message ?? 'Generation failed.',
				);
				return;
			}

			const result = payload as GenerationResult;
			setGenerationResult(result);

			const mapped: Partial<Record<Ratio, CampaignOutput>> = {};
			for (const output of result.outputs) {
				if (output.kind !== 'image') {
					continue;
				}
				if (RATIOS.includes(output.aspectRatio as Ratio)) {
					mapped[output.aspectRatio as Ratio] = output;
				}
			}
			setOutputsByRatio(mapped);

			const missing = RATIOS.filter((ratio) => !mapped[ratio]);
			setFailedRatios(missing);

			if (result.outputs.length > 0) {
				localStorage.setItem(buildGateKey(campaignId), 'done');
				setShowOnboarding(false);
				setSaveStatus('saved');
			}
		} catch {
			setOnboardingError('Network error during generation.');
		} finally {
			setGenerating(false);
		}
	};

	const saveVersion = () => {
		const trimmedName = versionName.trim();
		if (!trimmedName) {
			return;
		}

		const nextSnapshot: VersionSnapshot = {
			id: crypto.randomUUID(),
			savedAt: new Date().toISOString(),
			name: trimmedName,
			state: layoutByRatio[activeRatio],
		};

		setVersionsByRatio((prev) => {
			const next = [nextSnapshot, ...prev[activeRatio]].slice(0, 50);
			return {
				...prev,
				[activeRatio]: next,
			};
		});
		setVersionName('');
	};

	const restoreVersion = (snapshot: VersionSnapshot) => {
		setLayoutByRatio((prev) => ({
			...prev,
			[activeRatio]: snapshot.state,
		}));
	};

	const onTextMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
		if (!canvasRef.current) {
			return;
		}
		const canvasRect = canvasRef.current.getBoundingClientRect();
		dragOffsetRef.current = {
			dx: event.clientX - canvasRect.left - activeLayout.x,
			dy: event.clientY - canvasRect.top - activeLayout.y,
		};
	};

	const onCanvasMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
		if (!canvasRef.current || !dragOffsetRef.current) {
			return;
		}

		const canvasRect = canvasRef.current.getBoundingClientRect();
		const maxX = Math.max(0, canvasRect.width - 160);
		const maxY = Math.max(0, canvasRect.height - 80);
		const nextX = Math.min(
			maxX,
			Math.max(
				0,
				event.clientX - canvasRect.left - dragOffsetRef.current.dx,
			),
		);
		const nextY = Math.min(
			maxY,
			Math.max(
				0,
				event.clientY - canvasRect.top - dragOffsetRef.current.dy,
			),
		);

		setLayoutByRatio((prev) => ({
			...prev,
			[activeRatio]: {
				...prev[activeRatio],
				x: nextX,
				y: nextY,
			},
		}));
	};

	const onCanvasMouseUp = () => {
		dragOffsetRef.current = null;
	};

	const onTextKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const moveBy = event.shiftKey ? 10 : 2;
		if (
			!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
				event.key,
			)
		) {
			return;
		}

		event.preventDefault();
		setLayoutByRatio((prev) => {
			const current = prev[activeRatio];
			if (event.key === 'ArrowUp') {
				return {
					...prev,
					[activeRatio]: {
						...current,
						y: Math.max(0, current.y - moveBy),
					},
				};
			}
			if (event.key === 'ArrowDown') {
				return {
					...prev,
					[activeRatio]: { ...current, y: current.y + moveBy },
				};
			}
			if (event.key === 'ArrowLeft') {
				return {
					...prev,
					[activeRatio]: {
						...current,
						x: Math.max(0, current.x - moveBy),
					},
				};
			}
			return {
				...prev,
				[activeRatio]: { ...current, x: current.x + moveBy },
			};
		});
	};

	const copyLayoutFrom = () => {
		if (copyFromRatio === activeRatio) {
			return;
		}
		setLayoutByRatio((prev) => ({
			...prev,
			[activeRatio]: prev[copyFromRatio],
		}));
	};

	return (
		<div className='editor-page'>
			<header className='topbar'>
				<div>
					<h1>TurboFeed Studio</h1>
					<p>Desktop creative editor for first-pass campaigns</p>
				</div>
				<div className='save-indicator' aria-live='polite'>
					{saveStatus === 'saving'
						? 'Saving draft...'
						: 'All changes saved'}
				</div>
			</header>

			<div className='workspace'>
				<aside className='sidebar'>
					<section>
						<h2>Campaign</h2>
						<p className='muted'>
							{campaignId
								? `ID ${campaignId}`
								: 'No campaign generated yet'}
						</p>
						<button
							type='button'
							className='secondary'
							onClick={() => {
								setShowOnboarding(true);
								setOnboardingStep(0);
								setOnboardingError('');
							}}
						>
							New Campaign
						</button>
					</section>

					<section>
						<h2>Message</h2>
						<textarea
							value={layoutByRatio[activeRatio].text}
							onChange={(event) => {
								const next = event.target.value;
								setLayoutByRatio((prev) => ({
									...prev,
									[activeRatio]: {
										...prev[activeRatio],
										text: next,
									},
								}));
							}}
						/>
						<label htmlFor='font-size'>Font Size</label>
						<input
							id='font-size'
							type='range'
							min={20}
							max={84}
							value={layoutByRatio[activeRatio].fontSize}
							onChange={(event) => {
								const size = Number(event.target.value);
								setLayoutByRatio((prev) => ({
									...prev,
									[activeRatio]: {
										...prev[activeRatio],
										fontSize: size,
									},
								}));
							}}
						/>
						<label htmlFor='color'>Text Color</label>
						<input
							id='color'
							type='color'
							value={layoutByRatio[activeRatio].color}
							onChange={(event) => {
								const nextColor = event.target.value;
								setLayoutByRatio((prev) => ({
									...prev,
									[activeRatio]: {
										...prev[activeRatio],
										color: nextColor,
									},
								}));
							}}
						/>
						<label htmlFor='align'>Alignment</label>
						<select
							id='align'
							value={layoutByRatio[activeRatio].align}
							onChange={(event) => {
								const nextAlign = event.target
									.value as RatioEditorState['align'];
								setLayoutByRatio((prev) => ({
									...prev,
									[activeRatio]: {
										...prev[activeRatio],
										align: nextAlign,
									},
								}));
							}}
						>
							<option value='left'>Left</option>
							<option value='center'>Center</option>
							<option value='right'>Right</option>
						</select>
					</section>

					<section>
						<h2>Copy Ratio State</h2>
						<select
							value={copyFromRatio}
							onChange={(event) =>
								setCopyFromRatio(event.target.value as Ratio)
							}
						>
							{RATIOS.map((ratio) => (
								<option key={ratio} value={ratio}>
									{ratio}
								</option>
							))}
						</select>
						<button
							type='button'
							className='secondary'
							onClick={copyLayoutFrom}
						>
							Copy to Active Ratio
						</button>
					</section>

					<section>
						<h2>Versions</h2>
						<div className='version-form'>
							<input
								type='text'
								placeholder='Version name'
								value={versionName}
								onChange={(event) =>
									setVersionName(event.target.value)
								}
							/>
							<button type='button' onClick={saveVersion}>
								Save Version
							</button>
						</div>
						<div className='version-list'>
							{versionsByRatio[activeRatio].length === 0 && (
								<p className='muted'>No versions saved yet.</p>
							)}
							{versionsByRatio[activeRatio].map((snapshot) => (
								<button
									type='button'
									key={snapshot.id}
									className='version-item'
									onClick={() => restoreVersion(snapshot)}
								>
									<strong>{snapshot.name}</strong>
									<span>
										{new Date(
											snapshot.savedAt,
										).toLocaleString()}
									</span>
								</button>
							))}
						</div>
					</section>
				</aside>

				<section className='editor-main'>
					<nav className='ratio-tabs' aria-label='Aspect ratio tabs'>
						{RATIOS.map((ratio) => (
							<button
								type='button'
								key={ratio}
								className={
									ratio === activeRatio ? 'active' : ''
								}
								onClick={() => setActiveRatio(ratio)}
							>
								{ratio}
							</button>
						))}
					</nav>

					<div className='canvas-wrapper'>
						{!selectedOutput && (
							<div className='empty-state'>
								<h3>No generated output in this ratio yet</h3>
								<p>
									Use onboarding generate or retry from the
									modal to unlock this ratio.
								</p>
							</div>
						)}
						<div
							ref={canvasRef}
							className='canvas'
							style={{
								width: `${dimension.width}px`,
								height: `${dimension.height}px`,
								backgroundImage: selectedOutput
									? `url(${toCanvasUrl(selectedOutput)})`
									: 'none',
							}}
							onMouseMove={onCanvasMouseMove}
							onMouseUp={onCanvasMouseUp}
							onMouseLeave={onCanvasMouseUp}
						>
							<div
								ref={textRef}
								className='canvas-text'
								tabIndex={0}
								onMouseDown={onTextMouseDown}
								onKeyDown={onTextKeyDown}
								style={{
									left: `${activeLayout.x}px`,
									top: `${activeLayout.y}px`,
									fontSize: `${activeLayout.fontSize}px`,
									color: activeLayout.color,
									textAlign: activeLayout.align,
								}}
							>
								{activeLayout.text ||
									'Edit message text in the sidebar'}
							</div>
						</div>
					</div>

					<div className='download-row'>
						<a
							className={`download-button${selectedOutput ? '' : ' disabled'}`}
							href={
								selectedOutput
									? toCanvasUrl(selectedOutput)
									: undefined
							}
							download={
								selectedOutput
									? `${campaign?.brief.hero}-${activeRatio}.jpg`
									: undefined
							}
						>
							Download {activeRatio}
						</a>
						<button
							type='button'
							className='secondary'
							onClick={() => {
								for (const ratio of RATIOS) {
									const output = outputsByRatio[ratio];
									if (!output) {
										continue;
									}
									window.open(
										toCanvasUrl(output),
										'_blank',
										'noopener,noreferrer',
									);
								}
							}}
						>
							Download All (multi-file)
						</button>
					</div>
				</section>
			</div>

			{showOnboarding && (
				<div className='onboarding-backdrop' role='presentation'>
					<section
						className='onboarding-modal'
						role='dialog'
						aria-modal='true'
						aria-labelledby='onboarding-title'
					>
						<header>
							<h2 id='onboarding-title'>
								Create your first campaign
							</h2>
							<p>
								Complete all steps to unlock the editor
								workspace.
							</p>
							<div className='onboarding-steps'>
								<span
									className={
										onboardingStep === 0 ? 'active' : ''
									}
								>
									Brief
								</span>
								<span
									className={
										onboardingStep === 1 ? 'active' : ''
									}
								>
									Upload Assets
								</span>
								<span
									className={
										onboardingStep === 2 ? 'active' : ''
									}
								>
									Generate
								</span>
							</div>
						</header>

						{onboardingStep === 0 && (
							<div className='onboarding-body'>
								<p className='muted'>Quick templates</p>
								<div className='template-grid'>
									{briefTemplates.map((template) => (
										<button
											type='button'
											key={template.name}
											className='secondary'
											onClick={() =>
												applyTemplate(template)
											}
										>
											{template.name}
										</button>
									))}
								</div>

								<label htmlFor='hero'>Hero</label>
								<input
									id='hero'
									type='text'
									value={brief.hero}
									onChange={(event) =>
										updateBriefField(
											'hero',
											event.target.value,
										)
									}
								/>
								<label htmlFor='region'>Target Region</label>
								<input
									id='region'
									type='text'
									value={brief.targetRegion}
									onChange={(event) =>
										updateBriefField(
											'targetRegion',
											event.target.value,
										)
									}
								/>
								<label htmlFor='audience'>
									Target Audience
								</label>
								<input
									id='audience'
									type='text'
									value={brief.targetAudience}
									onChange={(event) =>
										updateBriefField(
											'targetAudience',
											event.target.value,
										)
									}
								/>
								<label htmlFor='message'>
									Campaign Message
								</label>
								<textarea
									id='message'
									value={brief.campaignMessage}
									onChange={(event) =>
										updateBriefField(
											'campaignMessage',
											event.target.value,
										)
									}
								/>
								<button
									type='button'
									disabled={creatingCampaign}
									onClick={async () => {
										const created = await createCampaign();
										if (created) {
											setOnboardingStep(1);
										}
									}}
								>
									{creatingCampaign
										? 'Creating...'
										: 'Continue to Upload'}
								</button>
							</div>
						)}

						{onboardingStep === 1 && (
							<div className='onboarding-body'>
								<p>
									Upload one or more reference images, or
									continue with GenAI in the next step.
								</p>
								<input
									type='file'
									multiple
									accept='image/jpeg,image/png,image/webp'
									onChange={(event) => {
										if (event.target.files) {
											uploadFiles(event.target.files);
										}
										event.target.value = '';
									}}
								/>
								{uploading && (
									<div className='progress'>
										<div
											style={{
												width: `${uploadProgress}%`,
											}}
										/>
									</div>
								)}
								<ul className='asset-list'>
									{assets.map((asset) => (
										<li key={asset.id}>
											{asset.fileName} (
											{asset.metadata.width}x
											{asset.metadata.height})
										</li>
									))}
								</ul>
								<div className='modal-row'>
									<button
										type='button'
										className='secondary'
										onClick={() => setOnboardingStep(0)}
									>
										Back
									</button>
									<button
										type='button'
										onClick={() => setOnboardingStep(2)}
									>
										Continue to Generate
									</button>
								</div>
							</div>
						)}

						{onboardingStep === 2 && (
							<div className='onboarding-body'>
								<label className='checkbox-row'>
									<input
										type='checkbox'
										checked={useGenAI}
										onChange={(event) =>
											setUseGenAI(event.target.checked)
										}
									/>
									Use GenAI fallback if no assets are uploaded
								</label>
								<button
									type='button'
									disabled={generating}
									onClick={attemptGeneration}
								>
									{generating
										? 'Generating...'
										: 'Generate Initial Outputs'}
								</button>
								{generationResult && (
									<div className='result-box'>
										<p>
											Generated{' '}
											{generationResult.outputs.length}{' '}
											outputs at{' '}
											{new Date(
												generationResult.generatedAt,
											).toLocaleTimeString()}
										</p>
										{failedRatios.length > 0 && (
											<div>
												<p className='warning'>
													Partial success. Missing
													ratios:{' '}
													{failedRatios.join(', ')}
												</p>
												<div className='retry-row'>
													{failedRatios.map(
														(ratio) => (
															<button
																type='button'
																className='secondary'
																key={ratio}
																onClick={
																	attemptGeneration
																}
															>
																Retry {ratio}
															</button>
														),
													)}
												</div>
											</div>
										)}
									</div>
								)}
								<div className='modal-row'>
									<button
										type='button'
										className='secondary'
										onClick={() => setOnboardingStep(1)}
									>
										Back
									</button>
								</div>
							</div>
						)}

						{onboardingError && (
							<p className='error-msg'>{onboardingError}</p>
						)}
					</section>
				</div>
			)}
		</div>
	);
}

export default App;

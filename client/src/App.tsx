import { useState } from 'react';
import './App.css';
import type { Campaign, Step } from './types';
import { Stepper } from './components/Stepper';
import { CreateCampaign } from './components/CreateCampaign';
import { UploadAssets } from './components/UploadAssets';
import { GenerateCreatives } from './components/GenerateCreatives';
import { ReviewDashboard } from './components/ReviewDashboard';

// --- App ---

function App() {
	const [step, setStep] = useState<Step>('create');
	const [campaignId, setCampaignId] = useState('');
	const [campaign, setCampaign] = useState<Campaign | null>(null);

	return (
		<>
			<header className='app-header'>
				<div className='app-header-inner'>
					<h1>TurboFeed-LowVol</h1>
					<span className='app-header-tag'>creative automation</span>
				</div>
			</header>
			<div className='App'>
				<Stepper
					step={step}
					setStep={setStep}
					campaignId={campaignId}
				/>
				{step === 'create' && (
					<CreateCampaign
						onCreated={(c) => {
							setCampaignId(c.id);
							setCampaign(c);
							setStep('upload');
						}}
					/>
				)}
				{step === 'upload' && (
					<UploadAssets
						campaignId={campaignId}
						hero={campaign?.brief.hero ?? ''}
						onNext={() => setStep('generate')}
					/>
				)}
				{step === 'generate' && (
					<GenerateCreatives
						campaignId={campaignId}
						campaign={campaign}
						onDone={(result) => {
							setCampaign((prev) =>
								prev
									? {
											...prev,
											status: 'completed',
											outputs: result.outputs,
										}
									: prev,
							);
							setStep('review');
						}}
					/>
				)}
				{step === 'review' && (
					<ReviewDashboard
						campaignId={campaignId}
						campaign={campaign}
						setCampaign={setCampaign}
						setCampaignId={setCampaignId}
					/>
				)}
			</div>
		</>
	);
}

export default App;

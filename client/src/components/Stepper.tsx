import type { Step } from '../types';

interface StepperProps {
	step: Step;
	setStep: (s: Step) => void;
	campaignId: string;
}

export function Stepper({ step, setStep, campaignId }: StepperProps) {
	const steps: { key: Step; label: string; needsCampaign: boolean }[] = [
		{ key: 'create', label: '1. Create Campaign', needsCampaign: false },
		{ key: 'upload', label: '2. Upload Assets', needsCampaign: true },
		{
			key: 'generate',
			label: '3. Generate Creatives',
			needsCampaign: true,
		},
		{ key: 'review', label: '4. Review', needsCampaign: false },
	];

	return (
		<div className='stepper'>
			{steps.map((s) => (
				<button
					key={s.key}
					className={step === s.key ? 'active' : ''}
					disabled={s.needsCampaign && !campaignId}
					onClick={() => setStep(s.key)}
				>
					{s.label}
				</button>
			))}
		</div>
	);
}

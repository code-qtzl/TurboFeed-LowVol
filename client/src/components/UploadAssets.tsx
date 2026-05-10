import { useState, useRef, useCallback } from 'react';
import { API_BASE } from '../api/config';
import type { AssetMeta } from '../types';

interface UploadAssetsProps {
	campaignId: string;
	hero?: string;
	onNext: () => void;
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadAssets({
	campaignId,
	hero = '',
	onNext,
}: UploadAssetsProps) {
	const [assets, setAssets] = useState<AssetMeta[]>([]);
	const [uploading, setUploading] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState('');
	const [dragOver, setDragOver] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const uploadFile = useCallback(
		async (file: File) => {
			setError('');
			const supported = ['image/jpeg', 'image/png', 'image/webp'];
			if (!supported.includes(file.type)) {
				setError(
					`Unsupported format: ${file.type}. Use JPEG, PNG, or WebP.`,
				);
				return;
			}
			if (file.size > 10 * 1024 * 1024) {
				setError('File exceeds 10MB limit.');
				return;
			}

			setUploading(true);
			setProgress(0);

			const formData = new FormData();
			formData.append('file', file);

			try {
				const xhr = new XMLHttpRequest();
				xhr.open(
					'POST',
					`${API_BASE}/api/campaigns/${campaignId}/assets`,
				);

				xhr.upload.onprogress = (e) => {
					if (e.lengthComputable) {
						setProgress(Math.round((e.loaded / e.total) * 100));
					}
				};

				const result = await new Promise<AssetMeta>(
					(resolve, reject) => {
						xhr.onload = () => {
							if (xhr.status === 201) {
								resolve(JSON.parse(xhr.responseText));
							} else {
								const data = JSON.parse(xhr.responseText);
								reject(
									new Error(
										data.error?.message || 'Upload failed',
									),
								);
							}
						};
						xhr.onerror = () => reject(new Error('Network error'));
						xhr.send(formData);
					},
				);

				setAssets((prev) => [...prev, result]);
				setProgress(100);
			} catch (err: unknown) {
				setError(err instanceof Error ? err.message : 'Upload failed');
			} finally {
				setUploading(false);
			}
		},
		[campaignId],
	);

	const uploadFiles = useCallback(
		async (files: FileList | File[]) => {
			for (const file of Array.from(files)) {
				await uploadFile(file);
			}
		},
		[uploadFile],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragOver(false);
			if (e.dataTransfer.files.length > 0) {
				uploadFiles(e.dataTransfer.files);
			}
		},
		[uploadFiles],
	);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			uploadFiles(e.target.files);
		}
		e.target.value = '';
	};

	return (
		<div className='card'>
			<h2>Upload Assets</h2>
			<p>
				Campaign ID: <strong>{campaignId}</strong>
			</p>

			{hero && (
				<p className='upload-target-label'>
					Uploading for: <strong>{hero}</strong>
				</p>
			)}

			<div
				className={`dropzone${dragOver ? ' drag-over' : ''}`}
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={handleDrop}
				onClick={() => fileInputRef.current?.click()}
			>
				<input
					ref={fileInputRef}
					type='file'
					multiple
					accept='image/jpeg,image/png,image/webp'
					onChange={handleFileSelect}
				/>
				<p>Drag &amp; drop images here, or click to browse</p>
				<p style={{ fontSize: 13, color: '#999' }}>
					JPEG, PNG, or WebP · Max 10MB each · Min 800×800 · Up to
					4 references used for video
				</p>
			</div>

			{uploading && (
				<div className='progress-bar-container'>
					<div
						className='progress-bar'
						style={{ width: `${progress}%` }}
					/>
				</div>
			)}

			{error && <p className='error-msg'>{error}</p>}

			{assets.length > 0 && (
				<div className='section'>
					<h3>Uploaded Assets</h3>
					{assets.map((a) => (
						<div className='asset-item' key={a.id}>
							<p>
								<strong>{a.fileName}</strong>
							</p>
							<p>Type: {a.mimeType}</p>
							<p>
								Dimensions: {a.metadata.width} ×{' '}
								{a.metadata.height}
							</p>
							<p>Size: {formatSize(a.metadata.size)}</p>
							<p style={{ color: '#999', fontSize: 12 }}>
								ID: {a.id}
							</p>
						</div>
					))}
				</div>
			)}

			<button onClick={onNext} style={{ marginTop: 16 }}>
				Continue to Generate →
			</button>
		</div>
	);
}

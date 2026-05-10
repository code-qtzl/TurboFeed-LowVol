const execFileMock = jest.fn();

jest.mock('child_process', () => ({
	execFile: (...args: unknown[]) => {
		const cb = args[args.length - 1] as (
			err: Error | null,
			stdout: string,
			stderr: string,
		) => void;
		execFileMock(...args.slice(0, -1));
		cb(null, '', '');
	},
}));

const fsMocks = {
	mkdtemp: jest.fn(),
	writeFile: jest.fn(),
	readFile: jest.fn(),
	rm: jest.fn(),
};

jest.mock('fs', () => ({
	promises: {
		mkdtemp: (...args: unknown[]) => fsMocks.mkdtemp(...args),
		writeFile: (...args: unknown[]) => fsMocks.writeFile(...args),
		readFile: (...args: unknown[]) => fsMocks.readFile(...args),
		rm: (...args: unknown[]) => fsMocks.rm(...args),
	},
}));

import { normalizeVideoAspectRatio } from '../../video-processor';

describe('normalizeVideoAspectRatio', () => {
	beforeEach(() => {
		execFileMock.mockReset();
		fsMocks.mkdtemp.mockReset();
		fsMocks.writeFile.mockReset();
		fsMocks.readFile.mockReset();
		fsMocks.rm.mockReset();

		fsMocks.mkdtemp.mockResolvedValue('/tmp/turbofeed-test');
		fsMocks.writeFile.mockResolvedValue(undefined);
		fsMocks.readFile.mockResolvedValue(Buffer.from('out-mp4'));
		fsMocks.rm.mockResolvedValue(undefined);
	});

	it('runs the simple scale/crop pipeline when no overlay text is given', async () => {
		await normalizeVideoAspectRatio(Buffer.from('in'), '1:1');

		expect(execFileMock).toHaveBeenCalledTimes(1);
		const [, args] = execFileMock.mock.calls[0];
		expect(args).toContain('-vf');
		expect(args).not.toContain('-filter_complex');
	});

	it('adds the overlay PNG as a second input and uses filter_complex when text is given', async () => {
		await normalizeVideoAspectRatio(
			Buffer.from('in'),
			'9:16',
			'Bring the room to life',
		);

		const [, args] = execFileMock.mock.calls[0];
		expect(args).toContain('-filter_complex');
		expect(args).toContain('-map');
		expect(args).toContain('[out]');

		// overlay.png should be the second -i input
		const inputIndices: number[] = [];
		(args as string[]).forEach((v: string, i: number) => {
			if (v === '-i') inputIndices.push(i);
		});
		expect(inputIndices).toHaveLength(2);
		expect((args as string[])[inputIndices[1] + 1]).toMatch(/overlay\.png$/);
	});

	it('treats whitespace-only overlay text as no overlay', async () => {
		await normalizeVideoAspectRatio(Buffer.from('in'), '16:9', '   ');

		const [, args] = execFileMock.mock.calls[0];
		expect(args).not.toContain('-filter_complex');
	});
});

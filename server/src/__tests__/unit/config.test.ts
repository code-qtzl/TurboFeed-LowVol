// Configuration verification test
import { config } from '../../config';

describe('Configuration', () => {
	it('should have server configuration', () => {
		expect(config.server).toBeDefined();
		expect(typeof config.server.port).toBe('number');
		expect(typeof config.server.nodeEnv).toBe('string');
	});

	it('should have genai configuration', () => {
		expect(config.genai).toBeDefined();
		expect(typeof config.genai.provider).toBe('string');
		expect(typeof config.genai.timeout).toBe('number');
		expect(typeof config.genai.maxRetries).toBe('number');
	});

	it('should have storage configuration', () => {
		expect(config.storage).toBeDefined();
		expect(typeof config.storage.outputDir).toBe('string');
	});

	it('should have fal video configuration', () => {
		expect(config.fal).toBeDefined();
		expect(typeof config.fal.apiKey).toBe('string');
		expect(typeof config.fal.videoEndpoint).toBe('string');
		expect(config.fal.videoEndpoint).toContain('image-to-video');
	});

	it('should have asset validation configuration', () => {
		expect(config.assets).toBeDefined();
		expect(typeof config.assets.maxSize).toBe('number');
		expect(typeof config.assets.minDimension).toBe('number');
		expect(Array.isArray(config.assets.supportedMimeTypes)).toBe(true);
		expect(config.assets.supportedMimeTypes).toContain('image/jpeg');
		expect(config.assets.supportedMimeTypes).toContain('image/png');
		expect(config.assets.supportedMimeTypes).toContain('image/webp');
	});

	it('should have sensible default values', () => {
		expect(config.server.port).toBeGreaterThan(0);
		expect(config.genai.timeout).toBeGreaterThan(0);
		expect(config.genai.maxRetries).toBeGreaterThanOrEqual(0);
		expect(config.assets.maxSize).toBeGreaterThan(0);
		expect(config.assets.minDimension).toBeGreaterThan(0);
	});
});

module.exports = {
preset: 'ts-jest',
testEnvironment: 'node',
roots: ['<rootDir>/src'],
testMatch: ['**/__tests__/**/*.test.ts', '**/*.property.test.ts'],
testTimeout: 30000,
collectCoverageFrom: [
'src/**/*.ts',
'!src/**/*.d.ts',
'!src/**/__tests__/**',
],
coverageDirectory: 'coverage',
coverageReporters: ['text', 'lcov', 'html'],
moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
transformIgnorePatterns: ['node_modules/(?!uuid)'],
transform: {
'^.+\\.tsx?$': 'ts-jest',
'^.+\\.jsx?$': ['ts-jest', { tsconfig: false }],
},
verbose: true,
};

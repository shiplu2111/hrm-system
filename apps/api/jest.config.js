/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  maxWorkers: 2,
  workerIdleMemoryLimit: '512MB',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(htmlparser2|domelementtype|domhandler|domutils|dom-serializer|entities|escape-string-regexp|parse-srcset|nanoid)/)',
  ],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@hrm/shared-types$':
      '<rootDir>/../../../packages/shared-types/src/index.ts',
  },
};

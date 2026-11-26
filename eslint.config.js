import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Any repository import that climbs out of the current folder belongs to another module.
const crossModuleRepository = {
  group: ['../**/*.repository', '../**/*.repository.js', '**/modules/**/*.repository', '**/modules/**/*.repository.js'],
  message: "Call the owning module's service instead. A module never imports another module's repository (one owner per table, D12).",
};

const sqlFromRoutes = {
  group: ['./*.repository', './*.repository.js', '**/db', '**/db/**'],
  message: 'Routes parse, validate and call the service. They never touch the repository or the database.',
};

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },
  // Layering: routes → service → repository → db (docs/architecture.md section 3).
  {
    files: ['src/**/*.ts'],
    ignores: ['src/modules/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/*.repository', '**/*.repository.js'], message: 'Only a module’s own service imports its repository.' }] },
      ],
    },
  },
  {
    files: ['src/modules/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [crossModuleRepository] }] },
  },
  {
    files: ['src/modules/**/*.routes.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [crossModuleRepository, sqlFromRoutes] }] },
  },
  {
    files: ['**/*.test.ts', 'tests/**/*.ts'],
    rules: { '@typescript-eslint/no-unsafe-member-access': 'off', '@typescript-eslint/no-unsafe-assignment': 'off' },
  },
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);

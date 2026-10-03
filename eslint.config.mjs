import js from '@eslint/js';
import ts from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import a11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default ts.config(
  {
    ignores: [
      '**/dist/**',
      '**/.astro/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/test-results/**',
      '**/playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'jsx-a11y': a11y },
    rules: a11y.configs.recommended.rules,
  },
);

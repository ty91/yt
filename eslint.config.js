// ESLint v9 flat config converted from .eslintrc.cjs
// Mirrors original rules, plugins, and settings.

import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import { defineConfig } from 'eslint/config';
import { includeIgnoreFile } from '@eslint/compat';
import { fileURLToPath } from 'node:url';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default defineConfig([
  includeIgnoreFile(fileURLToPath(new URL('.gitignore', import.meta.url))),
  // Base recommended JS rules from ESLint
  js.configs.recommended,

  // Global settings and base rules that apply to JS/TS/JSX
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    settings: {
      // From original config
      react: { version: 'detect' },
      formComponents: ['Form'],
      linkComponents: [
        { name: 'Link', linkAttribute: 'to' },
        { name: 'NavLink', linkAttribute: 'to' },
      ],
      'import/internal-regex': '^~/',
      'import/resolver': {
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
        typescript: { alwaysTryTypes: true },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
      '@typescript-eslint': tsPlugin,
      prettier,
    },
    rules: {
      // Recommended rules from plugins (flattened to avoid re-defining plugins)
      ...(reactPlugin.configs?.recommended?.rules ?? {}),
      ...(reactPlugin.configs?.['jsx-runtime']?.rules ?? {}),
      ...(reactHooks.configs?.recommended?.rules ?? {}),
      ...(jsxA11y.configs?.recommended?.rules ?? {}),
      ...(importPlugin.configs?.recommended?.rules ?? {}),

      ...prettierConfig.rules,
      'prettier/prettier': 'error',

      // Base rules from .eslintrc.cjs
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1 }],
      'import/newline-after-import': 'error',
      'padding-line-between-statements': [
        'warn',
        { blankLine: 'always', prev: '*', next: 'return' },
      ],
      'prefer-const': 'off',
    },
  },

  // TypeScript-specific parsing and rules
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    rules: {
      // plugin:@typescript-eslint/recommended
      ...(tsPlugin.configs?.recommended?.rules ?? {}),
      // plugin:import/typescript
      ...(importPlugin.configs?.typescript?.rules ?? {}),
      // Project override retained from original config
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },

  // Node globals for config/build files
  {
    files: ['eslint.config.js', 'vite.config.*', 'react-router.config.ts'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
  },
]);

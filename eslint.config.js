import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'supabase/.temp/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'supabase/functions/**/*.ts'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'never',
          arrayLiteralTypeAssertions: 'never',
        },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-alert': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSUnknownKeyword',
          message:
            'Modele o contrato. unknown só é permitido na entrada não validada, com exceção local justificada e validação explícita.',
        },
        {
          selector:
            "CallExpression[callee.object.object.name='window'][callee.object.property.name='location'][callee.property.name='reload']",
          message: 'Atualize estado/cache ou invalide a query em vez de recarregar a página.',
        },
        {
          selector: "CallExpression[callee.object.name='location'][callee.property.name='reload']",
          message: 'Atualize estado/cache ou invalide a query em vez de recarregar a página.',
        },
        {
          selector:
            "JSXAttribute[name.name='key'] > JSXExpressionContainer > Identifier[name=/^(index|idx|i)$/]",
          message: 'Use identidade estável do item como key, não o índice do array.',
        },
        {
          selector:
            "JSXAttribute[name.name='key'] JSXExpressionContainer TemplateLiteral Identifier[name=/^(index|idx|i)$/]",
          message: 'Use identidade estável do item como key, não o índice interpolado.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/tests/**'] }],
    },
  },
  {
    files: ['*.{js,ts}', 'scripts/**/*.{mjs,ts}', 'tests/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Exceção localizada do protótipo; remover na migração de cada feature.
    files: [
      'src/AdminPreview.tsx',
      'src/ClientHome.tsx',
      'src/DeliverablesView.tsx',
      'src/IndicatorExtras.tsx',
      'src/NoticesView.tsx',
      'src/TeamEnhancements.tsx',
      'src/WorkflowViews.tsx',
      'src/app/ClientWorkspace.tsx',
    ],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
  {
    files: ['src/components/ds/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/api/**',
            '**/features/**',
            '**/app/**',
            '**/mocks/**',
            '**/tests/**',
            '@tanstack/*',
            'axios',
            '@supabase/*',
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['axios', '@supabase/*', '**/service', '**/mocks/**', '**/tests/**'] },
      ],
    },
  },
  {
    files: ['src/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['**/features/**', '**/components/**', '**/mocks/**', '**/tests/**'] },
      ],
    },
  },
  {
    // Apenas a composição do serviço seleciona mocks de execução da aplicação.
    files: ['src/api/modules/*/api.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['**/features/**', '**/components/**', '**/tests/**'] },
      ],
    },
  },
);

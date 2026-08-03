import js from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
	{ ignores: ['.svelte-kit/**', 'build/**', 'data/**', 'node_modules/**'] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: { parser: tseslint.parser },
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'svelte/no-navigation-without-resolve': 'off',
			'no-warning-comments': 'off',
			'no-unused-vars': 'off'
		}
	},
	prettier
);

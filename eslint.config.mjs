import { n8nCommunityNodesPlugin } from '@n8n/eslint-plugin-community-nodes';
import tseslint from 'typescript-eslint';

export default [
	{
		ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/tests/**'],
	},
	...tseslint.configs.recommended,
	{
		...n8nCommunityNodesPlugin.configs.recommendedWithoutN8nCloudSupport,
		files: ['**/*.ts', 'package.json'],
	},
];

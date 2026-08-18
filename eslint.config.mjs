import js from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierRecommended,
  {
    /*
     * Only the ordering rule, not `flatConfigs.recommended`: the rest of that
     * preset overlaps with what typescript-eslint already checks, and its
     * resolution rules would have to be taught about the `.ts` extensions this
     * project imports with.
     */
    plugins: {'import-x': importX},
  },
  {
    languageOptions: {
      parserOptions: {
        /*
         * The config files sit outside tsconfig's `include`, so the project
         * service has no program for them. allowDefaultProject lints them
         * against an inferred default project instead.
         */
        projectService: {
          allowDefaultProject: ['eslint.config.mjs', 'prettier.config.cjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {...globals.node},
    },
    rules: {
      /*
       * `describe` and `it` return a promise that resolves when the test
       * finishes, and node:test's own API expects you to drop it — awaiting
       * every one would be noise. Scoped to those three imported from
       * node:test, so a genuinely floating promise anywhere else still fails.
       */
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            {
              from: 'package',
              package: 'node:test',
              name: ['describe', 'it', 'test'],
            },
          ],
        },
      ],

      // Fixable - errors
      'one-var': ['error', {const: 'never', let: 'never'}],
      'dot-notation': 'error',
      'no-else-return': ['error', {allowElseIf: false}],
      'capitalized-comments': 'error',
      'linebreak-style': 'off',
      'lines-between-class-members': 'error',
      'multiline-comment-style': 'error',
      'no-lonely-if': 'error',
      'operator-assignment': 'error',
      'padding-line-between-statements': 'error',
      'arrow-body-style': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-const': 'error',
      'prefer-numeric-literals': 'error',
      'prefer-spread': 'error',
      'prefer-template': 'error',
      /*
       * `import-x/order` owns the order of the statements, `sort-imports` only
       * the names inside each one. Core `sort-imports` used to own both, but it
       * sorts declarations by first member name where every editor's organise
       * imports sorts by path, and it cannot autofix the difference — it only
       * ever reports it. Splitting the two makes `--fix` and the editor agree.
       */
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          alphabetize: {order: 'asc', caseInsensitive: true},
          'newlines-between': 'never',
        },
      ],
      'sort-imports': ['error', {ignoreDeclarationSort: true}],

      // Non-fixable - warnings
      'no-await-in-loop': 'warn',
      'array-callback-return': 'warn',
      'block-scoped-var': 'warn',
      complexity: 'warn',
      'consistent-return': 'warn',
      'default-case': 'warn',
      'guard-for-in': 'warn',
      'no-alert': 'warn',
      'no-eq-null': 'warn',
      'no-implicit-globals': 'warn',
      'no-invalid-this': 'warn',
      'no-loop-func': 'warn',
      'no-param-reassign': 'warn',
      'no-script-url': 'warn',
      'no-useless-concat': 'warn',
      'no-void': 'warn',
      'no-warning-comments': 'warn',
      radix: 'warn',
      'require-await': 'warn',
      'init-declarations': 'warn',
      'no-shadow': 'warn',
      'no-undefined': 'warn',
      'consistent-this': 'warn',
      'func-name-matching': 'warn',
      'func-names': 'warn',
      'func-style': ['warn', 'declaration', {allowArrowFunctions: true}],
      'line-comment-position': 'warn',
      'max-depth': 'warn',
      'max-nested-callbacks': 'warn',
      'no-bitwise': 'warn',
      'no-continue': 'warn',
      'no-inline-comments': 'warn',
      'no-multi-assign': 'warn',
      'no-negated-condition': 'warn',
      'no-nested-ternary': 'warn',
      'no-plusplus': 'warn',
      'no-underscore-dangle': 'warn',
      'prefer-destructuring': 'warn',
      'prefer-rest-params': 'warn',
    },
  },
);

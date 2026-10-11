import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

/** Next.js recommended rules (core web vitals + TypeScript). */
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'output/**', 'tmp/**', 'backups/**', 'coverage/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // A leading underscore marks a deliberately unused argument or placeholder.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // Photos come from Supabase Storage and are already resized to WebP on upload (srcSet per screen).
      '@next/next/no-img-element': 'off',
    },
  },
]

export default config

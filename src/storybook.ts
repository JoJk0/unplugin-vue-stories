/**
 * This entry file is for Storybook addon.
 *
 * @module
 */

import { mergeConfig, type UserConfig } from 'vite'
import { indexer } from './core/indexer'
import VueStories from './vite'
import type { StorybookConfig } from '@storybook/types'

/**
 * Storybook addon
 *
 * @example
 * ```ts
 * // .storybook/main.ts
 *
 * export default {
 *   addons: ['unplugin-vue-stories/storybook'],
 * }
 * ```
 */
export const viteFinal = (config: UserConfig): Record<string, any> =>
  mergeConfig(config, {
    plugins: [VueStories()],
  })

// See https://storybook.js.org/docs/api/main-config/main-config-indexers
export const experimental_indexers: StorybookConfig['experimental_indexers'] = (
  indexers,
) => {
  return [
    {
      test: /\.stories\.vue$/,
      index: indexer,
      createIndex: indexer,
    },
    ...(indexers || []),
  ]
}

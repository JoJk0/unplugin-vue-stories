/**
 * This entry file is for Storybook addon.
 *
 * @module
 */

import { mergeConfig } from 'vite'
import { indexer } from './core/indexer'
import VueStories from './vite'
import type { Options } from './core/options'
import type { StorybookConfig } from '@storybook/vue3-vite'

type UserConfig = Parameters<NonNullable<StorybookConfig['viteFinal']>>[0]

/**
 * Storybook addon
 *
 * @example
 * ```ts
 * // .storybook/main.ts
 * export default {
 *   addons: ['unplugin-vue-stories/storybook'],
 * }
 * ```
 * ```ts
 * // If you want to configure the addon
 * export default {
 *   addons: [
      {
        name: 'unplugin-vue-stories/storybook',
        options: {
          design: {
            type: 'figma',
            getUrl: (id: string) =>
              `https://www.figma.com/file/1234567890?nodeId=${id}`,
          },
        },
      },
 *  ],
 * }
 * ```
 */
export const viteFinal = (
  config: UserConfig,
  options: Options,
): Record<string, any> =>
  mergeConfig(config, {
    plugins: [
      VueStories({
        design: options?.design,
        include: options?.include,
        exclude: options?.exclude,
        tsconfigPath: options?.tsconfigPath,
      }),
    ],
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

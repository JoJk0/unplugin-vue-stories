import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { readConfigFile } from 'typescript'
import {
  createUnplugin,
  type UnpluginInstance,
  type UnpluginOptions,
} from 'unplugin'
import { createFilter, toArray } from 'unplugin-utils'
import { createChecker } from 'vue-component-meta'
import { logger } from './core/logger'
import { resolveOptions, type Options } from './core/options'

import { transform as transformStoryPreview } from './core/story-preview'
import { transform as transformSuperMeta } from './core/super-meta'
import { transform as transformVueStories } from './core/transform'

export { transform as transformStoryPreview } from './core/story-preview'
export { transform as transformSuperMeta } from './core/super-meta'
export { transform as transformVueStories } from './core/transform'

export const STORIES_INTERNAL_SUFFIX = '?vue&type=stories'
export const STORIES_PUBLIC_SUFFIX = '.stories.vue'
export const STORIES_PREVIEW_PUBLIC_SUFFIX: '.stories.vue?preview' = `${STORIES_PUBLIC_SUFFIX}?preview`

const resolveVueStoriesId: (
  publicSuffix: string,
  setId: (id: string) => string,
) => UnpluginOptions['resolveId'] = (publicSuffix, setId) =>
  async function (this, source, importer, options) {
    // logger.debug('resolveId', source)
    if (source.endsWith(publicSuffix)) {
      // Determine what the actual entry would have been. We need "skipSelf" to avoid an infinite loop.
      // @ts-expect-error: not yet exposed -- https://github.com/unjs/unplugin/issues/47
      const resolution = (await this.resolve(source, importer, {
        skipSelf: true,
        ...options,
      })) as { id: string; external: boolean }

      // If it cannot be resolved or is external, return undefined so that the next plugin can handle it
      if (!resolution || resolution.external) return undefined

      // We append a custom "type" so that the vue plugin is not handling the import
      resolution.id = setId(resolution.id)

      logger.debug(`Resolving ${source} to ${resolution.id}`)
      return resolution
    }
  }

export const VueStories: UnpluginInstance<Options | undefined, true> =
  createUnplugin((rawOptions = {}) => {
    const options = resolveOptions(rawOptions)

    const dirname = cwd()

    const tsconfigPath = join(dirname, options.tsconfigPath)

    const { config: tsConfig } = readConfigFile(tsconfigPath, (path) =>
      readFileSync(path, 'utf-8'),
    )

    const filter = createFilter(
      [...toArray(options.include), ...(tsConfig.include ?? [])],
      [...toArray(options.exclude), ...(tsConfig.exclude ?? [])],
    )

    const { getComponentMeta } = createChecker(tsconfigPath)

    const name = 'unplugin-vue-stories'

    return [
      {
        /** Extracts extra component metadata to the component object */
        name: `${name}:meta`,
        enforce: options.enforce,
        transformInclude: (id) => id.endsWith('.vue') && filter(id),
        transform(code, id) {
          return transformSuperMeta(code, id, getComponentMeta, options)
        },
      },
      {
        /** Gets the default Storybook story out of the Vue stories as a component */
        name: `${name}:preview`,
        enforce: options.enforce,
        transformInclude: (id) => id.endsWith(STORIES_PREVIEW_PUBLIC_SUFFIX),
        transform: (code, id) => transformStoryPreview(code, id),
      },
      {
        /** Transforms Vue SFC stories into Storybook CSF format */
        name,
        enforce: options.enforce,
        resolveId: resolveVueStoriesId(
          STORIES_PUBLIC_SUFFIX,
          (id) => id + STORIES_INTERNAL_SUFFIX,
        ),
        transformInclude: (id) =>
          id.endsWith(STORIES_PUBLIC_SUFFIX + STORIES_INTERNAL_SUFFIX),
        transform: (code, id) => transformVueStories(code, id, options),
      },
    ]
  })

import { createUnplugin, type UnpluginInstance } from 'unplugin'
import { logger } from './core/logger'
import { resolveOptions, type Options } from './core/options'
import { transform } from './core/transform'

const STORIES_INTERNAL_SUFFIX = '?vue&type=stories'
const STORIES_PUBLIC_SUFFIX = '.stories.vue'

export const VueStories: UnpluginInstance<Options | undefined, false> =
  createUnplugin((rawOptions = {}) => {
    const options = resolveOptions(rawOptions)

    const name = 'unplugin-vue-stories'
    return {
      name,
      enforce: options.enforce,

      async resolveId(source, importer, options) {
        logger.debug('resolveId', source)
        if (source.endsWith(STORIES_PUBLIC_SUFFIX)) {
          // Determine what the actual entry would have been. We need "skipSelf" to avoid an infinite loop.
          // @ts-expect-error: not yet exposed -- https://github.com/unjs/unplugin/issues/47
          const resolution = (await this.resolve(source, importer, {
            skipSelf: true,
            ...options,
          })) as { id: string; external: boolean }

          // If it cannot be resolved or is external, return undefined so that the next plugin can handle it
          if (!resolution || resolution.external) return undefined

          // We append a custom "type" so that the vue plugin is not handling the import
          resolution.id = resolution.id + STORIES_INTERNAL_SUFFIX

          logger.debug(`Resolving ${source} to ${resolution.id}`)
          return resolution
        }
      },

      transformInclude(id) {
        return (
          id.endsWith(STORIES_PUBLIC_SUFFIX + STORIES_INTERNAL_SUFFIX) ||
          id.endsWith('.vue')
        )
      },

      transform,
    }
  })

/* eslint-disable import/no-default-export */
import { addVitePlugin, addWebpackPlugin, defineNuxtModule } from '@nuxt/kit'
import vite from './vite'
import webpack from './webpack'
import type { Options } from './core/options'
import type { NuxtModule } from '@nuxt/schema'

const module: NuxtModule<Options> = defineNuxtModule<Options>({
  meta: {
    name: 'nuxt-unplugin-vue-stories',
    configKey: 'vueStories',
  },
  setup(options: Options | undefined) {
    addVitePlugin(() => vite(options))
    addWebpackPlugin(() => webpack(options))
  },
})

export default module

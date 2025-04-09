import { readFile } from 'node:fs/promises'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type UserConfig } from 'vite'
import { transformStoryPreview } from '../src/index'
// import VueStories from '../src/vite'

const _default_1: UserConfig = defineConfig({
  plugins: [
    // VueStories(),
    vue(),
    {
      name: 'preview-test',
      resolveId(id) {
        if (id.includes('@preview-test')) {
          return `\0${id}`
        }
      },
      async load(id) {
        if (id.includes('@preview-test')) {
          const component = await readFile(
            './playground/Counter.stories.vue',
            'utf-8',
          )
          return `export default {
            code: \`${transformStoryPreview(component, id)?.code}\`,
          }`
        }
      },
    },
  ],
})
export default _default_1

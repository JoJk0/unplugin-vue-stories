import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/*.ts'],
  format: 'esm',
  target: 'node18.12',
  clean: true,
  fromVite: true,
  dts: { transformer: 'oxc' },
  external: [
    '@nuxt/schema',
    '@storybook/vue3-vite',
    'vue/compiler-sfc',
    'vite',
    'prettier',
    'typescript',
    'vue-component-meta',
    'node:fs/promises',
    'node:path',
    /^node:(.*)$/,
  ],
})

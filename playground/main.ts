/* eslint-disable import/no-default-export */

import type { StorybookConfig } from '@storybook/vue3-vite'

const config: StorybookConfig = {
  stories: ['./*.stories.@(js|jsx|ts|tsx|vue)'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-component-meta',
      builder: { viteConfigPath: './playground/vite.config.ts' },
    },
  },
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-designs',
    {
      name: '../src/storybook',
      options: {
        design: {
          type: 'figma',
          getUrl: (id: string) =>
            `https://www.figma.com/file/1234567890?nodeId=${id}`,
        },
        include: ['playground/**/*.vue'],
      },
    },
    '@ljcl/storybook-addon-cssprops',
  ],
}

export default config

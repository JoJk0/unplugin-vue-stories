/* prettier-ignore */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols
// biome-ignore lint: disable
import type { Meta } from '@storybook/vue3'

declare global {
  /**
   * Vue compiler macro for defining metadata for a Storybook SFC story.
   */
  const defineMeta: <T extends Component>(meta: Meta<T>) => Meta<T>
}

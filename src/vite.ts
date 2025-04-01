/**
 * This entry file is for Vite plugin.
 *
 * @module
 */

import { VueStories } from './index'

/**
 * Vite plugin
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import VueStories from 'unplugin-vue-stories/vite'
 *
 * export default defineConfig({
 *   plugins: [VueStories()],
 * })
 * ```
 */
const vite = VueStories.vite as typeof VueStories.vite
export default vite
export { vite as 'module.exports' }

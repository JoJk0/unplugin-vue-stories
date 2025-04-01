/**
 * This entry file is for Rollup plugin.
 *
 * @module
 */

import { VueStories } from './index'

/**
 * Rollup plugin
 *
 * @example
 * ```ts
 * // rollup.config.js
 * import VueStories from 'unplugin-vue-stories/rollup'
 *
 * export default {
 *   plugins: [VueStories()],
 * }
 * ```
 */
const rollup = VueStories.rollup as typeof VueStories.rollup
export default rollup
export { rollup as 'module.exports' }

/**
 * This entry file is for Rolldown plugin.
 *
 * @module
 */

import { VueStories } from './index'

/**
 * Rolldown plugin
 *
 * @example
 * ```ts
 * // rolldown.config.js
 * import VueStories from 'unplugin-vue-stories/rolldown'
 *
 * export default {
 *   plugins: [VueStories()],
 * }
 * ```
 */
const rolldown = VueStories.rolldown as typeof VueStories.rolldown
export default rolldown
export { rolldown as 'module.exports' }

/**
 * This entry file is for Farm plugin.
 *
 * @module
 */

import { VueStories } from './index'

/**
 * Farm plugin
 *
 * @example
 * ```ts
 * // farm.config.js
 * import VueStories from 'unplugin-vue-stories/farm'
 *
 * export default {
 *   plugins: [VueStories()],
 * }
 * ```
 */
const farm = VueStories.farm as typeof VueStories.farm
export default farm
export { farm as 'module.exports' }

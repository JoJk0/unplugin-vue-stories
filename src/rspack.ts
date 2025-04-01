/**
 * This entry file is for Rspack plugin.
 *
 * @module
 */

import { VueStories } from './index'

/**
 * Rspack plugin
 *
 * @example
 * ```js
 * // rspack.config.js
 * import VueStories from 'unplugin-vue-stories/rspack'
 *
 * default export {
 *  plugins: [VueStories()],
 * }
 * ```
 */
const rspack = VueStories.rspack as typeof VueStories.rspack
export default rspack
export { rspack as 'module.exports' }

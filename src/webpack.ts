/**
 * This entry file is for webpack plugin.
 *
 * @module
 */

import { VueStories } from './index'

/**
 * Webpack plugin
 *
 * @example
 * ```js
 * // webpack.config.js
 * import Starter from 'unplugin-starter/webpack'
 *
 * default export {
 *  plugins: [Starter()],
 * }
 * ```
 */
const webpack = VueStories.webpack as typeof VueStories.webpack
export default webpack
export { webpack as 'module.exports' }

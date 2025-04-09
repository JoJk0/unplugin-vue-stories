/**
 * This entry file is for esbuild plugin.
 *
 * @module
 */

import { VueStories } from './index'

/**
 * Esbuild plugin
 *
 * @example
 * ```ts
 * import { build } from 'esbuild'
 * import Starter from 'unplugin-starter/esbuild'
 * 
 * build({ plugins: [Starter()] })
```
 */
const esbuild = VueStories.esbuild as typeof VueStories.esbuild
export default esbuild
export { esbuild as 'module.exports' }

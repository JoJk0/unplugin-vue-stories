import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import type { FilterPattern } from 'unplugin-utils'

export interface Options {
  include?: FilterPattern
  exclude?: FilterPattern
  enforce?: 'pre' | 'post' | undefined
  /**
   * Path to the tsconfig.json file to use for resolving prop, event, model and slot types.
   *
   * **Mandatory** if you use references inside `tsconfig.json`.
   * If so, set it to `tsconfig.app.json`, or any tsconfig file without references.
   * @default './tsconfig.json'
   */
  tsconfigPath?: string
  design?:
    | false
    | {
        /**
         * Design provider name used as a prefix in component JSDoc description design IDs
         * @example 'design' -> `\/** @designId 123-45 *\/`
         * @default 'design'
         */
        type: string
        /**
         * Function to generate the design URL
         * @param id the design ID
         * @default (id) => id
         * @returns the design URL
         */
        getUrl: (id: string) => string
      }
}

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U

type RemoveFalse<T> = T extends false ? never : T

export type OptionsResolved = Overwrite<
  {
    [key in keyof Options]-?: RemoveFalse<Options[key]>
  },
  Pick<Options, 'enforce'>
>

export function resolveOptions(options: Options): OptionsResolved {
  const tsConfigDefaultPath = './tsconfig.json'
  const appTsConfigDefaultPath = './tsconfig.app.json'

  const tsconfigPath = (() => {
    if (options.tsconfigPath) {
      return options.tsconfigPath
    }

    if (existsSync(resolve(cwd(), appTsConfigDefaultPath))) {
      return appTsConfigDefaultPath
    }

    if (existsSync(resolve(cwd(), tsConfigDefaultPath))) {
      return tsConfigDefaultPath
    }

    throw new Error(
      `No tsconfig file found. Please provide a tsconfigPath option or create a tsconfig.json or tsconfig.app.json file in the root directory.`,
    )
  })()

  return {
    include: options.include || ['src/**/*.vue'],
    exclude: options.exclude || [/node_modules/],
    enforce: 'enforce' in options ? options.enforce : 'pre',
    design: options.design || {
      type: 'design',
      getUrl: (id: string) => id,
    },
    tsconfigPath,
  }
}

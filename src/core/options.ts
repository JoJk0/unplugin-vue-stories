import type { FilterPattern } from 'unplugin-utils'

export interface Options {
  include?: FilterPattern
  exclude?: FilterPattern
  enforce?: 'pre' | 'post' | undefined
  design?:
    | false
    | {
        /**
         * Design provider name used as a prefix in component JSDoc description design IDs
         * @example 'design' -> `\/** @designId 123-45 *\/`
         */
        type: string
        /**
         * Function to generate the design URL
         * @param id the design ID
         * @returns the design URL
         */
        getUrl: (id: string) => string
      }
}

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U

export type OptionsResolved = Overwrite<
  Required<Options>,
  Pick<Options, 'enforce'>
>

export function resolveOptions(options: Options): OptionsResolved {
  return {
    include: options.include || [/\.[cm]?[jt]sx?$/],
    exclude: options.exclude || [/node_modules/],
    enforce: 'enforce' in options ? options.enforce : 'pre',
    design: false,
  }
}

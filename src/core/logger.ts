import { consola, type ConsolaInstance } from 'consola'

export const logger: ConsolaInstance = consola.withTag('[storybook:vue]')
// logger.level = 4 // Debug

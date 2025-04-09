export function pascalToKebabCase(str: string): string {
  return str.replaceAll(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

export function toCamelCase(str: string): string {
  return str.replaceAll(/-([a-z])/g, (_, p1) => p1.toUpperCase())
}

/**
 * Returns the index of the last element in the array where predicate is true, and -1
 * otherwise.
 * @param array The source array to search in
 * @param predicate find calls predicate once for each element of the array, in descending
 * order, until it finds one where predicate returns true. If such an element is found,
 * findLastIndex immediately returns that element index. Otherwise, findLastIndex returns -1.
 */
export function findLastIndex<T>(
  array: Array<T>,
  predicate: (value: T, index: number, obj: T[]) => boolean,
): number {
  let l = array.length
  while (l--) {
    if (predicate(array[l], l, array)) return l
  }
  return -1
}

/**
 * Extracts lines out of a block of text regardless of platform-specific line endings
 * @param block the block of text
 * @returns the lines of text
 */
export function toLines(block: string): string[] {
  return (
    block.split('\r\n')[0] === block ? block.split('\n') : block.split('\r\n')
  ).map((line) => line.trim())
}

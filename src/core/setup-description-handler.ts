import { visit } from 'recast'
import type { File, Node } from '@babel/types'

/**
 * Extract description from an setup-style Vue 3 `<script setup>` component
 * from description tag
 *
 * @url https://github.com/vue-styleguidist/vue-styleguidist/pull/1621/files#diff-3657d53b0bf16f843fc964dcf0ebcee7bd332244b74cb86c009cb33cdd4d4b69
 *
 * @param {NodePath} astPath
 * @param {Array<NodePath>} componentDefinitions
 * @param {string} originalFilePath
 */
export const setupHandler = (
  documentation: Map<string, any>,
  astPath: File,
): void => {
  visit(astPath.program, {
    visitProgram(path) {
      const body = path.value.body as Node[]

      const data = body.reduce(
        (acc, node) => {
          if (acc || !node.leadingComments?.[0]) return acc

          const descriptionComment = node.leadingComments[0]

          if (!descriptionComment) return acc

          const { description, tags } = extractSetupTags(
            descriptionComment.value,
          )

          return {
            description,
            tags,
          }
        },
        null as {
          description: string | undefined
          tags: Record<string, { title: string; description: string }[]>
        } | null,
      )

      if (!data) return false

      documentation.set('description', data.description)

      const existingTags = documentation.get('tags')
      documentation.set('tags', { ...existingTags, ...data.tags })

      return false
    },
  })
}

export function extractSetupTags(rawDocblock: string): {
  description: string | undefined
  tags: Record<
    string,
    {
      title: string
      description: string
    }[]
  >
} {
  const lines = rawDocblock.split('\n')

  return {
    description: extractDescription(lines),
    tags: extractTags(lines),
  }
}

/**
 * Extract description from an array of lines
 * @param lines array of lines
 * @returns description
 */
export function extractDescription(lines: string[]) {
  return lines
    .map((line) => parseDocblock(line))
    .find((line) => line && !line.startsWith('@')) as string | undefined
}

export function parseTag(line: string): {
  tag: string
  description: string
} | null {
  const match = /^@(\S+)\s*(.*)$/.exec(line)

  if (!match) return null

  const tag = {
    tag: match[1],
    description: match[2],
  }

  return tag
}

/**
 * Extract tags from an array of lines
 * @param lines array of lines
 * @returns tags
 */
export function extractTags(lines: string[]): Record<
  string,
  {
    title: string
    description: string
  }[]
> {
  const tags = lines.reduce(
    (acc, line) => {
      const tag = parseTag(parseDocblock(line))

      if (!tag) return acc

      return {
        ...acc,
        [tag.tag]: [
          ...(acc[tag.tag] ?? []),
          {
            title: tag.tag,
            description: tag.description,
          },
        ],
      }
    },
    {
      designId: [],
      previewSlot: [],
      previewProp: [],
      cssVar: [],
    } as Record<string, { title: string; description: string }[]>,
  )

  return tags
}

function parseDocblock(line: string): string {
  return line
}

import { basename } from 'node:path'
import {
  generateTransform,
  MagicStringAST,
  parseSFC,
  type CodeTransform,
} from '@vue-macros/common'

import { findLastIndex, pascalToKebabCase, toLines } from './utils'
import type { OptionsResolved } from './options'
import type { CssVarMeta } from './types'
import type { ComponentMeta, EventMeta, PropertyMeta } from 'vue-component-meta'
import type { SFCStyleBlock } from 'vue/compiler-sfc'

/**
 * Extracts the CSS variables from the `<style>` block of a Vue SFC
 * and adds them to the `defineOptions` call in the `<script setup>` block.
 * @param code
 * @param id
 * @returns transformed code
 */
export function transform(
  code: string,
  id: string,
  getComponentMeta: (
    componentPath: string,
    exportName?: string,
  ) => ComponentMeta,
  options?: OptionsResolved,
): CodeTransform | undefined {
  if (id.endsWith('.vue')) {
    const sfc = parseSFC(code, id)

    const componentMeta = getComponentMeta(id)

    const { props, events, models } = parseModels(
      componentMeta.props,
      componentMeta.events,
    )

    if (!sfc.scriptSetup) return

    const { scriptSetup, getSetupAst, styles } = sfc
    const setupOffset = scriptSetup.loc.start.offset
    const setupAst = getSetupAst()!

    const comment = setupAst.body?.[0]?.leadingComments?.[0].value

    const description = extractDescription(comment ?? '')
    const tags = extractTags(comment ?? '')

    const componentName = basename(id.replace('.vue', ''))

    const cssVars = extractCssVars(styles, componentName)

    const designId = options?.design
      ? tags[`${options?.design?.type}Id`]?.[0]?.description
      : undefined

    const data = {
      __meta: {
        slots: componentMeta.slots,
        props,
        events,
        models,
        description,
        [`${options?.design?.type}Url`]: options?.design
          ? options.design.getUrl(designId!)
          : undefined,
        category: tags.category?.[0]?.description,
        cssVars,
      },
    }

    const s = new MagicStringAST(code, { offset: setupOffset })

    const defineOptionsBlock = setupAst.body?.find((node) => {
      return (
        node.type === 'ExpressionStatement' &&
        node.expression?.type === 'CallExpression' &&
        node.expression.callee.type === 'Identifier' &&
        node.expression.callee.name === 'defineOptions'
      )
    })

    if (defineOptionsBlock) {
      s.prependRight(
        defineOptionsBlock.end! - 2,
        `, \n${JSON.stringify(data).slice(1, -1)},\n`,
      )
    } else {
      s.prependLeft(0, `defineOptions(${JSON.stringify(data)})\n`)
    }

    const t = generateTransform(s, id)

    return t
  }
}

/**
 * Extracts root element CSS variables from a `<style>` block
 * Root element class must be the same as the component name e.g. `AppModal.vue` -> `.app-modal`
 * @returns list of CSS vars of root element class. Only ones starting with `--default-<component-name>` are included
 */
export function extractCssVars(
  style: SFCStyleBlock[],
  componentName: string,
): CssVarMeta[] | undefined {
  const kebabName = pascalToKebabCase(componentName)

  const block = style.find((block) => block.type === 'style')
  if (!block) return

  const blockLines = toLines(block.content)

  const cssVars = blockLines.reduce((acc, line, index) => {
    if (
      (line.startsWith(`--${kebabName}-`) ||
        line.startsWith(`--default-${kebabName}-`)) &&
      line.includes(':')
    ) {
      const hasComment = blockLines[index - 1].endsWith('*/')

      const commentEnd = index - 1
      const commentStart = findLastIndex(
        blockLines,
        (line, i) => line.startsWith('/**') && i < index,
      )

      const comment = hasComment
        ? blockLines
            .slice(commentStart, commentEnd + 1)
            .join('\n')
            .trim()
            .slice(2, -1)
        : undefined

      return [...acc, parseCssVar(line, comment)]
    }
    return acc
  }, [] as CssVarMeta[])

  return cssVars
}

export function parseCssVar(line: string, comment?: string): CssVarMeta {
  const [key, value] = line.split(':')

  const description = extractDescription(comment ?? '')
  const tags = extractTags(comment ?? '')

  return {
    key: key.trim().replace('default-', ''),
    value: value.trim().slice(0, -1),
    type: tags.syntax?.[0]?.description,
    description,
  }
}

/**
 * Extract tags from a docblock comment
 * @param rawDocblock string - the raw docblock comment
 * @returns tags
 */
export function extractTags(rawDocblock: string): Record<
  string,
  {
    title: string
    description: string
  }[]
> {
  const lines = toLines(rawDocblock)
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
    {} as Record<string, { title: string; description: string }[]>,
  )

  return tags
}

/**
 * Extract description from a docblock comment
 * @param rawDocblock string - the raw docblock comment
 * @returns description
 */
export function extractDescription(rawDocblock: string): string | undefined {
  const lines = toLines(rawDocblock)

  return lines
    .filter((line) => line.length > 0)
    .map((line) => parseDocblock(line))
    .filter((line) => line && !line.startsWith('@'))
    .join('\n')
}

export function parseTag(line: string): {
  tag: string
  description: string
} | null {
  const match = /@(\w+)\s+(.+)/.exec(line)

  if (!match) return null

  const tag = {
    tag: match[1],
    description: match[2],
  }

  return tag
}

/**
 * Extracts the text from a docblock comment / line
 * @param {rawDocblock} str
 * @return str stripped from stars and spaces
 */
export function parseDocblock(str: string): string {
  const lines = toLines(str).filter(
    (line) =>
      (line.length > 0 && line.startsWith('*')) || line.startsWith('/**'),
  )
  for (let i = 0, l = lines.length; i < l; i++) {
    lines[i] = lines[i].replaceAll(/\/?\s*\*\s*\/?/g, '')
  }
  return lines.join('\n').trim()
}

/**
 * Extracts models out of props and events
 * @returns grouped props, events and models
 */
export function parseModels(
  props: PropertyMeta[],
  events: EventMeta[],
): {
  props: PropertyMeta[]
  events: EventMeta[]
  models: PropertyMeta[]
} {
  const excludeProps = ['key', 'ref', 'ref_for', 'ref_key', 'class', 'style']

  const models = props.filter((prop) =>
    events.find((event) => event.name === `update:${prop.name}`),
  )

  const filteredProps = props
    .filter((prop) => !models.some((model) => model.name === prop.name))
    .filter((prop) => !excludeProps.includes(prop.name))

  return {
    props: filteredProps,
    events: events.filter(({ name }) => !name.startsWith('update:')),
    models,
  }
}

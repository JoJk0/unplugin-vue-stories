import { basename } from 'node:path'
import {
  generateTransform,
  MagicStringAST,
  parseSFC as parseSFCMacros,
  type CodeTransform,
} from '@vue-macros/common'
import { extractSetupTags } from './setup-description-handler'
import { findLastIndex, pascalToKebabCase } from './utils'
import type { CssVarMeta } from './types'

import type { SFCStyleBlock } from 'vue/compiler-sfc'

/**
 * Extracts the CSS variables from the `<style>` block of a Vue SFC
 * and adds them to the `defineOptions` call in the `<script setup>` block.
 * @param code
 * @param id
 * @returns transformed code
 */
export function transformSuperMeta(
  code: string,
  id: string,
): CodeTransform | undefined {
  if (id.endsWith('.vue')) {
    const sfc = parseSFCMacros(code, id)
    if (!sfc.scriptSetup) return
    const { scriptSetup, getSetupAst, styles } = sfc
    const setupOffset = scriptSetup.loc.start.offset
    const setupAst = getSetupAst()!

    const comment = setupAst.body?.[0]?.leadingComments?.[0].value

    const { description, tags } = extractSetupTags(comment ?? '')

    const componentName = basename(id.replace('.vue', ''))

    const cssVars = extractCssVars(styles, componentName)

    const data = {
      description,
      designId: tags.designId?.[0]?.description,
      category: tags.category?.[0]?.description,
      cssVars,
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
        `${JSON.stringify(data).slice(1, -1)},\n`,
      )
    } else {
      s.prependLeft(0, `defineOptions(${JSON.stringify(data)})\n`)
    }

    const t = generateTransform(s, id)

    return t
  }
}

function parseCssVar(line: string, comment?: string): CssVarMeta {
  const [key, value] = line.split(':')

  const { description, tags } = extractSetupTags(comment ?? '')

  return {
    key: key.trim().replace('default-', ''),
    value: value.trim().slice(0, -1),
    type: tags.syntax?.[0]?.description,
    description,
  }
}

/**
 * Extracts root element CSS variables from a `<style>` block
 * Root element class must be the same as the component name e.g. `AppModal.vue` -> `.app-modal`
 * @returns list of CSS vars of root element class. Only ones starting with `--default-<component-name>` are included
 */
function extractCssVars(style: SFCStyleBlock[], componentName: string) {
  const kebabName = pascalToKebabCase(componentName)

  const block = style.find((block) => block.type === 'style')
  if (!block) return

  const blockLines =
    block.content.split('\r\n')[0] === block.content
      ? block.content.split('\n')
      : block.content.split('\r\n')

  const cssVars = blockLines.reduce((acc, line, index) => {
    if (line.trim().startsWith(`--${kebabName}-`)) {
      const hasComment = blockLines[index - 1].endsWith('*/')

      const commentEnd = index - 1
      const commentStart = findLastIndex(
        blockLines,
        (line, i) => line.trim().startsWith('/**') && i < index,
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

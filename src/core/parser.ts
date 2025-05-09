import { sanitize } from '@storybook/csf'
import { NodeTypes, type ElementNode } from '@vue/compiler-core'
import {
  compileScript,
  compileTemplate,
  parse as parseSFC,
  type SFCScriptBlock,
} from 'vue/compiler-sfc'

import type { ParsedMeta, ParsedStory } from './types'

export function parse(code: string): {
  resolvedScript: SFCScriptBlock | undefined
  meta: ParsedMeta
  stories: ParsedStory[]
  docs: string | undefined
} {
  const { descriptor } = parseSFC(code)
  if (descriptor.template === null) throw new Error('No template found in SFC')

  const resolvedScript =
    descriptor.script || descriptor.scriptSetup
      ? compileScript(descriptor, { id: 'test' })
      : undefined
  const { meta, stories } = parseTemplate(descriptor.template.content)
  const docsBlock = descriptor.customBlocks?.find(
    (block) => block.type === 'docs',
  )
  const docs = docsBlock?.content.trim()
  return {
    resolvedScript,
    meta,
    stories,
    docs,
  }
}

function parseTemplate(content: string): {
  meta: ParsedMeta
  stories: ParsedStory[]
} {
  const template = compileTemplate({
    source: content,
    filename: 'test.vue',
    id: 'test',
    /* compilerOptions: {
        nodeTransforms: [extractTitle, replaceStoryNode],
      }, */
  })

  const roots =
    template.ast?.children.filter((node) => node.type === NodeTypes.ELEMENT) ??
    []
  if (roots.length !== 1) {
    throw new Error('Expected exactly one <Stories> element as root.')
  }

  const root = roots[0]
  if (root.type !== NodeTypes.ELEMENT || root.tag !== 'Stories')
    throw new Error('Expected root to be a <Stories> element.')
  const meta = {
    title: extractTitle(root),
    component: extractComponent(root),
    tags: [],
  }

  const stories: ParsedStory[] = []
  for (const story of root.children ?? []) {
    if (story.type !== NodeTypes.ELEMENT || story.tag !== 'Story') continue

    const title = extractTitle(story)
    if (!title) throw new Error('Story is missing a title')

    const play = extractPlay(story)

    const storyTemplate = parseSFC(
      story.loc.source
        .replace(/<Story/, '<template')
        .replace(/<\/Story>/, '</template>'),
    ).descriptor.template?.content
    if (storyTemplate === undefined)
      throw new Error('No template found in Story')
    stories.push({
      id: sanitize(title).replaceAll(/[^\dA-Z]/gi, '_'),
      title,
      play,
      template: storyTemplate,
    })
  }
  return {
    meta,
    stories,
  }
}

function extractTitle(node: ElementNode) {
  const prop = extractProp(node, 'title')
  if (prop && prop.type === NodeTypes.ATTRIBUTE) return prop.value?.content
}

function extractComponent(node: ElementNode) {
  const prop = extractProp(node, 'component')
  if (prop && prop.type === NodeTypes.DIRECTIVE)
    return prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
      ? prop.exp?.content.replace('_ctx.', '')
      : undefined
}

function extractPlay(node: ElementNode) {
  const prop = extractProp(node, 'play')
  if (prop && prop.type === NodeTypes.DIRECTIVE)
    return prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
      ? prop.exp?.content.replace('_ctx.', '')
      : undefined
}

function extractProp(node: ElementNode, name: string) {
  if (node.type === NodeTypes.ELEMENT) {
    return node.props.find(
      (prop) =>
        prop.name === name ||
        (prop.name === 'bind' &&
          prop.type === NodeTypes.DIRECTIVE &&
          prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
          prop.arg?.content === name),
    )
  }
}

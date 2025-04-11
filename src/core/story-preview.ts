import {
  babelParse,
  generateTransform,
  MagicStringAST,
  parseSFC,
  resolveIdentifier,
  resolveLiteral,
  resolveString,
  type CodeTransform,
  type walkAST,
} from '@vue-macros/common'
import {
  extractIdentifiers,
  walkIdentifiers,
  type SFCScriptBlock,
  type SFCTemplateBlock,
} from 'vue/compiler-sfc'
import { extractMeta } from './transform'
import type {
  Identifier,
  ImportSpecifier,
  ObjectExpression,
  ObjectProperty,
  Program,
  VariableDeclaration,
  VariableDeclarator,
} from '@babel/types'
import type { ElementNode } from '@vue/compiler-core'

type TransformHandler = (ctx: {
  code: string
  s: MagicStringAST
  template: SFCTemplateBlock | null
  scriptSetupAst: Program | undefined
  meta: string | undefined
  offset: number
}) => void

const defineHandler = (handler: TransformHandler) => handler

export function transform(code: string, id: string): CodeTransform | undefined {
  const { meta, trimmedCode } = extractMeta(code, id)

  const { template, getSetupAst, offset } = parseSFC(trimmedCode, id)

  const scriptSetupAst = getSetupAst()

  const s = new MagicStringAST(trimmedCode)

  const handlers = [
    attachArgsToTemplate,
    handleStoriesBlock,
    // handleReusableTemplates,
  ]

  handlers.forEach((handler) =>
    handler({ code, s, template, scriptSetupAst, meta, offset }),
  )

  return generateTransform(s, id)
}

const attachArgsToTemplate = defineHandler(
  ({ s, scriptSetupAst, meta, offset }) => {
    // Script setup: Attach args to template
    if (scriptSetupAst) {
      const metaCode = `const __meta = ${meta ?? '{}'}`
      const ast = babelParse(metaCode)

      const argsAst = (
        (
          (ast.body[0] as VariableDeclaration)
            .declarations[0] as VariableDeclarator
        ).init as ObjectExpression
      ).properties.find(
        (property): property is ObjectProperty =>
          ((property as ObjectProperty).key as Identifier)?.name === 'args',
      )?.value as ObjectExpression | undefined

      if (!argsAst) return

      const args = metaCode.slice(argsAst.start!, argsAst.end!)

      s.appendRight(
        scriptSetupAst.loc!.end.index + offset,
        `\n\nconst args = ${args}\n`,
      )
    }
  },
)

const handleStoriesBlock = defineHandler(({ s, template }) => {
  if (template && template.ast) {
    const rootNode = template.ast.children[0] as ElementNode

    // Unwrap <Stories> block
    const storiesBlockStartStart = rootNode.loc.start.offset
    const storiesBlockStartEnd = rootNode.children[0].loc.start.offset - 1

    const storiesBlockEndStart =
      (rootNode.children.at(-1) ?? rootNode.children[0]).loc.end.offset + 1
    const storiesBlockEndEnd = rootNode.loc.end.offset

    s.remove(storiesBlockStartStart, storiesBlockStartEnd)
    s.remove(storiesBlockEndStart, storiesBlockEndEnd)

    // Remove other <Story> blocks and only leave the first one
    const storyBlocks = rootNode.children.filter(
      (child): child is ElementNode =>
        child.type === 1 && child.tag === 'Story',
    )

    storyBlocks.forEach((block, index) => {
      if (index === 0) return
      s.remove(block.loc.start.offset, block.loc.end.offset)
    })

    // Unwrap <Story> block
    const storyBlock = storyBlocks[0]
    const storyBlockStartStart = storyBlock.loc.start.offset
    const storyBlockStartEnd =
      (storyBlock.children.at(-1) ?? storyBlock.children[0]).loc.start.offset -
      1

    const storyBlockEndStart =
      (storyBlock.children.at(-1) ?? storyBlock.children[0]).loc.end.offset + 1
    const storyBlockEndEnd = storyBlock.loc.end.offset

    s.remove(storyBlockStartStart, storyBlockStartEnd)
    s.remove(storyBlockEndStart, storyBlockEndEnd)

    // Format the template
  }
})

const handleReusableTemplates = defineHandler(
  ({ s, template, scriptSetupAst, offset }) => {
    if (scriptSetupAst) {
      // Remove import
      const imports = scriptSetupAst.body.filter(
        (node) => node.type === 'ImportDeclaration',
      )

      const vueuseImport = imports.find(
        (i) => i.source.value === '@vueuse/core',
      )

      if (vueuseImport) {
        const createReusableTemplateIdentifier = vueuseImport?.specifiers.find(
          (i): i is ImportSpecifier =>
            i.type === 'ImportSpecifier' &&
            ((i.imported.type === 'Identifier' &&
              i.imported.name === 'createReusableTemplate') ||
              (i.imported.type === 'StringLiteral' &&
                i.imported.value === 'createReusableTemplate')),
        )

        if (createReusableTemplateIdentifier) {
          if (vueuseImport.specifiers.length > 1) {
            s.remove(
              createReusableTemplateIdentifier.loc!.start.index + offset,
              createReusableTemplateIdentifier.loc!.end.index + offset,
            )
          } else {
            s.remove(
              vueuseImport.loc!.start.index + offset,
              vueuseImport.loc!.end.index + offset,
            )
          }
        }
      }

      console.log(extractIdentifiers(vueuseImport!))

      // Remove declaration
    }
    if (template) {
      // Move contents in template to story
    }
    console.log(resolveString('DefineCounterStory'))
  },
)

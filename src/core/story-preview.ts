import { existsSync } from 'node:fs'
import { cwd } from 'node:process'
import {
  isFunctionDeclaration,
  isImportDeclaration,
  isVariableDeclaration,
  type Identifier,
  type ImportSpecifier,
  type ObjectExpression,
  type ObjectProperty,
  type Program,
  type VariableDeclaration,
  type VariableDeclarator,
} from '@babel/types'
import {
  babelParse,
  generateTransform,
  MagicStringAST,
  parseSFC,
  resolveString,
  walkAST,
  type CodeTransform,
} from '@vue-macros/common'
import { Linter } from 'eslint'
import { format } from 'prettier'
import { parse } from 'postcss'
import {
  extractIdentifiers,
  type SFCStyleBlock,
  type SFCTemplateBlock,
} from 'vue/compiler-sfc'
import { extractMeta } from './transform'
import type { ElementNode } from '@vue/compiler-core'

type TransformHandler = (ctx: {
  code: string
  s: MagicStringAST
  template: SFCTemplateBlock | null
  scriptSetupAst: Program | undefined
  scriptAst: Program | undefined
  meta: string | undefined
  offset: number
  scriptOffset: number | undefined
}) => void

const defineHandler = (handler: TransformHandler) => handler

const isUnunsedVar = (msg: Linter.LintMessage) =>
  msg.messageId === 'unusedVar' &&
  /'(.+?)'\s.*\s?never used/.exec(msg.message) &&
  !msg.fix
const isUnusedSelector = (msg: Linter.LintMessage) =>
  msg.messageId === 'unused' &&
  msg.ruleId?.includes('no-unused-selector') &&
  !msg.fix

/**
 * Transforms `*.stories.vue` Storybook Stories SFC file into a linted and formatted `*.vue` Vue component preview taken from the default story.
 */
export async function transform(
  code: string,
  id: string,
): Promise<CodeTransform | undefined> {
  const { meta, trimmedCode } = extractMeta(code, id)

  const { template, getSetupAst, getScriptAst, offset, script, styles } =
    parseSFC(trimmedCode, id)

  const scriptOffset = script ? trimmedCode.indexOf(script.content) : undefined

  const scriptSetupAst = getSetupAst()

  const scriptAst = getScriptAst()

  const s = new MagicStringAST(trimmedCode)

  const handlers = [
    inlineArgsToTemplate,
    handleStoriesBlock,
    handleReusableTemplates,
    cleanUp,
  ]

  handlers.forEach((handler) =>
    handler({
      code,
      s,
      template,
      scriptSetupAst,
      scriptAst,
      meta,
      offset,
      scriptOffset,
    }),
  )

  const linter = new Linter({ cwd: cwd() })

  const finder = ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts']

  const ext = finder.find((ext) => existsSync(`${cwd()}/eslint.config.${ext}`))

  const config = ext
    ? await (
        await import(`${cwd()}/eslint.config.${ext}`)
      ).default
    : undefined

  const lint = () =>
    linter.verify(
      generateTransform(s, id)?.code ?? '',
      config,
      `sourceCode.vue`,
    )

  let messages: Linter.LintMessage[] = []

  const deletedSpecifiers = new Map<string, ImportSpecifier[]>()

  do {
    messages = lint().filter(
      (msg) => isUnunsedVar(msg) || isUnusedSelector(msg),
    )
    if (messages.length === 0) break

    tryFixUnused(
      messages,
      s,
      scriptAst,
      scriptSetupAst,
      styles,
      offset,
      deletedSpecifiers,
      scriptOffset,
    )
  } while (messages.length > 0)

  const cleaned = generateTransform(s, id)!

  const { output } = linter.verifyAndFix(
    cleaned?.code ?? '',
    config,
    `sourceCode.vue`,
  )

  return {
    ...cleaned,
    code: await format(output, {
      filename: 'sourceCode.vue',
      parser: 'vue',
      printWidth: 120,
      tabWidth: 2,
      useTabs: false,
      bracketSameLine: true,
    }),
  }
}

const inlineArgsToTemplate = defineHandler(
  ({ s, scriptSetupAst, template, meta }) => {
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

      // const args = metaCode.slice(argsAst.start!, argsAst.end!)
      const argsMap = new Map<string, ObjectProperty['value']>()
      for (const prop of argsAst.properties) {
        if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
          argsMap.set(prop.key.name, prop.value)
        }
      }

      if (!template) return

      const templateContent = template.content
      const regex = /(?:\{\{)?\s*args\.(\w+)\s*(?:\}\})?/g
      let match: RegExpExecArray | null

      while ((match = regex.exec(templateContent)) !== null) {
        const [fullMatch, propName] = match
        const value = argsMap.get(propName)

        if (value !== undefined) {
          const start = template.loc.start.offset + match.index
          const end = start + fullMatch.length

          const valueString = metaCode.slice(
            value.loc!.start.index,
            value.loc!.end.index,
          )

          const isString = /^['"`].*['"`]$/.test(valueString)

          const isInTemplateInterpolation =
            fullMatch.startsWith('{{') && fullMatch.endsWith('}}')

          s.overwrite(
            start,
            end,
            isString && isInTemplateInterpolation
              ? valueString.slice(1, -1)
              : isInTemplateInterpolation
                ? `{{ ${valueString} }}`
                : valueString,
          )
        }
      }
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
  }
})

const handleReusableTemplates = defineHandler(
  ({ s, template, scriptSetupAst, offset, code }) => {
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
      // Get define and use identifiers of `createReusableTemplate`
      const reusableTemplateDeclarations = scriptSetupAst.body.filter(
        (node) =>
          node.type === 'VariableDeclaration' &&
          node.declarations.some(
            (decl) =>
              decl.init &&
              decl.init.type === 'CallExpression' &&
              decl.init.callee.type === 'Identifier' &&
              decl.init.callee.name === 'createReusableTemplate',
          ),
      ) as VariableDeclaration[]

      if (!reusableTemplateDeclarations.length) return

      reusableTemplateDeclarations.forEach((reusableTemplateDeclaration) => {
        // Remove `createReusableTemplate` declaration
        s.remove(
          reusableTemplateDeclaration.loc!.start.index + offset,
          reusableTemplateDeclaration.loc!.end.index + offset,
        )

        const defineIdentifier = (
          reusableTemplateDeclaration.declarations[0].id.type === 'ArrayPattern'
            ? reusableTemplateDeclaration.declarations[0].id.elements[0]
            : null
        ) as Identifier | null

        const useIdentifier = (
          reusableTemplateDeclaration.declarations[0].id.type === 'ArrayPattern'
            ? reusableTemplateDeclaration.declarations[0].id.elements[1]
            : null
        ) as Identifier | null

        // Remove define identifier in template and only leave its children
        if (defineIdentifier && template && template.ast) {
          const rootNode = template.ast.children[0] as ElementNode

          const defineNode = rootNode.children.find(
            (child) =>
              child.type === 1 &&
              child.tag === resolveString(defineIdentifier.name),
          ) as ElementNode | undefined

          if (defineNode) {
            const defineNodeStart = defineNode.loc.start.offset
            const defineNodeEnd = defineNode.loc.end.offset

            const defineNodeChildrenStart =
              defineNode.children[0].loc.start.offset
            const defineNodeChildrenEnd =
              defineNode.children.at(-1)?.loc.end.offset ??
              defineNode.loc.end.offset

            s.remove(defineNodeStart, defineNodeChildrenStart)
            s.remove(defineNodeChildrenEnd, defineNodeEnd)

            if (!useIdentifier) return

            const storyNode = rootNode.children?.find(
              (child) => child.type === 1 && child.tag === 'Story',
            ) as ElementNode | undefined

            const useNode = storyNode?.children.find(
              (c) =>
                c.type === 1 && c.tag === resolveString(useIdentifier.name),
            ) as ElementNode | undefined

            if (useNode) {
              const useNodeStart = useNode.loc.start.offset
              const useNodeEnd = useNode.loc.end.offset
              const useNodeAttrsStart = useNode.props.at(0)?.loc.start.offset
              const useNodeAttrsEnd = useNode.props.at(-1)?.loc.end.offset

              const useNodeChildrenStart =
                useNode.children.at(0)?.loc.start.offset
              const useNodeChildrenEnd = useNode.children.at(-1)?.loc.end.offset

              const firstChild = defineNode.children.find((c) => c.type === 1)

              const firstChildStart = firstChild?.loc.start.offset

              const firstChildBindProp = firstChild?.props.find(
                (prop) => prop.type === 7 && prop.rawName === 'v-bind',
              )

              if (firstChildBindProp) {
                s.remove(
                  firstChildBindProp.loc.start.offset,
                  firstChildBindProp.loc.end.offset,
                )
              }

              const firstChildChildrenEnd = firstChild?.children.findLast(
                (c) => c.type === 1,
              )?.loc.end.offset

              if (
                useNodeChildrenStart &&
                useNodeChildrenEnd &&
                firstChildChildrenEnd
              ) {
                s.move(
                  useNodeChildrenStart - 1,
                  useNodeChildrenEnd,
                  firstChildChildrenEnd,
                )

                // go through slots in eacg use node and define node and remove duplicates
                firstChild.children.forEach((node) => {
                  if (node.type === 1 && node.tag === 'template') {
                    const slotNameAttr = node.props.find(
                      (prop) => prop.type === 7 && prop.name === 'slot',
                    )

                    if (slotNameAttr) {
                      const slotName =
                        slotNameAttr.type === 7 &&
                        slotNameAttr.name === 'slot' &&
                        slotNameAttr.arg?.type === 4
                          ? slotNameAttr.arg.content
                          : 'default'

                      const correspondingDefineSlot = useNode.children.find(
                        (child) =>
                          child.type === 1 &&
                          child.tag === 'template' &&
                          child.props.some(
                            (prop) =>
                              prop.type === 7 &&
                              prop.name === 'slot' &&
                              prop.arg?.type === 4 &&
                              prop.arg.content === slotName,
                          ),
                      )

                      if (correspondingDefineSlot) {
                        // Remove the slot from useNode
                        s.remove(node.loc.start.offset, node.loc.end.offset)
                      }
                    }
                  }
                })
              }

              if (
                useNodeAttrsStart &&
                useNodeAttrsEnd &&
                firstChild &&
                firstChildStart
              ) {
                s.move(
                  useNodeAttrsStart - 1,
                  useNodeAttrsEnd,
                  firstChildStart + firstChild.tag.length + 1,
                )

                // go through props in eacg use node and define node and remove duplicates
                firstChild.props.forEach((prop) => {
                  if (prop.type === 7 && prop.name === 'bind') {
                    const bindArg = prop.arg
                    if (bindArg && bindArg.type === 4) {
                      const correspondingDefineBind = useNode.props.find(
                        (p) =>
                          p.type === 7 &&
                          p.name === 'bind' &&
                          p.arg?.type === 4 &&
                          p.arg.content === bindArg.content,
                      )

                      if (correspondingDefineBind) {
                        // Remove the bind from useNode
                        s.remove(prop.loc.start.offset, prop.loc.end.offset)
                      }
                    }
                  }
                })
              }

              // Remove useNode entirely if still present
              if (
                useNodeAttrsStart &&
                useNodeAttrsEnd &&
                useNodeChildrenStart &&
                useNodeChildrenEnd
              ) {
                s.remove(useNodeStart, useNodeAttrsStart - 1)
                s.remove(useNodeAttrsEnd, useNodeChildrenStart - 1)
                s.remove(useNodeChildrenEnd, useNodeEnd)
              } else if (useNodeAttrsStart && useNodeAttrsEnd) {
                s.remove(useNodeStart, useNodeAttrsStart - 1)
                s.remove(useNodeAttrsEnd, useNodeEnd)
              } else if (useNodeChildrenStart && useNodeChildrenEnd) {
                s.remove(useNodeStart, useNodeChildrenStart - 1)
                s.remove(useNodeChildrenEnd, useNodeEnd)
              } else {
                s.remove(useNodeStart, useNodeEnd)
              }
            } else {
              s.remove(defineNodeStart, defineNodeEnd)
            }
          }
        }
      })
    }
  },
)

const cleanUp = defineHandler(
  ({ s, scriptSetupAst, scriptAst, offset, scriptOffset }) => {
    // remove comments
    ;[
      [scriptAst, scriptOffset] as const,
      [scriptSetupAst, offset] as const,
    ].forEach(([ast, offset]) => {
      if (!ast) return
      walkAST(ast, {
        enter: (node) => {
          ;[
            node.leadingComments,
            node.trailingComments,
            node.innerComments,
          ].forEach((comments) => {
            if (comments) {
              comments.forEach((comment) => {
                s.remove(
                  comment.loc!.start.index! + (offset ?? 0),
                  comment.loc!.end.index! + (offset ?? 0),
                )
              })
            }
          })
        },
      })
    })
  },
)

const tryFixUnused = (
  messages: Linter.LintMessage[],
  s: MagicStringAST,
  scriptAst: Program | undefined,
  scriptSetupAst: Program | undefined,
  styles: SFCStyleBlock[] | undefined,
  offset: number,
  deletedSpecifiers: Map<string, ImportSpecifier[]>,
  scriptOffset?: number,
) => {
  const unusedVars = messages.filter(isUnunsedVar)
  const ids: string[] = []
  unusedVars.forEach((msg) => {
    const match = /'(.+?)'\s.*\s?never used/.exec(msg.message)
    if (match) {
      ids.push(match[1])
    }
  })
  ;[
    [scriptAst, scriptOffset] as const,
    [scriptSetupAst, offset] as const,
  ].forEach(([ast, offset], t) => {
    if (!ast) return

    ast.body.forEach((node, i) => {
      if (isImportDeclaration(node)) {
        node.specifiers.forEach((specifier) => {
          if (specifier.type === 'ImportSpecifier') {
            const id = specifier.local
            if (ids.includes(id.name)) {
              if (
                node.specifiers.length -
                  (deletedSpecifiers.get(`${t}${i}`)?.length ?? 0) <=
                1
              ) {
                if ((deletedSpecifiers.get(`${t}${i}`)?.length ?? 0) > 0) {
                  // restore previously deleted specifiers
                  deletedSpecifiers
                    .get(`${t}${i}`)!
                    .forEach((deletedSpecifier) => {
                      s.reset(
                        deletedSpecifier.loc!.start.index + (offset ?? 0),
                        deletedSpecifier.loc!.end.index + (offset ?? 0),
                      )
                    })
                  deletedSpecifiers.set(`${t}${i}`, [])
                }
                s.remove(
                  node.loc!.start.index + (offset ?? 0),
                  node.loc!.end.index + (offset ?? 0),
                )
              } else {
                deletedSpecifiers.set(`${t}${i}`, [
                  ...(deletedSpecifiers.get(`${t}${i}`) ?? []),
                  specifier,
                ])

                s.remove(
                  specifier.loc!.start.index + (offset ?? 0),
                  specifier.loc!.end.index + (offset ?? 0),
                )
              }
            }
          } else if (
            specifier.type === 'ImportDefaultSpecifier' ||
            specifier.type === 'ImportNamespaceSpecifier'
          ) {
            const id = specifier.local
            if (ids.includes(id.name)) {
              s.remove(
                node.loc!.start.index + (offset ?? 0),
                node.loc!.end.index + (offset ?? 0),
              )
            }
          }
        })
      } else if (isVariableDeclaration(node)) {
        node.declarations.forEach((declarator) => {
          if (declarator.id.type === 'Identifier') {
            const id = declarator.id
            if (ids.includes(id.name)) {
              if (node.declarations.length === 1) {
                s.remove(
                  node.loc!.start.index + (offset ?? 0),
                  node.loc!.end.index + (offset ?? 0),
                )
              } else
                s.remove(
                  declarator.loc!.start.index + (offset ?? 0),
                  declarator.loc!.end.index + (offset ?? 0),
                )
            }
          } else {
            const extractedIds = extractIdentifiers(declarator.id)
            extractedIds.forEach((id) => {
              if (ids.includes(id.name)) {
                s.remove(
                  id.loc!.start.index + (offset ?? 0),
                  id.loc!.end.index + (offset ?? 0),
                )
              }
            })
          }
        })
      } else if (
        isFunctionDeclaration(node) &&
        node.id &&
        ids.includes(node.id.name)
      ) {
        s.remove(
          node.loc!.start.index + (offset ?? 0),
          node.loc!.end.index + (offset ?? 0),
        )
      }
    })
  })

  const unusedSelectors = messages.filter(isUnusedSelector)

  if (!unusedSelectors.length) return

  const stylesAsts = styles?.map((style) => ({
    block: style,
    ast: parse(style.content),
  }))

  const list = unusedSelectors
    .map((msg) => /`(.*)`/.exec(msg.message)?.[1])
    .filter(Boolean) as string[]

  stylesAsts?.forEach(({ block, ast }) => {
    ast.walkRules((rule) => {
      if (
        list.includes(rule.selector) &&
        rule.source?.start &&
        rule.source.end
      ) {
        s.remove(
          block.loc.start.offset + rule.source.start.offset,
          block.loc.start.offset + rule.source.end.offset,
        )
      }
    })
  })
}

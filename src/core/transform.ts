import {
  traverse,
  type ArrayExpression,
  type ArrowFunctionExpression,
  type CallExpression,
  type ExportNamedDeclaration,
  type ExpressionStatement,
  type FunctionDeclaration,
  type Identifier,
  type ImportDeclaration,
  type ImportSpecifier,
  type ObjectExpression,
  type ObjectMethod,
  type ObjectProperty,
  type Program,
  type ReturnStatement,
  type SequenceExpression,
  type StringLiteral,
  type VariableDeclaration,
} from '@babel/types'

import { compile as compileMdx } from '@storybook/mdx2-csf'

import {
  babelParse,
  generateTransform,
  MagicStringAST,
  parseSFC,
  type CodeTransform,
} from '@vue-macros/common'
import { format as prettierFormat } from 'prettier'
import {
  compileScript,
  compileTemplate,
  rewriteDefault,
  type SFCScriptBlock,
} from 'vue/compiler-sfc'
import { parse } from './parser'
import { transformSuperMeta } from './super-meta'
import { toCamelCase } from './utils'
import type { ParsedMeta, ParsedStory } from './types'
import type { ParserPlugin } from '@babel/parser'
import type { BindingMetadata, ElementNode } from '@vue/compiler-core'

export async function transformSuperVue({
  stories,
  id,
  additionalMeta,
  scriptBindings,
}: {
  stories: string
  id: string
  additionalMeta?: string
  scriptBindings: BindingMetadata | undefined
}): Promise<string | CodeTransform | undefined> {
  if (!stories) return stories

  const ast = babelParse(stories)

  const s = new MagicStringAST(stories)

  transformMeta({ ast, s, additionalMeta })

  // Change the import createBlock -> createVNode, createElementBlock -> createElementVNode
  const vueImport = ast.body.find(
    (node): node is ImportDeclaration =>
      node.type === 'ImportDeclaration' &&
      node.source.value === 'vue' &&
      node.specifiers.some(
        (specifier) =>
          specifier.type === 'ImportSpecifier' &&
          ['createBlock', 'createElementBlock'].includes(
            (specifier.imported as Identifier).name,
          ),
      ),
  )
  const createBlockSpecifier = vueImport?.specifiers.find(
    (specifier): specifier is ImportSpecifier =>
      specifier.type === 'ImportSpecifier' &&
      (specifier.imported as Identifier).name === 'createBlock',
  )?.imported
  const createElementBlockSpecifier = vueImport?.specifiers.find(
    (specifier): specifier is ImportSpecifier =>
      specifier.type === 'ImportSpecifier' &&
      (specifier.imported as Identifier).name === 'createElementBlock',
  )?.imported

  if (createBlockSpecifier) s.overwriteNode(createBlockSpecifier, 'createVNode')

  if (createElementBlockSpecifier)
    s.overwriteNode(createElementBlockSpecifier, 'createElementVNode')

  // Change each story export function to export object
  const storiesExports = ast.body.filter(
    (node) => node.type === 'ExportNamedDeclaration',
  )

  const bindings = new Set<string>()
  await Promise.all(
    storiesExports.map((node) =>
      transformStory(node, s, ast, stories, bindings),
    ),
  )

  hoistBindings({ scriptBindings, bindings, ast, s, stories })

  const t = generateTransform(s, id)

  return t
}

/**
 * Moves any bindings used inside the story template to the outside of setup context so that they can be assigned into `args`
 */
function hoistBindings({
  scriptBindings,
  bindings,
  ast,
  s,
  stories,
}: {
  scriptBindings: BindingMetadata | undefined
  stories: string
  bindings: Set<string>
  ast: ReturnType<typeof babelParse>
  s: MagicStringAST
}) {
  const toHoist = Object.fromEntries(
    Object.entries(scriptBindings ?? {})?.filter(
      ([, binding]) => typeof binding === 'string' && binding.endsWith('const'),
    ),
  )

  bindings.forEach((binding) => {
    if (!Object.keys(toHoist).includes(binding))
      throw new Error(
        `[unplugin-super-vue]: Binding "${binding}" is not primitive and cannot be used as a story arg.`,
      )
  })

  const _sfc_main = ast.body.find(
    (node): node is VariableDeclaration =>
      node.type === 'VariableDeclaration' &&
      node.declarations[0].id.type === 'Identifier' &&
      node.declarations[0].id.name === '_sfc_main' &&
      node.declarations[0].init?.type === 'CallExpression' &&
      node.declarations[0].init.arguments[0].type === 'ObjectExpression' &&
      node.declarations[0].init.arguments[0].properties.some(
        (prop): prop is ObjectMethod =>
          prop.type === 'ObjectMethod' &&
          prop.key.type === 'Identifier' &&
          prop.key.name === 'setup',
      ),
  )

  if (!_sfc_main) return

  const setupChildren = (
    (
      (_sfc_main?.declarations[0].init as CallExpression)
        ?.arguments[0] as ObjectExpression
    ).properties[0] as ObjectMethod
  ).body.body.filter(
    (node): node is VariableDeclaration =>
      node.type === 'VariableDeclaration' &&
      node.declarations.some(
        (decl) =>
          decl.id.type === 'Identifier' &&
          Object.keys(toHoist).includes(decl.id.name),
      ),
  )

  setupChildren.reverse().forEach((node) => {
    s.prependLeft(
      _sfc_main.start!,
      `${stories.slice(node.start!, node.end!)}\n`,
    )
  })
}

/**
 * Transforms the stories meta with description, designId, cssVars, additional meta etc.
 */
function transformMeta({
  ast,
  s,
  additionalMeta,
}: {
  ast: ReturnType<typeof babelParse>
  s: MagicStringAST
  additionalMeta?: string
}) {
  const meta = ast.body.find((node) => node.type === 'ExportDefaultDeclaration')

  if (meta?.declaration.type !== 'ObjectExpression') return

  const componentExportName = (
    meta.declaration.properties.find(
      (node): node is ObjectProperty =>
        node.type === 'ObjectProperty' &&
        node.key.type === 'Identifier' &&
        node.key.name === 'component',
    )?.value as Identifier
  ).name

  const parameters = meta.declaration.properties.find(
    (node): node is ObjectProperty =>
      node.type === 'ObjectProperty' &&
      node.key.type === 'Identifier' &&
      node.key.name === 'parameters',
  )

  const title = meta.declaration.properties.find(
    (node): node is ObjectProperty =>
      node.type === 'ObjectProperty' &&
      node.key.type === 'Identifier' &&
      node.key.name === 'title',
  )

  if (!parameters || !title) return

  const modelsArgTypes = `{ argTypes: ${componentExportName}.__docgenInfo.events?.filter(event => event.name.startsWith('update:')).reduce((acc, { name }) => ({ ...acc, [name.replace('update:', '')]: { description: ${componentExportName}.models?.find(model => model.name === name.replace('update:', ''))?.description, table: { category: 'models', defaultValue: { summary: ${componentExportName}.models?.find(model => model.name === name.replace('update:', ''))?.default } } }, [name]: { table: { disable: true } } }), {}) },`
  const slotsArgTypes = `{ argTypes: ${componentExportName}.__docgenInfo.slots?.reduce((acc, { name }) => ({ ...acc, [name]: { control: 'text', type: 'VNode[]' } }), {}) },`
  const removeTrashArgTypes = `{ argTypes: { $: { table: { disable: true } }, $slots: { table: { disable: true } } } },`

  const params = `
    docs: { description: { component: ${componentExportName}.description } },
    design: { type: '${designType}', url: ${componentExportName}.getUrl(${componentExportName}.designId)} },
    cssprops: ${componentExportName}.cssVars?.reduce((acc, { key, value, type, description }) => ({
            ...acc,
            [key.slice(2)]: { value, type, description, control: "text" },
          }), {}),
    `

  // TODO: Make Experimental Indexers of `storybook-vue-addon` (not this vite plugin) pick category from component
  // const category = `\`\${${componentExportName}.category ?? ''}/${(title.value as StringLiteral).value}\``

  s.prependLeft(0, `import deepmerge from 'deepmerge';\n`)
  s.append(`console.log(${componentExportName})\n`)
  s.prependLeft(meta.start! + 15, `deepmerge.all([`)
  s.prependLeft(
    meta.end! - 1,
    `, ${[modelsArgTypes, slotsArgTypes, removeTrashArgTypes, additionalMeta].join('\n')}])`,
  )
  // s.prependRight(meta.end! - 2, [testControl, additionalMeta?.slice(1, -1)].filter(block => !!block).join(',\n'))
  s.prependRight(parameters.end! - 1, params)
  // s.overwriteNode(title.value, category)./.storybook/super-vue
}

async function transformStory(
  node: ExportNamedDeclaration,
  s: MagicStringAST,
  ast: ReturnType<typeof babelParse>,
  stories: string,
  bindings: Set<string>,
) {
  if (node.declaration?.type !== 'VariableDeclaration') return

  if (
    node.declaration.declarations[0].type !== 'VariableDeclarator' ||
    node.declaration.declarations[0].id.type !== 'Identifier'
  ) {
    return
  }

  const storyId = node.declaration.declarations[0].id.name

  // Format/transform source code
  await formatSourceCode({ ast, node, s, storyId })

  // Turn arrow function into object and call render function
  const arrowFn = node.declaration.declarations[0]
    .init as ArrowFunctionExpression
  const renderStoryId = (
    ((arrowFn.body as CallExpression).arguments[0] as ObjectExpression)
      .properties[0] as ObjectProperty
  ).value as Identifier

  const renderFn = ast.body.find(
    (node): node is FunctionDeclaration =>
      node.type === 'FunctionDeclaration' &&
      node.id?.name === renderStoryId.name,
  )
  if (!renderFn) return

  const { renderReturnTransformed, renderReturnArgsStrCamel } =
    transformRenderReturnFn({ renderFn, stories, bindings })

  s.overwriteNode(
    arrowFn,
    `{ render: ${renderStoryId.name}(), args: { ${renderReturnArgsStrCamel} } }`,
  )

  s.overwriteNode(
    renderFn,
    `function ${renderStoryId.name}(){
    return (args) => {
      return { setup: (_setup_props, _setup_ctx) => {
        const $setup = _sfc_main.setup(_setup_props, _setup_ctx)
        return () => (${renderReturnTransformed})
      }}
    }
  }`,
  )
}

/**
 * Transforms the render function return value of the story
 * @example `(_openBlock(), _createElementBlock(...))`
 */
function transformRenderReturnFn({
  renderFn,
  stories,
  bindings,
}: {
  stories: string
  renderFn: FunctionDeclaration
  bindings: Set<string>
}) {
  const renderReturnAst = renderFn.body.body.find(
    (node): node is ReturnStatement => node.type === 'ReturnStatement',
  )?.argument as SequenceExpression
  const renderReturnStr = stories.slice(
    renderReturnAst.start!,
    renderReturnAst.end!,
  )

  const secondCallExpression = renderReturnAst.expressions[1] as CallExpression

  let renderReturnArgsAst: ObjectExpression | undefined

  const controllableIndex = 1 // TODO: dynamic - auto determine controllable index

  // If single child
  if (
    secondCallExpression.callee.type === 'Identifier' &&
    secondCallExpression.callee.name === '_createBlock'
  ) {
    renderReturnArgsAst = secondCallExpression?.arguments[1] as ObjectExpression
  }

  // If multiple children
  else if (
    secondCallExpression.callee.type === 'Identifier' &&
    secondCallExpression.callee.name === '_createElementBlock'
  ) {
    renderReturnArgsAst = (
      (secondCallExpression.arguments[2] as ArrayExpression).elements[
        controllableIndex
      ] as CallExpression
    ).arguments[1] as ObjectExpression
  }

  if (!renderReturnArgsAst)
    return {
      renderReturnTransformed: renderReturnStr,
      renderReturnArgsStrCamel: '',
    }

  const renderReturnArgsStr = stories.slice(
    renderReturnArgsAst.start!,
    renderReturnArgsAst.end!,
  )

  const { renderReturnArgsStrReplace, renderReturnArgsStrCamel } =
    renderReturnArgsAst.properties?.reduce(
      (acc, prop) => {
        const key =
          ((prop as ObjectProperty).key as StringLiteral).value ??
          ((prop as ObjectProperty).key as Identifier).name

        const value = stories
          .slice(
            (prop as ObjectProperty).value.start!,
            (prop as ObjectProperty).value.end!,
          )
          .replaceAll('$setup.', '')

        return {
          renderReturnArgsStrReplace: `${acc.renderReturnArgsStrReplace}'${key}': args.${toCamelCase(key)},`,
          renderReturnArgsStrCamel: `${acc.renderReturnArgsStrCamel}${toCamelCase(key)}: ${value},`,
        }
      },
      { renderReturnArgsStrReplace: '', renderReturnArgsStrCamel: '' },
    ) ?? { renderReturnArgsStrReplace: '', renderReturnArgsStrCamel: '' }

  // plug the args into props
  const renderReturnArgsStrWithArgs = renderReturnArgsStr.replace(
    renderReturnArgsStr,
    `{ ${renderReturnArgsStrReplace} }`,
  )
  // remove args from function signature and move to proper function setting
  const renderReturnStrWithoutSetup = renderReturnStr.replace(
    renderReturnArgsStr,
    renderReturnArgsStrWithArgs,
  )

  // remove `_ctx` to link to args: `_ctx.args.myProp` -> `args.myProp`
  const renderReturnStrWithoutSetupAndWithArgs =
    renderReturnStrWithoutSetup.replaceAll('_ctx.', '')

  // Get all bindings of the render function
  traverse(renderReturnArgsAst, {
    enter(node) {
      if (
        node.type === 'MemberExpression' &&
        node.object.type === 'Identifier' &&
        node.object.name === '$setup' &&
        node.property.type === 'Identifier'
      ) {
        bindings.add(node.property.name)
      }
    },
  })

  return {
    renderReturnTransformed: renderReturnStrWithoutSetupAndWithArgs,
    renderReturnArgsStrCamel,
    bindings,
  }
}

/**
 * Formats the source code in story (`story.parameters.docs.source.code`)
 */
async function formatSourceCode({
  ast,
  s,
  storyId,
}: {
  ast: Program
  node: ExportNamedDeclaration
  s: MagicStringAST
  storyId: string
}) {
  const storyParameters = ast.body.find(
    (child): child is ExpressionStatement =>
      child.type === 'ExpressionStatement' &&
      child.expression.type === 'AssignmentExpression' &&
      child.expression.left.type === 'MemberExpression' &&
      child.expression.left.object.type === 'Identifier' &&
      child.expression.left.object.name === storyId &&
      child.expression.left.property.type === 'Identifier' &&
      child.expression.left.property.name === 'parameters',
  )

  if (
    !storyParameters ||
    storyParameters.expression.type !== 'AssignmentExpression'
  )
    return

  const sourceCode = (() => {
    if (
      storyParameters.expression.right.type !== 'ObjectExpression' ||
      storyParameters.expression.right.properties[0].type !==
        'ObjectProperty' ||
      storyParameters.expression.right.properties[0].value.type !==
        'ObjectExpression' ||
      storyParameters.expression.right.properties[0].value.properties[0]
        .type !== 'ObjectProperty' ||
      storyParameters.expression.right.properties[0].value.properties[0].value
        .type !== 'ObjectExpression' ||
      storyParameters.expression.right.properties[0].value.properties[0].value
        .properties[0].type !== 'ObjectProperty' ||
      storyParameters.expression.right.properties[0].value.properties[0].value
        .properties[0].value.type !== 'TemplateLiteral'
    ) {
      return
    }

    return storyParameters.expression.right.properties[0].value.properties[0]
      .value.properties[0].value.quasis[0]
  })()

  if (!sourceCode) return

  const sourceCodeStr = sourceCode.value.raw

  const sourceCodeFormatted = await prettierFormat(
    `<template>${sourceCodeStr}</template>`,
    {
      filename: 'sourceCode.vue',
      parser: 'vue',
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      bracketSameLine: true,
    },
  )

  s.overwriteNode(sourceCode, sourceCodeFormatted)
}

export function extractMeta(
  code: string,
  id: string,
):
  | {
      meta: undefined
      trimmedCode: string
      scriptBindings: BindingMetadata | undefined
    }
  | {
      meta: string
      trimmedCode: string
      scriptBindings: BindingMetadata | undefined
    } {
  const { scriptSetup, getSetupAst, sfc } = parseSFC(code, id)

  const scriptBindings = compileScript(sfc.descriptor, { id }).bindings

  if (!code.includes('defineMeta'))
    return { meta: undefined, trimmedCode: code, scriptBindings }

  if (!scriptSetup)
    return { meta: undefined, trimmedCode: code, scriptBindings }

  const offset = scriptSetup.loc.start.offset
  const ast = getSetupAst()!

  const s = new MagicStringAST(code)

  const metaExpressionBlock = ast.body.find(
    (node) =>
      node.type === 'ExpressionStatement' &&
      node.expression.type === 'CallExpression' &&
      (node.expression.callee as Identifier).name === 'defineMeta',
  ) as ExpressionStatement | undefined
  const metaFromExpressionBlock = (
    metaExpressionBlock?.expression as CallExpression
  )?.arguments?.[0] as ObjectExpression | undefined

  const metaVariableDeclarationBlock = ast.body.find(
    (node) =>
      node.type === 'VariableDeclaration' &&
      node.declarations[0].init?.type === 'CallExpression' &&
      (node.declarations[0].init.callee as Identifier).name === 'defineMeta',
  ) as VariableDeclaration | undefined
  const metaFromVariableDeclarationBlock = (
    metaVariableDeclarationBlock?.declarations[0].init as CallExpression
  )?.arguments?.[0] as ObjectExpression | undefined

  const metaAst = metaFromExpressionBlock ?? metaFromVariableDeclarationBlock

  if (!metaAst) return { meta: undefined, trimmedCode: code, scriptBindings }

  s.remove(
    (metaExpressionBlock ?? metaVariableDeclarationBlock)!.start! + offset,
    (metaExpressionBlock ?? metaVariableDeclarationBlock)!.end! + offset,
  )

  const trimmedCode = s.toString()

  const meta = code.slice(metaAst.start! + offset, metaAst.end! + offset)

  return { meta, trimmedCode, scriptBindings }
}

/**
 * Inlines extra templates inside <Stories> component into each individual <Story> component
 */
export function transformExtraTemplates(
  code: string,
  id: string,
): string | CodeTransform | undefined {
  const { template } = parseSFC(code, id)

  if (!template) return code

  const root = template.ast?.children.find(
    (node): node is ElementNode => node.type === 1 && node.tag === 'Stories',
  )

  if (!root) return code

  const children = root?.children
    .filter((child) => child.type !== 3)
    .map((item, index) => [item, index] as const)

  const extras = children.filter(
    ([node]) => node.type !== 1 || node.tag !== 'Story',
  )
  const extrasCodes = extras.map(
    ([node, index]) =>
      [code.slice(node.loc.start.offset, node.loc.end.offset), index] as const,
  )

  const stories = children.filter(
    ([node]) => node.type === 1 && node.tag === 'Story',
  ) as (readonly [ElementNode, number])[]

  const s = new MagicStringAST(code)

  extras.forEach(([extra]) => {
    s.remove(extra.loc.start.offset, extra.loc.end.offset)
  })

  stories.forEach(([story, storyIndex]) => {
    const firstChild = story.children[0]
    const lastChild = story.children.at(-1)!

    ;[...extrasCodes].reverse().forEach(([extraCode, extraIndex]) => {
      if (storyIndex > extraIndex)
        s.prependLeft(firstChild.loc.start.offset, `${extraCode}\n`)
    })

    extrasCodes.forEach(([extraCode, extraIndex]) => {
      if (storyIndex < extraIndex)
        s.appendRight(lastChild.loc.end.offset, `\n${extraCode}`)
    })
  })

  const t = generateTransform(s, id)

  if (id.includes('Modal.stories.vue')) {
    // console.log(t?.code)
  }

  return t
}

/**
 * Transforms a vue single-file-component into Storybook's Component Story Format (CSF).
 */
export async function transform(
  code: string,
  id: string,
): Promise<string | CodeTransform | undefined> {
  if (id.endsWith('.vue')) {
    return transformSuperMeta(code, id)
  }

  const {
    meta: additionalMeta,
    trimmedCode,
    scriptBindings,
  } = extractMeta(code, id)

  const codeWithExtraTemplate = transformExtraTemplates(trimmedCode, id)

  let result = ''
  const { resolvedScript, meta, stories, docs } = parse(
    typeof codeWithExtraTemplate === 'string'
      ? codeWithExtraTemplate
      : (codeWithExtraTemplate?.code ?? trimmedCode),
  )
  const isTS = resolvedScript?.lang === 'ts'
  if (resolvedScript) {
    const babelPlugins: ParserPlugin[] = isTS ? ['typescript'] : []
    result += rewriteDefault(resolvedScript.content, '_sfc_main', babelPlugins)
    result += '\n'
  } else {
    result += 'const _sfc_main = {}\n'
  }
  result += await transformTemplate({ meta, stories, docs }, resolvedScript)
  result = await organizeImports(result, isTS)

  if (!result) return result

  return await transformSuperVue({
    stories: result,
    id,
    additionalMeta,
    scriptBindings,
  })
}

async function transformTemplate(
  {
    meta,
    stories,
    docs,
  }: { meta: ParsedMeta; stories: ParsedStory[]; docs?: string },
  resolvedScript?: SFCScriptBlock,
) {
  let result = generateDefaultImport(meta, docs)
  for (const story of stories) {
    result += generateStoryImport(story, resolvedScript)
  }
  if (docs) {
    let mdx = await compileMdx(docs, { skipCsf: true })
    mdx = mdx.replace('export default MDXContent;', '')
    result += mdx
  }
  return result
}

function generateDefaultImport(
  { title, component }: ParsedMeta,
  docs?: string,
) {
  return `export default {
    ${title ? `title: '${title}',` : ''}
    ${component ? `component: ${component},` : ''}
    //decorators: [ ... ],
    parameters: {
      ${docs ? `docs: { page: MDXContent },` : ''}
    }
  }
  `
}

function generateStoryImport(
  { id, title, play, template }: ParsedStory,
  resolvedScript?: SFCScriptBlock,
) {
  const { code } = compileTemplate({
    source: template.trim(),
    filename: 'test.vue',
    id: 'test',
    compilerOptions: {
      bindingMetadata: resolvedScript?.bindings,
      // prevent the hoisting of static variables since that would
      // result in clashing variable names when the same HTML Tags are used in multiple stories within the same `*.stories.vue` file.
      hoistStatic: false,
    },
  })

  // Capitalize id to avoid collisions with standard js keywords (e.g. if the id is 'default')
  id = id.charAt(0).toUpperCase() + id.slice(1)

  const renderFunction = code.replace(
    'export function render',
    `function render${id}`,
  )

  // Each named export is a story, has to return a Vue ComponentOptionsBase
  return `
    ${renderFunction}
    export const ${id} = () => Object.assign({render: render${id}}, _sfc_main)
    ${id}.storyName = '${title}'
    ${play ? `${id}.play = ${play}` : ''}
    ${id}.parameters = {
      docs: { source: { code: \`${template.trim()}\` } },
    };`
}

async function organizeImports(result: string, isTS: boolean): Promise<string> {
  // Use prettier to organize imports
  return await prettierFormat(result, {
    parser: isTS ? 'typescript' : 'babel',
    plugins: ['prettier-plugin-organize-imports'],
  })
}

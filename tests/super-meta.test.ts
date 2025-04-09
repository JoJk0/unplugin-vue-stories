import Counter from '~playground/Counter.vue?raw'
import { describe, expect, it } from 'vitest'
import {
  extractCssVars,
  extractDescription,
  extractTags,
  parseCssVar,
  parseDocblock,
  parseTag,
  transform,
} from '~/core/super-meta'

const docComments = {
  inline: `/** Component color */`,
  block: `
     /**
      * Component color
      */
      `,
  withTag: `
     /**
      * Component color
      * @syntax <color>  
      */
  `,
  withMultipleTags: `
     /**
      * Component color
      * 
      * @syntax <color>
      * @theme <dark>
      */
  `,
  withMultipleLines: `
     /**
      * Component color
      * This is a description
      * 
      * @syntax <color>
      * @theme <dark>
      */
  `,
  noComment: `const color = '#000';`,
} as const

describe('super-meta', () => {
  describe(parseDocblock.name, () => {
    it('should parse a docblock with a single line comment', () => {
      const result = parseDocblock(docComments.inline)

      expect(result).toEqual('Component color')
    })

    it('should parse a docblock with a multi-line comment', () => {
      const result = parseDocblock(docComments.block)

      expect(result).toEqual('Component color')
    })

    it('should return null for non-comment lines', () => {
      const result = parseDocblock(docComments.noComment)

      expect(result).toEqual('')
    })
  })

  describe(parseTag.name, () => {
    it('should parse a tag with a description', () => {
      const line = `@syntax <color>`
      const result = parseTag(line)

      expect(result).toEqual({
        tag: 'syntax',
        description: '<color>',
      })
    })

    it('should return null for non-tag lines', () => {
      const line = `const color = '#000';`
      const result = parseTag(line)

      expect(result).toBeNull()
    })
  })

  describe(extractDescription.name, () => {
    it('should extract description from a docblock', () => {
      const result = extractDescription(docComments.block)

      expect(result).toEqual('Component color')
    })

    it('should extract description from a docblock with a tag', () => {
      const result = extractDescription(docComments.withTag)

      expect(result).toEqual('Component color')
    })

    it('should extract description from a docblock with multiple lines', () => {
      const result = extractDescription(docComments.withMultipleLines)

      expect(result).toEqual('Component color\nThis is a description')
    })

    it('should return undefined for non-description lines', () => {
      const result = extractDescription(docComments.noComment)

      expect(result).toBeUndefined()
    })
  })

  describe(extractTags.name, () => {
    it('should extract tags from a docblock', () => {
      const result = extractTags(docComments.withTag)

      expect(result).toEqual({
        syntax: [
          {
            title: 'syntax',
            description: '<color>',
          },
        ],
      })
    })
  })

  describe(parseCssVar.name, () => {
    it('should parse default css var with single block comment', () => {
      const line = '--default-app-component-color: #000;'

      expect(parseCssVar(line, docComments.inline)).toEqual({
        key: '--app-component-color',
        value: '#000',
        type: undefined,
        description: 'Component color',
      })
    })

    it('should parse default css var', () => {
      const line = '--default-app-component-color: #000;'

      expect(parseCssVar(line, docComments.block)).toEqual({
        key: '--app-component-color',
        value: '#000',
        type: undefined,
        description: 'Component color',
      })
    })

    it('should parse css var', () => {
      const line = '--app-component-color: #000;'

      expect(parseCssVar(line, docComments.block)).toEqual({
        key: '--app-component-color',
        value: '#000',
        type: undefined,
        description: 'Component color',
      })
    })

    it('should parse css var with type', () => {
      const line = '--app-component-color: #000;'

      expect(parseCssVar(line, docComments.withTag)).toEqual({
        key: '--app-component-color',
        value: '#000',
        type: '<color>',
        description: 'Component color',
      })
    })

    it('should parse css var without comment', () => {
      const line = '--default-color: #000;'

      expect(parseCssVar(line)).toEqual({
        key: '--color',
        value: '#000',
        type: undefined,
        description: undefined,
      })
    })
  })

  describe(extractCssVars.name, () => {
    it('should extract css vars from a style block', () => {
      const style = [
        {
          type: 'style' as const,
          content: `
            :root {
              --default-app-component-color: #000;
              --app-component-color: #000;
            }
          `,
          attrs: {},
          loc: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 1, offset: 0 },
            source: '',
          },
        },
      ]
      const componentName = 'AppComponent'

      const result = extractCssVars(style, componentName)

      expect(result).toEqual([
        {
          key: '--app-component-color',
          value: '#000',
          type: undefined,
          description: undefined,
        },
      ])
    })
  })

  describe(transform.name, () => {
    it('should transform a Vue component to expose meta', () => {
      const id = 'src/components/AppComponent.vue'

      const result = transform(Counter, id)

      expect(result?.code).toEqual(Counter)
    })
  })
})

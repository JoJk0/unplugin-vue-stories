export interface ParsedMeta {
  title?: string
  component?: string
  tags: string[]
}

export interface ParsedStory {
  id: string
  title: string
  template: string
  play?: string
}

export interface CssVarMeta {
  key: string
  value: string
  type?: string
  description?: string
}

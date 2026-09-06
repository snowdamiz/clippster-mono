import type { SeoFaq } from './content'

export type ContentSection =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'steps'; items: Array<{ title: string; body: string }> }
  | { type: 'bullets'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'faq'; items: SeoFaq[] }

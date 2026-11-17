import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const EXAMPLE_INVOICE = resolve('examples/invoice/invoice.json')

/** A temp dir holding a copy of the example invoice JSON as `invoice.json`. */
export function docDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'letter-doc-'))
	copyFileSync(EXAMPLE_INVOICE, join(dir, 'invoice.json'))
	return dir
}

export function writeDoc(dir: string, name: string, content: string): string {
	const path = join(dir, name)
	writeFileSync(path, content)
	return path
}

export const LETTER_FRONTMATTER = `---
type: letter
date: 2026-12-11
subject: Testbrief
recipient: |
  Muster AG
  Musterstrasse 12
  3000 Bern
---
`

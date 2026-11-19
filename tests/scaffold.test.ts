import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { loadDocument } from '../src/lib/document.ts'
import { LetterError } from '../src/lib/errors.ts'
import { scaffold } from '../src/lib/scaffold.ts'
import { docDir, writeDoc } from './helpers/docs.ts'

const KEYS = [
	'type',
	'sender',
	'lang',
	'date',
	'subject',
	'recipient',
	'invoice',
	'timesheet',
	'project',
	'period',
	'signature',
	'title',
]

const INVOICE_ONLY = ['invoice', 'timesheet', 'project', 'period']

test('file names are dated and default to the type', () => {
	expect(scaffold('letter', undefined, '2026-11-19').fileName).toBe('2026-11-19-letter.md')
	expect(scaffold('invoice', undefined, '2026-11-19').fileName).toBe('2026-11-19-invoice.md')
	expect(scaffold('letter', 'foo.md', '2026-11-19').fileName).toBe('2026-11-19-foo.md')
})

test('a name with a path separator or an empty name is rejected', () => {
	expect(() => scaffold('letter', 'a/b', '2026-11-19')).toThrow(LetterError)
	expect(() => scaffold('letter', 'a\\b', '2026-11-19')).toThrow(/name/)
	expect(() => scaffold('letter', '.md', '2026-11-19')).toThrow(/name/)
})

test('the letter scaffold fails until the subject is filled in', () => {
	const dir = mkdtempSync(join(tmpdir(), 'letter-scaffold-'))
	const { fileName, content } = scaffold('letter', undefined, '2026-11-19')
	const path = join(dir, fileName)
	writeFileSync(path, content)
	expect(() => loadDocument(path)).toThrow(/subject/)
	const doc = loadDocument(writeDoc(dir, 'ok.md', content.replace(/^subject:.*$/m, 'subject: Test')))
	expect(doc.type).toBe('letter')
	expect(doc.date).toBe('2026-11-19')
})

test('the invoice scaffold loads against an invoice JSON and keeps the items marker', () => {
	const dir = docDir()
	const { content } = scaffold('invoice', undefined, '2026-11-19')
	expect(content).toContain('invoice: ./invoice.json')
	const doc = loadDocument(writeDoc(dir, 'invoice.md', content))
	expect(doc.type).toBe('invoice')
	expect(doc.hasItemsMarker).toBe(true)
	expect(content).toMatch(/^# subject:/m)
	expect(content).toMatch(/^# recipient:/m)
	expect(content).toMatch(/^# date:/m)
})

test('every frontmatter key appears in the scaffold of its type, active or commented out', () => {
	for (const type of ['letter', 'invoice'] as const) {
		const front = scaffold(type, undefined, '2026-11-19').content.split('\n---')[0]
		const keys = type === 'letter' ? KEYS.filter(key => !INVOICE_ONLY.includes(key)) : KEYS
		for (const key of keys) expect(front, `${type}: ${key}`).toMatch(new RegExp(`^(# )?${key}:`, 'm'))
	}
})

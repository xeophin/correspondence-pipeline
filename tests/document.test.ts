import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { loadDocument } from '../src/lib/document.ts'
import { LetterError } from '../src/lib/errors.ts'
import { docDir, LETTER_FRONTMATTER, writeDoc } from './helpers/docs.ts'

const cwd = process.cwd()
afterEach(() => process.chdir(cwd))

const INVOICE = `---
type: invoice
subject: Unterhalt muster-ag.ch
invoice: ./invoice.json
---
Guten Tag

::items

Freundliche Grüsse
`

test('loads a letter', () => {
	const path = writeDoc(docDir(), 'brief.md', `${LETTER_FRONTMATTER}Guten Tag\n\nGrüsse\n`)
	const doc = loadDocument(path)
	expect(doc).toMatchObject({
		sourcePath: path, fileName: 'brief.md', type: 'letter', sender: 'business', lang: 'de',
		date: '2026-12-11', subject: 'Testbrief', recipient: ['Muster AG', 'Musterstrasse 12', '3000 Bern'],
		signature: false, hasItemsMarker: false, bodyAfter: '',
	})
	expect(doc.bodyBefore.trim()).toBe('Guten Tag\n\nGrüsse')
})

test('resolves JSON relative to the md file, not cwd', () => {
	const path = writeDoc(docDir(), 'rechnung.md', INVOICE)
	process.chdir(mkdtempSync(join(tmpdir(), 'elsewhere-')))
	expect(loadDocument(path).invoice?.number).toBe('2026-042')
})

test('splits the body at ::items and takes date and recipient from Banana', () => {
	const doc = loadDocument(writeDoc(docDir(), 'rechnung.md', INVOICE))
	expect(doc.hasItemsMarker).toBe(true)
	expect(doc.bodyBefore.trim()).toBe('Guten Tag')
	expect(doc.bodyAfter.trim()).toBe('Freundliche Grüsse')
	expect(doc.date).toBe('2026-12-11')
	expect(doc.recipient).toEqual(['Muster AG', 'Erika Muster', 'Musterstrasse 12', '3000 Bern'])
})

test('frontmatter recipient wins over Banana address', () => {
	const md = INVOICE.replace('invoice: ./invoice.json', 'invoice: ./invoice.json\nrecipient: |\n  Andere GmbH\n  8000 Zürich')
	expect(loadDocument(writeDoc(docDir(), 'r.md', md)).recipient).toEqual(['Andere GmbH', '8000 Zürich'])
})

test('rejects ::item typo with line number', () => {
	// LETTER_FRONTMATTER has 9 lines; the typo is on line 12
	const path = writeDoc(docDir(), 'typo.md', `${LETTER_FRONTMATTER}Text\n\n::item\n`)
	expect(() => loadDocument(path)).toThrow(/typo\.md.*line 12.*::item/)
})

test('rejects ::items in a letter', () => {
	const path = writeDoc(docDir(), 'b.md', `${LETTER_FRONTMATTER}Text\n\n::items\n`)
	expect(() => loadDocument(path)).toThrow(LetterError)
	expect(() => loadDocument(path)).toThrow(/::items.*invoice/)
})

test('rejects a second ::items', () => {
	const path = writeDoc(docDir(), 'r.md', `${INVOICE}\n::items\n`)
	expect(() => loadDocument(path)).toThrow(/second ::items/)
})

test('rejects unknown frontmatter key', () => {
	const path = writeDoc(docDir(), 'b.md', LETTER_FRONTMATTER.replace('type: letter', 'type: letter\ncolour: blue'))
	expect(() => loadDocument(path)).toThrow(/b\.md.*unknown.*colour/i)
})

test('a letter needs date and recipient', () => {
	const path = writeDoc(docDir(), 'b.md', LETTER_FRONTMATTER.replace('date: 2026-12-11\n', ''))
	expect(() => loadDocument(path)).toThrow(/date/)
})

test('a letter cannot carry invoice or timesheet data', () => {
	const path = writeDoc(docDir(), 'b.md', LETTER_FRONTMATTER.replace('type: letter', 'type: letter\ninvoice: ./invoice.json'))
	expect(() => loadDocument(path)).toThrow(/invoice/)
})

test('a missing JSON file names its path', () => {
	const path = writeDoc(docDir(), 'r.md', INVOICE.replace('./invoice.json', './missing.json'))
	expect(() => loadDocument(path)).toThrow(/missing\.json/)
})

test('a file without frontmatter is an error', () => {
	const path = writeDoc(docDir(), 'b.md', 'Just text\n')
	expect(() => loadDocument(path)).toThrow(/frontmatter/)
})

test('loads a timesheet referenced by an invoice', () => {
	const dir = docDir()
	writeFileSync(join(dir, 'hours.json'), JSON.stringify({
		project: { id: 'M', description: 'muster-ag.ch' }, period: { start: '2026-11-01', end: '2026-11-30' },
		entries: [{ date: '2026-11-04', resource: 'KM', notes: 'Updates', hours: 1.5 }], total: 1.5,
	}))
	const doc = loadDocument(writeDoc(dir, 'r.md', INVOICE.replace('invoice: ./invoice.json', 'invoice: ./invoice.json\ntimesheet: ./hours.json')))
	expect(doc.timesheet?.total).toBe(1.5)
})

test('rejects impossible dates', () => {
	for (const date of ['2026-02-30', '2026-13-01']) {
		const path = writeDoc(docDir(), 'b.md', LETTER_FRONTMATTER.replace('2026-12-11', date))
		expect(() => loadDocument(path), date).toThrow(LetterError)
	}
})

test('rejects an empty recipient', () => {
	const path = writeDoc(docDir(), 'b.md', LETTER_FRONTMATTER.replace(/recipient: \|\n(  .*\n)+/, 'recipient: " "\n'))
	expect(() => loadDocument(path)).toThrow(/recipient/)
})

test('rejects an invoice whose Banana customer has no address', () => {
	const dir = docDir()
	const json = JSON.parse(readFileSync(join(dir, 'invoice.json'), 'utf8'))
	for (const key of Object.keys(json.customer_info)) json.customer_info[key] = ''
	writeFileSync(join(dir, 'invoice.json'), JSON.stringify(json))
	expect(() => loadDocument(writeDoc(dir, 'r.md', INVOICE))).toThrow(/recipient/)
})

test('a frontmatter recipient drops Banana\'s debtor from the QR-bill', () => {
	const md = INVOICE.replace('invoice: ./invoice.json', 'invoice: ./invoice.json\nrecipient: |\n  Andere GmbH\n  8000 Zürich')
	expect(loadDocument(writeDoc(docDir(), 'r.md', md)).invoice?.debtor).toBeUndefined()
})

test('an invoice without subject takes Banana\'s document title', () => {
	const path = writeDoc(docDir(), 'r.md', INVOICE.replace('subject: Unterhalt muster-ag.ch\n', ''))
	expect(loadDocument(path).subject).toBe('Unterhalt muster-ag.ch')
})

test('a letter needs a subject', () => {
	const path = writeDoc(docDir(), 'b.md', LETTER_FRONTMATTER.replace(/subject: .*\n/, ''))
	expect(() => loadDocument(path)).toThrow(/subject/)
})

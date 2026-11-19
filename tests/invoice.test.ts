import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, test } from 'vitest'
import type { TextItem } from './helpers/pdf.ts'
import { pageText } from './helpers/pdf.ts'
import { renderPdf } from './helpers/render.ts'
import { formatAmount, formatDate, formatQuantity } from '../src/lib/i18n.ts'
import { docDir, writeDoc } from './helpers/docs.ts'

const top = (page: TextItem[], text: string) => {
	const item = page.find(i => i.str.includes(text))
	expect(item, text).toBeDefined()
	return item!.topMm
}

describe('German invoice with ::items', () => {
	let p1: TextItem[]
	beforeAll(async () => {
		p1 = (await renderPdf('examples/invoice/invoice.md')).pages[0]
	})

	test('the header names the document type', () => {
		expect(pageText(p1)).toContain('Rechnung')
	})

	test('the table sits between the intro and the closing', () => {
		expect(top(p1, 'folgende Leistungen')).toBeLessThan(top(p1, 'Unterhalt Website'))
		expect(top(p1, 'Unterhalt Website')).toBeLessThan(top(p1, 'Zahlbar innert 30 Tagen'))
	})

	test("items show quantity with unit, unit price and amount; the total is Banana's", () => {
		const text = pageText(p1)
		expect(text).toContain(`${formatQuantity('de', 6.5)} h`)
		expect(text).toContain(formatAmount('de', 120))
		expect(text).toContain(formatAmount('de', 780))
		expect(text).toContain(formatAmount('de', 1020))
		expect(text).toContain('Total CHF')
	})

	test('the table uses the body font', () => {
		const body = p1.find(i => i.str === 'Liebe Frau Muster')!
		expect(p1.find(i => i.str.includes('Unterhalt Website'))!.font).toBe(body.font)
		expect(p1.find(i => i.str === formatAmount('de', 780))!.font).toBe(body.font)
	})

	test('invoice details sit left of the address, at its height', () => {
		const text = pageText(p1)
		expect(text).toContain('2026-042')
		expect(text).toContain('1001')
		expect(text).toContain(formatDate('de', '2027-01-10'))
		expect(text).not.toContain('LEISTUNGSZEITRAUM') // no timesheet, no frontmatter period
		const value = p1.find(i => i.str === '2026-042')!
		const address = p1.find(i => i.str === 'Muster AG')!
		expect(value.rightMm).toBeLessThan(address.xMm)
		expect(Math.abs(value.topMm - top(p1, 'Hanna Beispiel, Beispielweg'))).toBeLessThan(5)
	})

	test('there is no VAT and no subtotal', () => {
		const text = pageText(p1)
		expect(text).not.toMatch(/MWST|Zwischensumme/)
	})
})

test('an English invoice uses English labels', async () => {
	const md = readFileSync('examples/invoice/invoice.md', 'utf8').replace('type: invoice', 'type: invoice\nlang: en')
	const text = pageText((await renderPdf(writeDoc(docDir(), 'invoice.md', md))).pages[0])
	expect(text).toContain('Invoice')
	expect(text).toContain('Description')
	expect(text).toContain('Total CHF')
})

test('without a marker the table follows the body', async () => {
	const md = readFileSync('examples/invoice/invoice.md', 'utf8').replace('::items\n\n', '')
	const p1 = (await renderPdf(writeDoc(docDir(), 'invoice.md', md))).pages[0]
	expect(top(p1, 'Herzliche Grüsse')).toBeLessThan(top(p1, 'Unterhalt Website'))
})

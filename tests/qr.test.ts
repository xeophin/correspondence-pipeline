import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, test } from 'vitest'
import { toInvoiceView } from '../src/lib/banana.ts'
import { LetterError } from '../src/lib/errors.ts'
import { qrBillSvg, splitStreet } from '../src/lib/qr.ts'
import type { TextItem } from './helpers/pdf.ts'
import { pageText } from './helpers/pdf.ts'
import { renderPdf } from './helpers/render.ts'
import { docDir, writeDoc } from './helpers/docs.ts'

const view = () => toInvoiceView(JSON.parse(readFileSync('examples/invoice/invoice.json', 'utf8')))

test('splits the house number off the street', () => {
	expect(splitStreet('Beispielweg 1')).toEqual({ address: 'Beispielweg', buildingNumber: '1' })
	expect(splitStreet('Postfach')).toEqual({ address: 'Postfach' })
})

test('renders an SVG payment part', () => {
	expect(qrBillSvg(view(), 'de')).toMatch(/^<svg/)
})

test('an invalid IBAN is a LetterError', () => {
	expect(() => qrBillSvg({ ...view(), creditorIban: 'CH00' }, 'de')).toThrow(LetterError)
})

test('a missing IBAN is a LetterError naming the Banana field', () => {
	expect(() => qrBillSvg({ ...view(), creditorIban: undefined }, 'de')).toThrow(/iban_number/)
})

describe('invoice PDF', () => {
	let pages: TextItem[][]
	beforeAll(async () => { pages = (await renderPdf('examples/invoice/invoice.md')).pages })

	test('the QR-bill gets its own last page, flush with the bottom, without footer', () => {
		expect(pages).toHaveLength(2)
		const last = pages[1]
		for (const label of ['Empfangsschein', 'Zahlteil']) {
			const item = last.find(i => i.str === label)
			expect(item, label).toBeDefined()
			expect(item!.topMm).toBeGreaterThanOrEqual(192)
		}
		expect(pageText(last)).not.toContain('Seite')
		expect(pageText(last)).not.toContain('example.org/studio')
	})

	test('page 1 keeps its footer and counts the QR page', () => {
		expect(pageText(pages[0])).toContain('Seite 1 von 2')
	})
})

test('an English invoice gets an English QR-bill', async () => {
	const md = readFileSync('examples/invoice/invoice.md', 'utf8').replace('type: invoice', 'type: invoice\nlang: en')
	const { pages } = await renderPdf(writeDoc(docDir(), 'invoice.md', md))
	expect(pageText(pages.at(-1)!)).toContain('Receipt')
})

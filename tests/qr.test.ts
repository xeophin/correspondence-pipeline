import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, test } from 'vitest'
import { toInvoiceView } from '../src/lib/banana.ts'
import { LetterError } from '../src/lib/errors.ts'
import { hasQrBill, isQrIban, mod10Recursive, qrBillSvg, qrReference, splitStreet } from '../src/lib/qr.ts'
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
	beforeAll(async () => {
		pages = (await renderPdf('examples/invoice/invoice.md')).pages
	})

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

test('without a debtor the QR-bill leaves the payer blank', () => {
	const svg = qrBillSvg({ ...view(), debtor: undefined }, 'de')
	expect(svg).not.toContain('Musterstrasse 12')
})

describe('QR reference (Banana CH10 formula)', () => {
	test('modulo 10 recursive check digit matches a published QR reference', () => {
		// 21 00000 00003 13947 14300 09017: the last digit is the check digit
		expect(mod10Recursive('21000000000313947143000901')).toBe('7')
	})

	test('builds customer number padded to 18, invoice number padded to 25, then 0 and the check digit', () => {
		const reference = qrReference('1001', '2026-042')
		expect(reference).toHaveLength(27)
		expect(reference.slice(0, 26)).toBe('000000000000001001' + '2026042' + '0')
		expect(reference.at(-1)).toBe(mod10Recursive(reference.slice(0, 26)))
	})

	test('numbers Banana cannot encode are an error', () => {
		expect(() => qrReference('12345678', '1')).toThrow(/customer number/)
		expect(() => qrReference('1001', '2026-0420')).toThrow(/invoice number/)
		expect(() => qrReference('K-1001', '1')).toThrow(/customer number/)
	})

	test('recognises QR-IBANs by their bank number (30000–31999)', () => {
		expect(isQrIban('CH23 3000 0123 4567 8901 2')).toBe(true)
		expect(isQrIban('CH44 3199 9123 0008 8901 2')).toBe(true)
		expect(isQrIban('CH93 0076 2011 6238 5295 7')).toBe(false)
	})

	test('a QR-IBAN gets a QR-bill with the QR reference', () => {
		const svg = qrBillSvg({ ...view(), creditorIban: 'CH44 3199 9123 0008 8901 2' }, 'de')
		expect(svg).toContain('Referenz')
		const reference = qrReference('1001', '2026-042')
		expect(svg).toContain(`${reference.slice(0, 2)} ${reference.slice(2, 7)}`)
	})
})

test('a separate building number reaches the QR-bill', () => {
	const svg = qrBillSvg(
		{ ...view(), debtor: { ...view().debtor!, address: 'Musterstrasse', buildingNumber: '12a' } },
		'de',
	)
	expect(svg).toContain('Musterstrasse 12a')
})

test('a pro-forma invoice (nothing to pay) gets no QR-bill', async () => {
	expect(hasQrBill({ ...view(), total: 0 })).toBe(false)
	expect(hasQrBill(view())).toBe(true)
	const dir = docDir()
	const json = JSON.parse(readFileSync(join(dir, 'invoice.json'), 'utf8'))
	json.billing_info.total_to_pay = '0.00'
	writeFileSync(join(dir, 'invoice.json'), JSON.stringify(json))
	const { pages } = await renderPdf(writeDoc(dir, 'invoice.md', readFileSync('examples/invoice/invoice.md', 'utf8')))
	expect(pages).toHaveLength(1)
	expect(pageText(pages[0])).not.toContain('Zahlteil')
})

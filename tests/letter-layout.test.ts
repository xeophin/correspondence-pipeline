import { beforeAll, describe, expect, test } from 'vitest'
import type { TextItem } from './helpers/pdf.ts'
import { pageText } from './helpers/pdf.ts'
import { renderPdf } from './helpers/render.ts'
import { formatDate } from '../src/lib/i18n.ts'

const RECIPIENT = ['Muster AG', 'Frau Erika Muster', 'Musterstrasse 12', '3000 Bern']

describe('business letter', () => {
	let p1: TextItem[]
	beforeAll(async () => { p1 = (await renderPdf('examples/letter.md')).pages[0] })

	test('every recipient line sits inside the always-visible window zone', () => {
		for (const line of RECIPIENT) {
			const item = p1.find(i => i.str === line)
			expect(item, line).toBeDefined()
			expect(item!.xMm).toBeGreaterThanOrEqual(117)
			expect(item!.rightMm).toBeLessThanOrEqual(196)
			expect(item!.topMm).toBeGreaterThanOrEqual(47)
			expect(item!.bottomMm).toBeLessThanOrEqual(81)
		}
	})

	test('the return address is inside the window zone too', () => {
		const item = p1.find(i => i.str.includes('Beispielweg 1') && i.topMm < 90)
		expect(item).toBeDefined()
		expect(item!.xMm).toBeGreaterThanOrEqual(117)
		expect(item!.topMm).toBeGreaterThanOrEqual(47)
	})

	test('the subject starts below the possibly-visible zone', () => {
		expect(p1.find(i => i.str === 'Testbrief')!.topMm).toBeGreaterThanOrEqual(95)
	})

	test('nothing right of 98 mm reaches into the window zone from above', () => {
		const intruders = p1.filter(i => i.rightMm > 98 && i.topMm < 47 && i.bottomMm > 33)
		expect(intruders).toEqual([])
	})

	test('the header shows the business brand and the date in German', () => {
		const text = pageText(p1)
		expect(text).toContain('example.org')
		expect(text).toContain('studio')
		expect(text).toContain(formatDate('de', '2026-12-11'))
	})
})

test('a personal letter shows the personal brand, no type line, and an English date', async () => {
	const text = pageText((await renderPdf('examples/bewerbung.md')).pages[0])
	expect(text).toContain('hanna')
	expect(text).toContain('beispiel')
	expect(text).not.toContain('studio')
	expect(text).toContain(formatDate('en', '2026-12-11'))
})

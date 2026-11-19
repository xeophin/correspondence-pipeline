import { beforeAll, expect, test } from 'vitest'
import type { TextItem } from './helpers/pdf.ts'
import { pageText } from './helpers/pdf.ts'
import { renderPdf } from './helpers/render.ts'

let pages: TextItem[][]
beforeAll(async () => {
	pages = (await renderPdf('examples/long-letter.md')).pages
})

test('a long letter runs onto two pages', () => {
	expect(pages).toHaveLength(2)
})

test('every page carries the footer: counter, file name, address', () => {
	pages.forEach((page, i) => {
		const text = pageText(page)
		expect(text).toContain(`Seite ${i + 1} von 2`)
		expect(text).toContain('long-letter.md')
		expect(text).toContain('Beispielweg 1')
	})
})

test('page 2 starts with the running header above the window zone', () => {
	const header = pages[1].find(i => i.str.includes('example.org/studio'))
	expect(header).toBeDefined()
	expect(header!.topMm).toBeLessThan(33)
})

test('page 1 has no running header, only the big header', () => {
	expect(pages[0].filter(i => i.str.includes('example.org/studio'))).toEqual([])
})

test('the running header keeps clear of the text on page 2', () => {
	const header = pages[1].find(i => i.str.includes('example.org/studio'))!
	const firstLine = pages[1].filter(i => i !== header && i.topMm > header.topMm).sort((a, b) => a.topMm - b.topMm)[0]
	expect(firstLine.topMm - header.bottomMm).toBeGreaterThanOrEqual(6)
})

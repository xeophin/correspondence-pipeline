import { beforeAll, expect, test } from 'vitest'
import type { TextItem } from './helpers/pdf.ts'
import { pageText } from './helpers/pdf.ts'
import { renderPdf } from './helpers/render.ts'

let pages: TextItem[][]
beforeAll(async () => { pages = (await renderPdf('examples/invoice/invoice-with-hours.md')).pages })

test('the attachment follows the QR-bill page', () => {
	expect(pages).toHaveLength(3)
	expect(pageText(pages[1])).toContain('Zahlteil')
	expect(pageText(pages[2])).toContain('Stundenrapport November 2026 / muster-ag.ch')
})

test('it lists every entry and the total', () => {
	const text = pageText(pages[2])
	for (const notes of ['Plugin-Updates und Backup geprüft', 'Kontaktformular: Spam-Schutz eingebaut', 'Neue Teamseite', 'Bildoptimierung Startseite', 'Telefonat und Abstimmung']) {
		expect(text).toContain(notes)
	}
	expect(text).toContain('4. November 2026')
	expect(text).toContain('6.50')
})

test('it carries the running header and the footer', () => {
	const text = pageText(pages[2])
	expect(text).toContain('example.org/studio / Unterhalt muster-ag.ch')
	expect(text).toContain('Seite 3 von 3')
})

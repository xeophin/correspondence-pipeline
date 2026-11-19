import { beforeAll, expect, test } from 'vitest'
import type { TextItem } from './helpers/pdf.ts'
import { pageText } from './helpers/pdf.ts'
import { renderPdf } from './helpers/render.ts'
import { formatAmount, formatDate, formatPeriod } from '../src/lib/i18n.ts'

let pages: TextItem[][]
beforeAll(async () => {
	pages = (await renderPdf('examples/invoice/invoice-with-hours.md')).pages
})

test('the attachment follows the QR-bill page', () => {
	expect(pages).toHaveLength(3)
	expect(pageText(pages[1])).toContain('Zahlteil')
	expect(pageText(pages[2])).toContain('Stundenrapport')
})

test('project and period are listed below the title, not in it', () => {
	const text = pageText(pages[2])
	expect(text).not.toContain('Stundenrapport November')
	const top = (str: string) => pages[2].find(i => i.str === str)!.topMm
	expect(top('MUSTER')).toBeGreaterThan(top('Stundenrapport'))
	expect(text).toContain('muster-ag.ch')
	expect(text).toContain(formatPeriod('de', '2026-11-01', '2026-11-30'))
	expect(text).toMatch(/PROJEKTNAME/)
})

test('the invoice takes project and service period from the timesheet', () => {
	const text = pageText(pages[0])
	expect(text).toContain('MUSTER')
	expect(text).toContain('LEISTUNGSZEITRAUM')
	expect(text).toContain(formatPeriod('de', '2026-11-01', '2026-11-30'))
})

test('it lists every entry and the total', () => {
	const text = pageText(pages[2])
	for (const notes of [
		'Plugin-Updates und Backup geprüft',
		'Kontaktformular: Spam-Schutz eingebaut',
		'Neue Teamseite',
		'Bildoptimierung Startseite',
		'Telefonat und Abstimmung',
	]) {
		expect(text).toContain(notes)
	}
	expect(text).toContain(formatDate('de', '2026-11-04'))
	expect(text).toContain(formatAmount('de', 6.5))
})

test('it carries the running header and the footer', () => {
	const text = pageText(pages[2])
	expect(text).toContain('example.org/studio / Unterhalt muster-ag.ch')
	expect(text).toContain('Seite 3 von 3')
})

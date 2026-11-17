import { expect, test } from 'vitest'
import { formatAmount, formatDate, formatMonth, t } from '../src/lib/i18n.ts'

test('formats long dates per language', () => {
	expect(formatDate('de', '2026-12-11')).toBe('11. Dezember 2026')
	expect(formatDate('en', '2026-12-11')).toBe('11 December 2026')
})

test('formats a month for the timesheet title', () => {
	expect(formatMonth('de', '2026-11-01')).toBe('November 2026')
	expect(formatMonth('en', '2026-03-01')).toBe('March 2026')
})

test('formats amounts with Swiss grouping and two decimals', () => {
	expect(formatAmount('de', 1234.5)).toBe("1'234.50")
	expect(formatAmount('en', 1234.5)).toMatch(/^1.234\.50$/)
})

test('substitutes label variables', () => {
		expect(t('en', 'type.invoice')).toBe('Invoice')
	expect(t('de', 'timesheet.title', { period: 'November 2026', project: 'kibo' })).toBe('Stundenrapport November 2026 · kibo')
})

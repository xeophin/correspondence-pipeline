import { expect, test } from 'vitest'
import { formatMonth, formatPeriod, t } from '../src/lib/i18n.ts'

test('a period within one month is the month, otherwise a range', () => {
	expect(formatPeriod('de', '2026-11-01', '2026-11-30')).toBe(formatMonth('de', '2026-11-01'))
	expect(formatPeriod('de', '2026-10-15', '2026-11-30')).not.toBe(formatMonth('de', '2026-10-15'))
})

test('looks up labels per language', () => {
	expect(t('en', 'type.invoice')).toBe('Invoice')
	expect(t('de', 'timesheet.title')).toBe('Stundenrapport')
})

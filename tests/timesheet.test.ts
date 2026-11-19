import { expect, test } from 'vitest'
import { parseTimesheet } from '../src/lib/timesheet.ts'

const valid = {
	project: { id: 'MUSTER', description: 'muster-ag.ch' },
	period: { start: '2026-11-01', end: '2026-11-30' },
	entries: [
		{ date: '2026-11-04', resource: 'KM', notes: 'Plugin-Updates', hours: 1.5 },
		{ date: '2026-11-12', resource: 'KM', notes: 'Formular angepasst', hours: 5 },
	],
	total: 6.5,
}

test('parses a valid timesheet', () => {
	expect(parseTimesheet(valid)).toEqual(valid)
})

test('rejects a total that differs from the sum of the entries', () => {
	expect(() => parseTimesheet({ ...valid, total: 7 })).toThrow(/total 7.*6\.5/)
})

test('rejects unknown keys and malformed dates', () => {
	expect(() => parseTimesheet({ ...valid, extra: 1 })).toThrow(/extra/)
	expect(() => parseTimesheet({ ...valid, period: { start: '1.11.2026', end: '2026-11-30' } })).toThrow(/period\.start/)
})

test('rejects impossible entry dates', () => {
	expect(() =>
		parseTimesheet({ ...valid, entries: [{ ...valid.entries[0], date: '2026-11-31' }], total: 1.5 }),
	).toThrow(/date/)
})

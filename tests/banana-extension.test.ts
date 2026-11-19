import { expect, test } from 'vitest'
import core from '../banana/timesheet-core.js'
import { parseTimesheet } from '../src/lib/timesheet.ts'

const { buildTimesheet, parseHours } = core as {
	buildTimesheet: (rows: unknown[], opts: unknown) => unknown
	parseHours: (value: string) => number
}

const row = (date: string, projectId: string, notes: string, time: string) => ({
	date,
	projectId,
	projectDescription: projectId === 'MUSTER' ? 'muster-ag.ch' : 'Other',
	resourceId: 'KM',
	notes,
	time,
})

const rows = [
	row('2026-11-10', 'MUSTER', 'Formular', '2:00'),
	row('2026-11-04', 'MUSTER', 'Updates', '1.5'),
	row('2026-11-05', 'OTHER', 'Fremdprojekt', '3'),
	row('2026-10-31', 'MUSTER', 'Vormonat', '1'),
	row('2026-12-01', 'MUSTER', 'Folgemonat', '1'),
	row('2026-11-20', 'MUSTER', 'Leer', ''),
]
const opts = { projectId: 'MUSTER', start: '2026-11-01', end: '2026-11-30' }

test('parses decimal and h:mm time values', () => {
	expect(parseHours('1.5')).toBe(1.5)
	expect(parseHours('1:30')).toBe(1.5)
	expect(parseHours('0:45')).toBe(0.75)
	expect(parseHours('')).toBe(0)
})

test('keeps only the project and period, sorted by date, and sums the total', () => {
	expect(buildTimesheet(rows, opts)).toEqual({
		project: { id: 'MUSTER', description: 'muster-ag.ch' },
		period: { start: '2026-11-01', end: '2026-11-30' },
		entries: [
			{ date: '2026-11-04', resource: 'KM', notes: 'Updates', hours: 1.5 },
			{ date: '2026-11-10', resource: 'KM', notes: 'Formular', hours: 2 },
		],
		total: 3.5,
	})
})

test('the extension output is what the letter tool reads', () => {
	expect(() => parseTimesheet(buildTimesheet(rows, opts))).not.toThrow()
})

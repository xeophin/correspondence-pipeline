import { z } from 'zod'
import { isIsoDate } from './dates.ts'
import { LetterError } from './errors.ts'
import { formatDate, formatMonth, t, type Lang } from './i18n.ts'
import { describeIssues } from './zod-errors.ts'

const isoDate = z.string().refine(isIsoDate, 'expected a real date like 2026-11-30')

const timesheetSchema = z.strictObject({
	project: z.strictObject({ id: z.string(), description: z.string() }),
	period: z.strictObject({ start: isoDate, end: isoDate }),
	entries: z.array(z.strictObject({ date: isoDate, resource: z.string(), notes: z.string(), hours: z.number() })),
	total: z.number(),
})

/** The timesheet JSON written by our Banana extension (see banana/). */
export type Timesheet = z.infer<typeof timesheetSchema>

export function parseTimesheet(json: unknown): Timesheet {
	const result = timesheetSchema.safeParse(json)
	if (!result.success) throw new LetterError(`timesheet JSON: ${describeIssues(result.error)}`)
	const sum = result.data.entries.reduce((total, entry) => total + entry.hours, 0)
	if (Math.abs(sum - result.data.total) > 0.001) {
		throw new LetterError(`timesheet JSON: total ${result.data.total} differs from the sum of the entries (${sum})`)
	}
	return result.data
}

/** "Stundenrapport November 2026 · project", or a date range when the period spans months. */
export function timesheetTitle(lang: Lang, timesheet: Timesheet): string {
	const { start, end } = timesheet.period
	const period = start.slice(0, 7) === end.slice(0, 7)
		? formatMonth(lang, start)
		: `${formatDate(lang, start)} – ${formatDate(lang, end)}`
	return t(lang, 'timesheet.title', { period, project: timesheet.project.description })
}

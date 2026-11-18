import { z } from 'zod'
import { isIsoDate } from './dates.ts'
import { LetterError } from './errors.ts'
import { describeIssues } from './zod-errors.ts'

const isoDate = z.string().refine(isIsoDate, 'expected a real date like 2026-11-30')

/** A span of days, both ends inclusive. */
export const periodSchema = z.strictObject({ start: isoDate, end: isoDate })
export type Period = z.infer<typeof periodSchema>

const timesheetSchema = z.strictObject({
	project: z.strictObject({ id: z.string(), description: z.string() }),
	period: periodSchema,
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

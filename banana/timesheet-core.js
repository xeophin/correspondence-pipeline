// Shared by the timesheet export extension (via @includejs) and the tests.
// Plain ES5: Banana's script engine is not documented to support newer syntax.

/** Hours from a Banana time value: decimal ("1.5") or "h:mm" ("1:30"). Empty → 0. */
function parseHours(value) {
	var text = String(value === undefined || value === null ? '' : value).trim()
	if (text === '') return 0
	var parts = text.split(':')
	if (parts.length === 2) return Number(parts[0]) + Number(parts[1]) / 60
	return Number(text)
}

function round2(n) {
	return Math.round(n * 100) / 100
}

/**
 * Builds the timesheet JSON read by the letter tool (src/lib/timesheet.ts).
 * rows: [{ date, projectId, projectDescription, resourceId, notes, time }]
 * opts: { projectId, start, end } — ISO dates, inclusive.
 */
function buildTimesheet(rows, opts) {
	var description = ''
	var entries = []
	for (var i = 0; i < rows.length; i++) {
		var row = rows[i]
		if (row.projectId !== opts.projectId || row.date < opts.start || row.date > opts.end) continue
		if (!description && row.projectDescription) description = row.projectDescription
		var hours = round2(parseHours(row.time))
		if (hours === 0) continue
		entries.push({ date: row.date, resource: row.resourceId, notes: row.notes, hours: hours })
	}
	entries.sort(function (a, b) {
		return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
	})
	var total = 0
	for (var j = 0; j < entries.length; j++) total += entries[j].hours
	return {
		project: { id: opts.projectId, description: description },
		period: { start: opts.start, end: opts.end },
		entries: entries,
		total: round2(total),
	}
}

if (typeof module !== 'undefined') module.exports = { buildTimesheet: buildTimesheet, parseHours: parseHours }

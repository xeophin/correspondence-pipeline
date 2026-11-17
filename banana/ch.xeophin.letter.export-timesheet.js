// @id = ch.xeophin.letter.export-timesheet
// @api = 1.0
// @pubdate = 2026-11-17
// @publisher = Kaspar Manz
// @description = Export timesheet JSON for the letter tool
// @description.de = Stundenrapport als JSON für das Brief-Werkzeug exportieren
// @doctype = *
// @task = app.command
// @inputdatasource = none
// @timeout = -1
// @includejs = timesheet-core.js

// Run in a Banana timesheet file. Reads the Journal table for one project and
// period and writes the JSON the letter tool attaches to an invoice
// (`timesheet: ./<file>.json`).
//
// Column names come from Banana's own timesheet extension
// (ch.banana.uni.timesheetreports.js), not from documentation: verify them
// against a real file (Tools → File info, or `table.columnNames`).
var COLUMNS = {
	date: 'Date',
	projectId: 'ProjectsId',
	projectDescription: 'ProjectsDescription',
	resourceId: 'ResourcesId',
	notes: 'Notes',
	time: 'TimeDayTotal',
}

function exec() {
	var journal = Banana.document.table('Journal')
	if (!journal) {
		Banana.Ui.showInformation('Export timesheet', 'No Journal table: open a Banana timesheet file.')
		return '@Cancel'
	}

	var rows = []
	var projects = []
	for (var i = 0; i < journal.rowCount; i++) {
		var row = journal.row(i)
		var entry = {}
		for (var key in COLUMNS) entry[key] = row.value(COLUMNS[key]) || ''
		if (!entry.date || !entry.projectId) continue
		rows.push(entry)
		if (projects.indexOf(entry.projectId) === -1) projects.push(entry.projectId)
	}
	if (!projects.length) {
		Banana.Ui.showInformation('Export timesheet', 'No rows with a project found. Columns read: ' + JSON.stringify(COLUMNS))
		return '@Cancel'
	}

	var projectId = Banana.Ui.getItem('Export timesheet', 'Project', projects, 0, false)
	if (projectId === undefined) return '@Cancel'
	var today = new Date().toISOString().slice(0, 10)
	var period = Banana.Ui.getPeriod('Export timesheet', today.slice(0, 4) + '-01-01', today.slice(0, 4) + '-12-31')
	if (!period) return '@Cancel'

	var timesheet = buildTimesheet(rows, { projectId: projectId, start: period.startDate, end: period.endDate })
	var fileName = Banana.IO.getSaveFileName('Save timesheet JSON', projectId + '-' + period.startDate.slice(0, 7) + '.json', 'JSON (*.json)')
	if (!fileName.length) return '@Cancel'
	var file = Banana.IO.getLocalFile(fileName)
	file.write(JSON.stringify(timesheet, null, 2))
	if (file.errorString) Banana.Ui.showInformation('Write error', file.errorString)
}

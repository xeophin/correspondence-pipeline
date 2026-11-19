// @id = net.xeophin.letter.export-invoice
// @api = 1.0
// @pubdate = 2026-11-17
// @publisher = Kaspar Manz
// @description = Export invoice JSON for the letter tool
// @description.de = Rechnung als JSON für das Brief-Werkzeug exportieren
// @doctype = *
// @task = app.command
// @inputdatasource = none
// @timeout = -1

// Writes one invoice's Invoice JSON object (Banana's own format, unchanged)
// to a file. The Markdown letter references it with `invoice: ./<file>.json`.

function exec() {
	var table = Banana.document.invoicesCustomers()
	if (!table) {
		Banana.Ui.showInformation('Export invoice', 'This file has no customer invoices.')
		return '@Cancel'
	}
	var invoices = []
	var labels = []
	for (var i = 0; i < table.rowCount; i++) {
		var row = table.row(i)
		if (row.value('ObjectType') !== 'InvoiceDocument' || !row.value('ObjectJSonData')) continue
		var invoice = JSON.parse(row.value('ObjectJSonData')).InvoiceDocument
		var customer = invoice.customer_info || {}
		invoices.push(invoice)
		labels.push(
			invoice.document_info.number +
				' – ' +
				(customer.business_name || [customer.first_name, customer.last_name].join(' ')),
		)
	}
	if (!invoices.length) {
		Banana.Ui.showInformation('Export invoice', 'No invoices found.')
		return '@Cancel'
	}
	var choice = Banana.Ui.getItem('Export invoice', 'Invoice', labels, labels.length - 1, false)
	if (choice === undefined) return '@Cancel'
	var selected = invoices[labels.indexOf(choice)]

	var fileName = Banana.IO.getSaveFileName(
		'Save invoice JSON',
		selected.document_info.number + '.json',
		'JSON (*.json)',
	)
	if (!fileName.length) return '@Cancel'
	var file = Banana.IO.getLocalFile(fileName)
	file.write(JSON.stringify(selected, null, 2))
	if (file.errorString) Banana.Ui.showInformation('Write error', file.errorString)
}

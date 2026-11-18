export type Lang = 'de' | 'en'

const LABELS = {
	'type.invoice': { de: 'Rechnung', en: 'Invoice' },
	'items.description': { de: 'Beschreibung', en: 'Description' },
	'items.quantity': { de: 'Menge', en: 'Qty' },
	'items.unitPrice': { de: 'Preis', en: 'Price' },
	'items.amount': { de: 'Betrag', en: 'Amount' },
	'totals.total': { de: 'Total', en: 'Total' },
	'page': { de: 'Seite', en: 'Page' },
	'page.of': { de: 'von', en: 'of' },
	'timesheet.title': { de: 'Stundenrapport', en: 'Timesheet' },
	'meta.invoiceNumber': { de: 'Rechnungsnummer', en: 'Invoice number' },
	'meta.customerNumber': { de: 'Kundennummer', en: 'Customer number' },
	'meta.project': { de: 'Projekt', en: 'Project' },
	'meta.projectName': { de: 'Projektname', en: 'Project name' },
	'meta.dueDate': { de: 'Zahlbar bis', en: 'Due date' },
	'meta.servicePeriod': { de: 'Leistungszeitraum', en: 'Service period' },
	'meta.period': { de: 'Zeitraum', en: 'Period' },
	'timesheet.date': { de: 'Datum', en: 'Date' },
	'timesheet.description': { de: 'Tätigkeit', en: 'Activity' },
	'timesheet.hours': { de: 'Stunden', en: 'Hours' },
	'timesheet.total': { de: 'Total', en: 'Total' },
} satisfies Record<string, Record<Lang, string>>

export type LabelKey = keyof typeof LABELS

const LOCALE: Record<Lang, string> = { de: 'de-CH', en: 'en-CH' }

export function t(lang: Lang, key: LabelKey, vars: Record<string, string> = {}): string {
	return LABELS[key][lang].replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? `{${name}}`)
}

/** ISO dates are calendar dates: format them in UTC so the day never shifts. */
function parseIsoDate(iso: string): Date {
	return new Date(`${iso}T00:00:00Z`)
}

function dateFormat(lang: Lang): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function formatDate(lang: Lang, iso: string): string {
	return dateFormat(lang).format(parseIsoDate(iso))
}

export function formatMonth(lang: Lang, iso: string): string {
	return new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', year: 'numeric', timeZone: 'UTC' })
		.format(parseIsoDate(iso))
}

/** "November 2026" for a period within one month, otherwise a date range. */
export function formatPeriod(lang: Lang, start: string, end: string): string {
	return start.slice(0, 7) === end.slice(0, 7)
		? formatMonth(lang, start)
		: dateFormat(lang).formatRange(parseIsoDate(start), parseIsoDate(end))
}

export function formatAmount(lang: Lang, n: number): string {
	return new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function formatQuantity(lang: Lang, n: number): string {
	return new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 4 }).format(n)
}

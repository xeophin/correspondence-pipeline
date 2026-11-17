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
	'timesheet.title': { de: 'Stundenrapport {period} · {project}', en: 'Timesheet {period} · {project}' },
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

export function formatDate(lang: Lang, iso: string): string {
	return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
		.format(parseIsoDate(iso))
}

export function formatMonth(lang: Lang, iso: string): string {
	return new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', year: 'numeric', timeZone: 'UTC' })
		.format(parseIsoDate(iso))
}

export function formatAmount(lang: Lang, n: number): string {
	return new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function formatQuantity(lang: Lang, n: number): string {
	return new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 4 }).format(n)
}

import { isIsoDate } from './dates.ts'
import { LetterError } from './errors.ts'

/** A Swiss QR-bill address. */
export interface QrAddress {
	name: string
	address: string
	buildingNumber?: string
	zip: string
	city: string
	country: string
}

export interface InvoiceItem {
	description: string
	quantity: number | null
	unit: string
	unitPrice: number | null
	amount: number
}

export interface InvoiceView {
	number: string
	/** Banana customer account (`customer_info.number`), part of the QR reference. */
	customerNumber: string
	date: string
	currency: string
	/** Banana's document title (`document_info.title`); the subject when the frontmatter has none. */
	title: string
	customerAddress: string[]
	/** Absent when the frontmatter overrides the address. */
	debtor?: QrAddress
	creditorIban?: string
	items: InvoiceItem[]
	total: number
}

type Json = Record<string, unknown>

function object(json: Json, key: string, path: string): Json {
	const value = json[key]
	if (value === null || typeof value !== 'object') throw new LetterError(`Banana invoice JSON: missing ${path}${key}`)
	return value as Json
}

function text(json: Json, key: string): string {
	const value = json[key]
	return typeof value === 'string' ? value.trim() : ''
}

function amount(json: Json, key: string, path: string): number {
	const raw = json[key]
	const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN
	if (Number.isNaN(value)) throw new LetterError(`Banana invoice JSON: ${path}${key} is not a number (${JSON.stringify(raw)})`)
	return value
}

function optionalAmount(json: Json, key: string): number | null {
	const raw = json[key]
	if (typeof raw !== 'string' || raw.trim() === '') return null
	const value = Number(raw)
	return Number.isNaN(value) ? null : value
}

/** Maps Banana's Invoice JSON object (version 1.0) to what the layout prints. Amounts are taken as given. */
export function toInvoiceView(json: unknown): InvoiceView {
	if (json === null || typeof json !== 'object') throw new LetterError('Banana invoice JSON: not an object')
	const root = json as Json
	const doc = object(root, 'document_info', '')
	const customer = object(root, 'customer_info', '')
	const billing = object(root, 'billing_info', '')
	const supplier = root.supplier_info && typeof root.supplier_info === 'object' ? root.supplier_info as Json : {}
	if (!Array.isArray(root.items)) throw new LetterError('Banana invoice JSON: missing items')

	const person = [text(customer, 'courtesy'), text(customer, 'first_name'), text(customer, 'last_name')].filter(Boolean).join(' ')
	const business = text(customer, 'business_name')
	const country = text(customer, 'country_code') || 'CH'
	const street = text(customer, 'address1')
	const buildingNumber = text(customer, 'building_number')
	const cityLine = [text(customer, 'postal_code'), text(customer, 'city')].filter(Boolean).join(' ')
	const customerAddress = [
		business, person,
		[street, buildingNumber].filter(Boolean).join(' '), text(customer, 'address2'), text(customer, 'address3'),
		cityLine,
		country !== 'CH' ? text(customer, 'country') || country : '',
	].filter(Boolean)

	const items = (root.items as Json[]).map((item, i): InvoiceItem => {
		const path = `items[${i}].`
		const type = text(item, 'item_type')
		if (type !== 'item') throw new LetterError(`Banana invoice JSON: ${path}item_type "${type}" is not supported`)
		const unitPrice = item.unit_price && typeof item.unit_price === 'object' ? item.unit_price as Json : {}
		return {
			description: text(item, 'description'),
			quantity: optionalAmount(item, 'quantity'),
			unit: text(item, 'mesure_unit'),
			unitPrice: optionalAmount(unitPrice, 'calculated_amount_vat_inclusive'),
			amount: amount(item, 'total_amount_vat_inclusive', path),
		}
	})

	const number = text(doc, 'number')
	const date = text(doc, 'date')
	if (!number) throw new LetterError('Banana invoice JSON: missing document_info.number')
	if (!isIsoDate(date)) throw new LetterError(`Banana invoice JSON: document_info.date is not a date (${JSON.stringify(date)})`)

	return {
		number,
		customerNumber: text(customer, 'number'),
		date,
		currency: text(doc, 'currency') || 'CHF',
		title: text(doc, 'title'),
		customerAddress,
		debtor: {
			name: business || person,
			address: street,
			...buildingNumber && { buildingNumber },
			zip: text(customer, 'postal_code'),
			city: text(customer, 'city'),
			country,
		},
		creditorIban: text(supplier, 'iban_number') || undefined,
		items,
		// Banana leaves the totals empty when nothing is due (pro-forma, fully prepaid).
		total: text(billing, 'total_to_pay') === '' ? 0 : amount(billing, 'total_to_pay', 'billing_info.'),
	}
}

// Field names follow Banana's "Invoice Json Object" (https://www.banana.ch/doc/en/node/8833).
// Amounts are taken VAT-inclusive (what the customer pays); without VAT both are equal.
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { toInvoiceView } from '../src/lib/banana.ts'

const example = () => JSON.parse(readFileSync('examples/invoice/invoice.json', 'utf8'))

test('maps the Banana invoice JSON', () => {
	const view = toInvoiceView(example())
	expect(view.number).toBe('2026-042')
	expect(view.date).toBe('2026-12-11')
	expect(view.currency).toBe('CHF')
	expect(view.items).toHaveLength(2)
	expect(view.items[0]).toEqual({ description: 'Unterhalt Website November 2026', quantity: 6.5, unit: 'h', unitPrice: 120, amount: 780 })
	expect(view.total).toBe(1020)
	expect(view.creditorIban).toBe('CH93 0076 2011 6238 5295 7')
	expect(view.customerAddress).toEqual(['Muster AG', 'Erika Muster', 'Musterstrasse 12', '3000 Bern'])
	expect(view.debtor).toEqual({ name: 'Muster AG', address: 'Musterstrasse 12', zip: '3000', city: 'Bern', country: 'CH' })
})

test('adds the country line for foreign customers', () => {
	const json = example()
	json.customer_info.country_code = 'DE'
	json.customer_info.country = 'Deutschland'
	expect(toInvoiceView(json).customerAddress.at(-1)).toBe('Deutschland')
})

test('names the missing field', () => {
	const json = example()
	delete json.billing_info
	expect(() => toInvoiceView(json)).toThrow(/billing_info/)
})

test('rejects amounts that are not numbers', () => {
	const json = example()
	json.billing_info.total_to_pay = 'n/a'
	expect(() => toInvoiceView(json)).toThrow(/total_to_pay/)
})

test('an empty total means nothing is due', () => {
	const json = example()
	json.billing_info.total_to_pay = ''
	expect(toInvoiceView(json).total).toBe(0)
})

test('rejects item types it does not know how to print', () => {
	const json = example()
	json.items[1].item_type = 'total'
	expect(() => toInvoiceView(json)).toThrow(/item_type.*total/)
})

test('rejects an impossible document date', () => {
	const json = example()
	json.document_info.date = '2026-02-30'
	expect(() => toInvoiceView(json)).toThrow(/document_info\.date/)
})

test('keeps a separate building number', () => {
	const json = example()
	json.customer_info.address1 = 'Musterstrasse'
	json.customer_info.building_number = '12a'
	const view = toInvoiceView(json)
	expect(view.customerAddress).toContain('Musterstrasse 12a')
	expect(view.debtor).toMatchObject({ address: 'Musterstrasse', buildingNumber: '12a' })
})

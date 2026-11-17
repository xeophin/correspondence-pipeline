import { SwissQRBill } from 'swissqrbill/svg'
import type { InvoiceView } from './banana.ts'
import { LetterError } from './errors.ts'
import { t, type Lang } from './i18n.ts'
import { SENDER } from './sender.ts'

/** Structured QR-bill addresses carry the house number separately. */
export function splitStreet(street: string): { address: string; buildingNumber?: string } {
	const match = /^(.*\S)\s+(\d+\s?[a-zA-Z]?)$/.exec(street.trim())
	return match ? { address: match[1], buildingNumber: match[2].replace(/\s/g, '') } : { address: street.trim() }
}

// Banana's QR reference for QR-IBANs (CH10 layout, swissqrcode.js: qrReferenceString,
// modulo10), reproduced exactly so Banana can match incoming payments to the invoice.
// Banana's optional ISR subscriber number is not supported (blank for PostFinance).
const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5]

/** Check digit, modulo 10 recursive (Swiss Post). */
export function mod10Recursive(digits: string): string {
	let carry = 0
	for (const digit of digits) carry = MOD10_TABLE[(carry + Number(digit)) % 10]
	return String((10 - carry) % 10)
}

/** 27-digit QR reference: customer number padded to 18, invoice number (separators removed) to 25, "0", check digit. */
export function qrReference(customerNumber: string, invoiceNumber: string): string {
	const invoice = invoiceNumber.replace(/[^0-9a-zA-Z]+/g, '')
	if (!/^\d{1,7}$/.test(customerNumber)) {
		throw new LetterError(`QR reference: the Banana customer number must be 1–7 digits (is "${customerNumber}")`)
	}
	if (!/^\d{1,7}$/.test(invoice)) {
		throw new LetterError(`QR reference: the invoice number must be at most 7 digits without separators (is "${invoiceNumber}")`)
	}
	const body = customerNumber.padStart(18, '0') + invoice.padStart(7, '0') + '0'
	return body + mod10Recursive(body)
}

/** QR-IBANs have a bank number (IID) from 30000 to 31999. */
export function isQrIban(iban: string): boolean {
	const iid = Number(iban.replace(/\s/g, '').slice(4, 9))
	return iid >= 30000 && iid <= 31999
}

/** The Swiss QR-bill payment part (210 × 105 mm) as SVG. Throws LetterError on invalid data. */
export function qrBillSvg(invoice: InvoiceView, lang: Lang): string {
	if (!invoice.creditorIban) {
		throw new LetterError('QR-bill: the Banana invoice JSON has no supplier_info.iban_number (set the IBAN in Banana\'s file properties)')
	}
	try {
		return new SwissQRBill({
			amount: invoice.total,
			currency: invoice.currency as 'CHF' | 'EUR',
			creditor: {
				account: invoice.creditorIban,
				name: SENDER.name,
				...splitStreet(SENDER.street),
				zip: SENDER.zip,
				city: SENDER.city,
				country: SENDER.country,
			},
			...invoice.debtor && {
				debtor: {
					name: invoice.debtor.name,
					...splitStreet(invoice.debtor.address),
					zip: invoice.debtor.zip,
					city: invoice.debtor.city,
					country: invoice.debtor.country,
				},
			},
			message: `${t(lang, 'type.invoice')} ${invoice.number}`,
			...isQrIban(invoice.creditorIban) && { reference: qrReference(invoice.customerNumber, invoice.number) },
		}, { language: lang === 'de' ? 'DE' : 'EN' }).toString()
	} catch (error) {
		throw new LetterError(`QR-bill: ${(error as Error).message}`)
	}
}

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
		}, { language: lang === 'de' ? 'DE' : 'EN' }).toString()
	} catch (error) {
		throw new LetterError(`QR-bill: ${(error as Error).message}`)
	}
}

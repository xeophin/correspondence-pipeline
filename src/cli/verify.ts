import type { LetterDocument } from '../lib/document.ts'
import { LetterError } from '../lib/errors.ts'
import type { TextItem } from './pdf-text.ts'

/** C5 envelope, right window (SN 010130 / Swiss Post), mm from the page's top-left. */
export const WINDOW = { left: 117, right: 196, top: 47, bottom: 81 } as const
export const SUBJECT_MIN_TOP = 95

const TOLERANCE = 0.2

/** Checks page 1 of the printed PDF against the envelope window. Throws LetterError. */
export function verifyLayout(pages: TextItem[][], doc: LetterDocument): void {
	const page = pages[0] ?? []
	for (const line of doc.recipient) {
		const fits = page.some(item => item.str.trim() === line
			&& item.xMm >= WINDOW.left - TOLERANCE && item.rightMm <= WINDOW.right + TOLERANCE
			&& item.topMm >= WINDOW.top - TOLERANCE && item.bottomMm <= WINDOW.bottom + TOLERANCE)
		if (!fits) throw new LetterError(`${doc.fileName}: address does not fit the envelope window ("${line}")`)
	}
	const subject = page.find(item => doc.subject.startsWith(item.str.trim()) && item.str.trim() !== '' && item.topMm > WINDOW.bottom)
	if (!subject || subject.topMm < SUBJECT_MIN_TOP - TOLERANCE) {
		throw new LetterError(`${doc.fileName}: the subject would show through the envelope window`)
	}
}

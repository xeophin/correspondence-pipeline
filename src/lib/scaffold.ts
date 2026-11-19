import { LetterError } from './errors.ts'

export type DocumentType = 'letter' | 'invoice'

const OPTIONAL = `# sender: personal       # business (default) | personal, e.g. for a motivation letter
# lang: en                # de (default) | en
# title: Bewerbung        # second line of the running header
# signature: true         # default false
`

const LETTER = (date: string) => `---
type: letter
date: ${date}
subject:
recipient: |
  Muster AG
  Frau Erika Muster
  Musterstrasse 12
  3000 Bern
${OPTIONAL}---
Sehr geehrte Frau Muster

Text

Freundliche Grüsse

Hanna Beispiel
`

const INVOICE = `---
type: invoice
invoice: ./invoice.json   # Banana invoice JSON, path relative to this file
# date: 2026-12-11        # default: Banana document date
# subject: Unterhalt      # default: Banana document title
# recipient: |            # default: Banana customer address
#   Muster AG
#   Musterstrasse 12
#   3000 Bern
# timesheet: ./hours.json # Banana timesheet JSON, attached after the QR-bill
# project: MUSTER         # default: project id of the timesheet
# period: { start: 2026-11-01, end: 2026-11-30 }  # default: period of the timesheet
${OPTIONAL}---
Sehr geehrte Frau Muster

Für die Arbeiten stelle ich Ihnen folgende Leistungen in Rechnung:

::items

Zahlbar innert 30 Tagen.

Freundliche Grüsse

Hanna Beispiel
`

/** The file name and Markdown content of a new document; `today` is YYYY-MM-DD. Throws LetterError. */
export function scaffold(
	type: DocumentType,
	name: string | undefined,
	today: string,
): { fileName: string; content: string } {
	const base = (name ?? type).replace(/\.md$/, '')
	if (!base || /[/\\]/.test(base)) throw new LetterError(`invalid name "${name}": use a plain name without / or \\`)
	return { fileName: `${today}-${base}.md`, content: type === 'letter' ? LETTER(today) : INVOICE }
}

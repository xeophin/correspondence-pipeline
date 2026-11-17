import { readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { toInvoiceView, type InvoiceView } from './banana.ts'
import { isIsoDate } from './dates.ts'
import { LetterError } from './errors.ts'
import type { Lang } from './i18n.ts'
import { parseTimesheet, type Timesheet } from './timesheet.ts'
import { describeIssues } from './zod-errors.ts'

export interface LetterDocument {
	sourcePath: string
	fileName: string
	type: 'letter' | 'invoice'
	sender: 'business' | 'personal'
	lang: Lang
	date: string
	subject: string
	title?: string
	recipient: string[]
	signature: boolean
	/** Markdown before `::items`, or the whole body. */
	bodyBefore: string
	/** Markdown after `::items`; empty without a marker. */
	bodyAfter: string
	hasItemsMarker: boolean
	invoice?: InvoiceView
	timesheet?: Timesheet
}

const frontmatterSchema = z.strictObject({
	type: z.enum(['letter', 'invoice']),
	sender: z.enum(['business', 'personal']).default('business'),
	lang: z.enum(['de', 'en']).default('de'),
	date: z.string().refine(isIsoDate, 'expected a real date like 2026-12-11').optional(),
	subject: z.string().min(1),
	recipient: z.union([z.string(), z.array(z.string())]).optional(),
	invoice: z.string().optional(),
	timesheet: z.string().optional(),
	signature: z.boolean().default(false),
	title: z.string().optional(),
})

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

function readJson(path: string, label: string): unknown {
	try {
		return JSON.parse(readFileSync(path, 'utf8'))
	} catch (error) {
		const reason = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'not found' : (error as Error).message
		throw new LetterError(`${label} ${path}: ${reason}`)
	}
}

function lines(value: string | string[]): string[] {
	return (Array.isArray(value) ? value : value.split(/\r?\n/)).map(line => line.trim()).filter(Boolean)
}

/** Reads and validates one Markdown document plus the JSON files it references. Throws LetterError. */
export function loadDocument(mdPath: string): LetterDocument {
	const sourcePath = resolve(mdPath)
	const fileName = basename(sourcePath)
	const fail = (message: string): never => { throw new LetterError(`${fileName}: ${message}`) }

	let source: string
	try {
		source = readFileSync(sourcePath, 'utf8')
	} catch {
		return fail(`cannot read ${sourcePath}`)
	}

	const match = FRONTMATTER.exec(source)
	if (!match) return fail('missing YAML frontmatter (--- … --- at the top)')
	let yaml: unknown
	try {
		yaml = parseYaml(match[1]) ?? {}
	} catch (error) {
		return fail(`invalid YAML frontmatter: ${(error as Error).message}`)
	}
	const parsed = frontmatterSchema.safeParse(yaml)
	if (!parsed.success) return fail(describeIssues(parsed.error))
	const fm = parsed.data

	if (fm.type === 'letter') {
		if (fm.invoice || fm.timesheet) fail('invoice and timesheet need type: invoice')
		if (!fm.date) fail('date is required for letters')
		if (!fm.recipient) fail('recipient is required for letters')
	} else if (!fm.invoice) {
		fail('invoice (path to the Banana invoice JSON) is required for invoices')
	}

	// Body: split at ::items, reject any other directive
	const bodyStartLine = match[0].split('\n').length - (match[0].endsWith('\n') ? 1 : 0)
	const bodyLines = source.slice(match[0].length).split('\n')
	let marker = -1
	bodyLines.forEach((line, i) => {
		const lineNumber = bodyStartLine + i + 1
		if (line.trim() === '::items') {
			if (fm.type !== 'invoice') fail(`line ${lineNumber}: ::items is only allowed in an invoice`)
			if (marker !== -1) fail(`line ${lineNumber}: second ::items`)
			marker = i
		} else if (/^::\w/.test(line.trim())) {
			fail(`line ${lineNumber}: unknown directive ${line.trim()} (only ::items exists)`)
		}
	})
	const bodyBefore = (marker === -1 ? bodyLines : bodyLines.slice(0, marker)).join('\n')
	const bodyAfter = marker === -1 ? '' : bodyLines.slice(marker + 1).join('\n')

	const dir = dirname(sourcePath)
	let invoice = fm.invoice ? toInvoiceView(readJson(resolve(dir, fm.invoice), 'invoice JSON')) : undefined
	// An address fixed in the frontmatter must not be contradicted by Banana's on the QR-bill.
	if (invoice && fm.recipient) invoice = { ...invoice, debtor: undefined }
	const timesheet = fm.timesheet ? parseTimesheet(readJson(resolve(dir, fm.timesheet), 'timesheet JSON')) : undefined

	const recipient = fm.recipient ? lines(fm.recipient) : invoice!.customerAddress
	if (recipient.length === 0) fail('recipient is empty (frontmatter recipient or Banana customer address)')

	return {
		sourcePath,
		fileName,
		type: fm.type,
		sender: fm.sender,
		lang: fm.lang,
		date: fm.date ?? invoice!.date,
		subject: fm.subject,
		title: fm.title,
		recipient,
		signature: fm.signature,
		bodyBefore,
		bodyAfter,
		hasItemsMarker: marker !== -1,
		invoice,
		timesheet,
	}
}

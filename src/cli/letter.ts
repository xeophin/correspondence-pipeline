#!/usr/bin/env node
import { writeFile } from 'node:fs/promises'
import { dirname, join, parse } from 'node:path'
import { loadDocument } from '../lib/document.ts'
import { LetterError } from '../lib/errors.ts'
import { qrBillSvg } from '../lib/qr.ts'
import { loadSignature } from '../lib/signature.ts'
import { buildDocument } from './build.ts'
import { pdfPages } from './pdf-text.ts'
import { checkFont, printPdf, withPage } from './print.ts'
import { serveDir } from './serve.ts'
import { verifyLayout } from './verify.ts'

const FONT = 'Unica 77 LL'

async function main(args: string[]): Promise<void> {
	if (args.length !== 1) throw new LetterError('usage: letter <file.md>')
	const doc = loadDocument(args[0])
	// Validate here: errors inside the Astro build lose their LetterError type.
	if (doc.invoice) qrBillSvg(doc.invoice, doc.lang)
	loadSignature(doc)
	const build = await buildDocument(doc.sourcePath)
	try {
		const server = await serveDir(build.dir)
		try {
			const pdf = await withPage(server.url + '/', async page => {
				if (!await checkFont(page, FONT)) throw new LetterError(`font "${FONT}" is not installed`)
				return printPdf(page)
			})
			verifyLayout(await pdfPages(pdf), doc)
			const { dir, name } = parse(doc.sourcePath)
			await writeFile(join(dir, `${name}.pdf`), pdf)
		} finally {
			await server.close()
		}
	} finally {
		await build.cleanup()
	}
}

main(process.argv.slice(2)).catch(error => {
	if (error instanceof LetterError) {
		process.stderr.write(`letter: ${error.message}\n`)
		process.exit(1)
	}
	process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
	process.exit(2)
})

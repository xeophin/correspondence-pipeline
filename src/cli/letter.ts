#!/usr/bin/env node
import { writeFile } from 'node:fs/promises'
import { join, parse, resolve } from 'node:path'
import { configPath, loadUserConfig } from '../lib/config.ts'
import { loadDocument } from '../lib/document.ts'
import { LetterError } from '../lib/errors.ts'
import { hasQrBill, qrBillSvg } from '../lib/qr.ts'
import { scaffold, type DocumentType } from '../lib/scaffold.ts'
import { loadSignature } from '../lib/signature.ts'
import { buildDocument } from './build.ts'
import { pdfPages } from './pdf-text.ts'
import { printPdf, withPage } from './print.ts'
import { serveDir } from './serve.ts'
import { verifyLayout } from './verify.ts'

const NEW_USAGE = 'usage: letter new [letter|invoice] [name]'

/** `letter new`: writes a dated Markdown scaffold into the current directory, never over an existing file. */
async function newDocument(args: string[]): Promise<void> {
	if (args.length > 2) throw new LetterError(NEW_USAGE)
	const typed = args[0] === 'letter' || args[0] === 'invoice'
	const type: DocumentType = typed ? (args[0] as DocumentType) : 'letter'
	const name = typed ? args[1] : args.length === 1 ? args[0] : undefined
	if (!typed && args.length === 2) throw new LetterError(NEW_USAGE)
	const { fileName, content } = scaffold(type, name, new Date().toLocaleDateString('sv'))
	try {
		await writeFile(fileName, content, { flag: 'wx' })
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new LetterError(`${fileName} already exists`)
		throw error
	}
	process.stdout.write(`${fileName}\n`)
}

async function main(args: string[]): Promise<void> {
	if (args[0] === 'new') return newDocument(args.slice(1))
	if (args.length !== 1) throw new LetterError(`usage: letter <file.md> | letter new [letter|invoice] [name]`)
	// The build runs with the repo as cwd: pin a relative config path to the caller's cwd first.
	process.env.LETTER_CONFIG = resolve(configPath())
	loadUserConfig() // sender and brands are required; fail here with a LetterError
	const doc = loadDocument(args[0])
	// Validate here: errors inside the Astro build lose their LetterError type.
	if (doc.invoice && hasQrBill(doc.invoice)) qrBillSvg(doc.invoice, doc.lang)
	loadSignature(doc)
	const build = await buildDocument(doc.sourcePath)
	try {
		const server = await serveDir(build.dir)
		try {
			const pdf = await withPage(server.url + '/', printPdf)
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

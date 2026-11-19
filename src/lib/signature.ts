import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { configPath, loadUserConfig } from './config.ts'
import type { LetterDocument } from './document.ts'
import { LetterError } from './errors.ts'

const MIME: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.svg': 'image/svg+xml',
}

/** The signature image as a data URI when the document asks for one. Throws LetterError. */
export function loadSignature(doc: LetterDocument): string | undefined {
	if (!doc.signature) return undefined
	const { signature } = loadUserConfig()
	if (!signature)
		throw new LetterError(`${doc.fileName}: signature: true, but ${configPath()} names no signature image`)
	const type = MIME[extname(signature).toLowerCase()]
	if (!type) throw new LetterError(`signature image ${signature}: use .png, .jpg or .svg`)
	try {
		return `data:${type};base64,${readFileSync(signature).toString('base64')}`
	} catch {
		throw new LetterError(`signature image ${signature}: not found`)
	}
}

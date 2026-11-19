import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import type { Loader } from 'astro/loaders'
import { loadDocument, type LetterDocument } from './document.ts'
import { loadSignature } from './signature.ts'

/** What the page receives: the validated document plus its rendered Markdown parts. */
export interface LoadedLetter {
	doc: LetterDocument
	htmlBefore: string
	htmlAfter: string
	/** Data URI of the signature image, if the document asks for one. */
	signature?: string
}

/** Loads the one document named by LETTER_FILE (default: examples/letter.md) as entry `current`. */
export function letterLoader(): Loader {
	return {
		name: 'letter-loader',
		load: async ({ store, config, renderMarkdown, watcher }) => {
			const path = resolve(
				fileURLToPath(config.root),
				process.env.LETTER_FILE ?? 'examples/invoice/invoice-with-hours.md',
			)
			const doc = loadDocument(path)
			const [before, after] = await Promise.all([renderMarkdown(doc.bodyBefore), renderMarkdown(doc.bodyAfter)])
			const data: LoadedLetter = { doc, htmlBefore: before.html, htmlAfter: after.html, signature: loadSignature(doc) }
			store.clear()
			store.set({ id: 'current', data: data as unknown as Record<string, unknown> })
			watcher?.add(path)
		},
	}
}

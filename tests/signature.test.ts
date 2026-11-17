import { readFileSync } from 'node:fs'
import { extractImages } from 'unpdf'
import { afterEach, expect, test } from 'vitest'
import { loadDocument } from '../src/lib/document.ts'
import { loadSignature } from '../src/lib/signature.ts'
import { renderPdf } from './helpers/render.ts'
import { docDir, writeDoc } from './helpers/docs.ts'

afterEach(() => { delete process.env.LETTER_CONFIG })

const letter = (signature: boolean) => writeDoc(docDir(), 'brief.md',
	readFileSync('examples/letter.md', 'utf8').replace('type: letter', `type: letter\nsignature: ${signature}`))

test('signature: true embeds the configured image above the name', async () => {
	process.env.LETTER_CONFIG = 'tests/fixtures/config-signature.json'
	const { pdf, pages } = await renderPdf(letter(true))
	const images = await extractImages(new Uint8Array(pdf), 1)
	expect(images.length).toBeGreaterThan(0)
	// the name is still the last body line
	const name = pages[0].filter(i => i.str === 'Hanna Beispiel').at(-1)!
	const greeting = pages[0].find(i => i.str === 'Herzliche Grüsse')!
	expect(name.topMm - greeting.bottomMm).toBeGreaterThan(10)
})

test('signature: false embeds no image', async () => {
	const { pdf } = await renderPdf(letter(false))
	expect(await extractImages(new Uint8Array(pdf), 1)).toEqual([])
})

test('signature: true without a configured signature is an error', () => {
	process.env.LETTER_CONFIG = 'examples/config.json'
	expect(() => loadSignature(loadDocument(letter(true)))).toThrow(/signature/)
})

test('a configured signature file that does not exist is an error', () => {
	process.env.LETTER_CONFIG = 'tests/fixtures/config-missing-signature.json'
	expect(() => loadSignature(loadDocument(letter(true)))).toThrow(/nope\.png/)
})

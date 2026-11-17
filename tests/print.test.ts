import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { serveDir } from '../src/cli/serve.ts'
import { checkFont, printPdf, withPage } from '../src/cli/print.ts'
import { pageText, pdfPages } from './helpers/pdf.ts'

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))

async function onFixture<T>(name: string, fn: Parameters<typeof withPage<T>>[1]): Promise<T> {
	const server = await serveDir(fixtures)
	try {
		return await withPage(`${server.url}/${name}`, fn)
	} finally {
		await server.close()
	}
}

test('margin boxes number pages and skip the running header on page 1', async () => {
	const pages = await pdfPages(await onFixture('margin-boxes.html', printPdf))
	expect(pages).toHaveLength(2)
	expect(pageText(pages[0])).toContain('Seite 1 von 2')
	expect(pageText(pages[1])).toContain('Seite 2 von 2')
	expect(pageText(pages[0])).not.toContain('RUNNING')
	expect(pageText(pages[1])).toContain('RUNNING')
})

test('checkFont tells an installed font from a missing one', async () => {
	await onFixture('margin-boxes.html', async page => {
		expect(await checkFont(page, 'Unica 77 LL')).toBe(true)
		expect(await checkFont(page, 'No Such Font 123')).toBe(false)
	})
})

import { buildDocument } from '../../src/cli/build.ts'
import { printPdf, withPage } from '../../src/cli/print.ts'
import { serveDir } from '../../src/cli/serve.ts'
import { pdfPages, type TextItem } from './pdf.ts'

/** Builds and prints one document without the CLI's checks. */
export async function renderPdf(mdPath: string): Promise<{ pdf: Uint8Array; pages: TextItem[][] }> {
	const build = await buildDocument(mdPath)
	try {
		const server = await serveDir(build.dir)
		try {
			const pdf = await withPage(server.url + '/', printPdf)
			return { pdf, pages: await pdfPages(pdf) }
		} finally {
			await server.close()
		}
	} finally {
		await build.cleanup()
	}
}

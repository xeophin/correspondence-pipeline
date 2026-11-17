import { extractText, getDocumentProxy } from 'unpdf'

export interface TextItem {
	str: string
	xMm: number
	topMm: number
	rightMm: number
	bottomMm: number
}

const PT_TO_MM = 25.4 / 72

/** Text items of every page, with positions in mm measured from the page's top-left corner. */
export async function pdfPages(pdf: Uint8Array): Promise<TextItem[][]> {
	const doc = await getDocumentProxy(new Uint8Array(pdf))
	const pages: TextItem[][] = []
	for (let n = 1; n <= doc.numPages; n++) {
		const page = await doc.getPage(n)
		const pageHeight = page.getViewport({ scale: 1 }).height
		const content = await page.getTextContent()
		const items: TextItem[] = []
		for (const item of content.items) {
			if (!('str' in item) || item.str.trim() === '') continue
			const [, , , , x, baseline] = item.transform
			const top = pageHeight - baseline - item.height
			items.push({
				str: item.str,
				xMm: x * PT_TO_MM,
				topMm: top * PT_TO_MM,
				rightMm: (x + item.width) * PT_TO_MM,
				bottomMm: (pageHeight - baseline) * PT_TO_MM,
			})
		}
		pages.push(items)
	}
	return pages
}

export const pageText = (items: TextItem[]): string => items.map(i => i.str).join(' ')

export { extractText }

import { chromium, type Page } from 'playwright'

/** Opens `url` in headless Chromium, waits for fonts, runs `fn`, and always closes the browser. */
export async function withPage<T>(url: string, fn: (page: Page) => Promise<T>): Promise<T> {
	const browser = await chromium.launch()
	try {
		const page = await browser.newPage()
		await page.goto(url, { waitUntil: 'load' })
		await page.evaluate(() => document.fonts.ready)
		return await fn(page)
	} finally {
		await browser.close()
	}
}

export async function printPdf(page: Page): Promise<Uint8Array> {
	return page.pdf({ preferCSSPageSize: true, printBackground: true })
}


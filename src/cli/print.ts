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

/** True if `family` is installed: text set in it measures differently from the monospace fallback. */
export async function checkFont(page: Page, family: string): Promise<boolean> {
	return page.evaluate(family => {
		const context = document.createElement('canvas').getContext('2d')!
		const sample = 'Hamburgefonstiv 0123456789 mmmmmwwwwwiiiii'
		context.font = '40px monospace'
		const fallback = context.measureText(sample).width
		context.font = `40px "${family}", monospace`
		return context.measureText(sample).width !== fallback
	}, family)
}

import { t, type Lang } from './i18n.ts'

/** Page margins in mm. Page 1 content is positioned against these (see Document.astro). */
export const PAGE_MARGIN = { top: 15, right: 15, bottom: 25, left: 20 } as const

/** Top margin from page 2 on, leaving room for the running header. */
export const CONTINUATION_TOP_MARGIN = 28

/** A quoted CSS string literal. */
export function cssString(s: string): string {
	return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ')}"`
}

export interface PageCssOptions {
	runningHeader: string
	fileName: string
	footerLines: string[]
	lang: Lang
}

/** The @page rules: A4, footer and page counter on every page, running header from page 2 on. */
export function pageCss({ runningHeader, fileName, footerLines, lang }: PageCssOptions): string {
	const m = PAGE_MARGIN
	const box = `font-family: "Unica 77 LL", sans-serif; font-size: 7.5pt; line-height: 1.4; white-space: pre;`
	return `
@page {
	size: A4;
	margin: ${CONTINUATION_TOP_MARGIN}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;
	@top-left { content: ${cssString(runningHeader)}; ${box} font-size: 9pt; vertical-align: bottom; padding-bottom: 8mm; }
	@bottom-left { content: ${cssString(footerLines.join('\n'))}; ${box} vertical-align: top; padding-top: 4mm; }
	@bottom-center { content: ${cssString(fileName)}; ${box} vertical-align: top; padding-top: 4mm; }
	@bottom-right { content: ${cssString(t(lang, 'page') + ' ')} counter(page) ${cssString(' ' + t(lang, 'page.of') + ' ')} counter(pages); ${box} vertical-align: top; padding-top: 4mm; }
}
@page :first {
	margin-top: ${m.top}mm;
	@top-left { content: none; }
}
`
}

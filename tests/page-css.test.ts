import { expect, test } from 'vitest'
import { cssString, pageCss } from '../src/lib/page-css.ts'

test('cssString escapes backslashes, quotes and newlines', () => {
	expect(cssString('Bewerbung "Müller"\\x.md')).toBe('"Bewerbung \\"Müller\\"\\\\x.md"')
	expect(cssString('a\nb')).toBe('"a\\A b"')
})

test('pageCss puts the page counter, file name and running header into margin boxes', () => {
	const css = pageCss({
		runningHeader: 'example.org/studio / Rechnung 2026-042',
		fileName: 'a "b".md',
		footerLines: ['Hanna Beispiel'],
		lang: 'en',
	})
	expect(css).toContain('"Page " counter(page) " of " counter(pages)')
	expect(css).toContain('"a \\"b\\".md"')
	expect(css).toContain('"example.org/studio / Rechnung 2026-042"')
	expect(css).toMatch(/@page\s*:first\s*{[^}]*@top-/)
})

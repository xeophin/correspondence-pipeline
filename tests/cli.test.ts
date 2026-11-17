import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { pageText, pdfPages } from './helpers/pdf.ts'
import { LETTER_FRONTMATTER } from './helpers/docs.ts'

const CLI = resolve('src/cli/letter.ts')

function run(mdPath: string) {
	const cwd = mkdtempSync(join(tmpdir(), 'letter-cwd-'))
	return spawnSync(process.execPath, [CLI, mdPath], { cwd, encoding: 'utf8' })
}

function tempDoc(name: string, content: string): { md: string; pdf: string } {
	const dir = mkdtempSync(join(tmpdir(), 'letter-cli-'))
	const md = join(dir, name)
	writeFileSync(md, content)
	return { md, pdf: md.replace(/\.md$/, '.pdf') }
}

test('writes the PDF next to a file with quotes and umlauts in its name', async () => {
	const { md, pdf } = tempDoc('Bewerbung "Müller".md', readFileSync('examples/letter.md', 'utf8'))
	const result = run(md)
	expect(result.stderr).toBe('')
	expect(result.status).toBe(0)
	expect(existsSync(pdf)).toBe(true)
	const pages = await pdfPages(readFileSync(pdf))
	expect(pageText(pages[0])).toContain('Bewerbung "Müller".md')
})

test('six recipient lines do not fit the envelope window', () => {
	const md = LETTER_FRONTMATTER.replace('3000 Bern', '3000 Bern\n  Schweiz\n  Postfach 1\n  z. H. Buchhaltung') + 'Text\n'
	const { md: path, pdf } = tempDoc('zu-lang.md', md)
	const result = run(path)
	expect(result.status).toBe(1)
	expect(result.stderr).toMatch(/envelope window/)
	expect(existsSync(pdf)).toBe(false)
})

test('a 70-character recipient line does not fit the envelope window', () => {
	const md = LETTER_FRONTMATTER.replace('Muster AG', 'Muster Aktiengesellschaft für ausserordentlich lange Firmennamen Zürich') + 'Text\n'
	const { md: path, pdf } = tempDoc('zu-breit.md', md)
	const result = run(path)
	expect(result.status).toBe(1)
	expect(result.stderr).toMatch(/envelope window/)
	expect(existsSync(pdf)).toBe(false)
})

test('a missing invoice JSON names the path and writes nothing', () => {
	const { md, pdf } = tempDoc('r.md', '---\ntype: invoice\nsubject: X\ninvoice: ./nope.json\n---\nText\n')
	const result = run(md)
	expect(result.status).toBe(1)
	expect(result.stderr).toMatch(/^letter: .*nope\.json/)
	expect(existsSync(pdf)).toBe(false)
})

test('a missing file is an error', () => {
	const result = run('/nonexistent/brief.md')
	expect(result.status).toBe(1)
	expect(result.stderr).toMatch(/brief\.md/)
})

test('overwrites an existing PDF', () => {
	const { md, pdf } = tempDoc('brief.md', readFileSync('examples/letter.md', 'utf8'))
	writeFileSync(pdf, 'old')
	utimesSync(pdf, new Date(2000, 0, 1), new Date(2000, 0, 1))
	expect(run(md).status).toBe(0)
	expect(readFileSync(pdf).subarray(0, 4).toString()).toBe('%PDF')
	expect(statSync(pdf).mtime.getFullYear()).toBeGreaterThan(2000)
})

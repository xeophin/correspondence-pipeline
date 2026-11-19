import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { loadUserConfig } from '../src/lib/config.ts'

afterEach(() => { delete process.env.LETTER_CONFIG })

test('loads the config named by LETTER_CONFIG', () => {
	process.env.LETTER_CONFIG = 'examples/config.json'
	const config = loadUserConfig()
	expect(config.sender.name).toBe('Hanna Beispiel')
	expect(config.brands.business).toBe('example.org/studio')
	expect(config.signature).toBeUndefined()
})

test.each([
	['sender', { brands: { business: 'a/b', personal: 'c/d' } }, /sender\.name/],
	['a sender field', { sender: { name: 'X' }, brands: { business: 'a/b', personal: 'c/d' } }, /sender\.street/],
	['brands', { sender: { name: 'a', street: 'b', zip: 'c', city: 'd', country: 'e', email: 'f', phone: 'g' } }, /brands\.business/],
])('a config without %s is an error', (_, content, message) => {
	const dir = mkdtempSync(join(tmpdir(), 'letter-config-'))
	writeFileSync(join(dir, 'config.json'), JSON.stringify(content))
	process.env.LETTER_CONFIG = join(dir, 'config.json')
	expect(() => loadUserConfig()).toThrow(message)
})

test('resolves the signature path against the config file', () => {
	const dir = mkdtempSync(join(tmpdir(), 'letter-config-'))
	writeFileSync(join(dir, 'config.json'), JSON.stringify({ ...JSON.parse(readFileSync('examples/config.json', 'utf8')), signature: 'sig.png' }))
	process.env.LETTER_CONFIG = join(dir, 'config.json')
	expect(loadUserConfig().signature).toBe(join(dir, 'sig.png'))
})

test('a missing config says where it was looked for', () => {
	process.env.LETTER_CONFIG = '/nonexistent/config.json'
	expect(() => loadUserConfig()).toThrow(/\/nonexistent\/config\.json/)
})

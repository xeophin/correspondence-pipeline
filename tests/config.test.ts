import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { loadUserConfig } from '../src/lib/config.ts'

afterEach(() => { delete process.env.LETTER_CONFIG })

test('loads the config named by LETTER_CONFIG', () => {
	process.env.LETTER_CONFIG = 'examples/config.json'
	expect(loadUserConfig()).toEqual({})
})

test('resolves the signature path against the config file', () => {
	const dir = mkdtempSync(join(tmpdir(), 'letter-config-'))
	writeFileSync(join(dir, 'config.json'), JSON.stringify({ signature: 'sig.png' }))
	process.env.LETTER_CONFIG = join(dir, 'config.json')
	expect(loadUserConfig().signature).toBe(join(dir, 'sig.png'))
})

test('a missing config says where it was looked for', () => {
	process.env.LETTER_CONFIG = '/nonexistent/config.json'
	expect(() => loadUserConfig()).toThrow(/\/nonexistent\/config\.json/)
})

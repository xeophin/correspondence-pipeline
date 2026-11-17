import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { LetterError } from './errors.ts'

/** Per-user settings that must not live in the repo. */
export interface UserConfig {
	/** Absolute path of the signature image. */
	signature?: string
}

export function configPath(): string {
	return process.env.LETTER_CONFIG ?? join(homedir(), '.config', 'letter', 'config.json')
}

export function loadUserConfig(): UserConfig {
	const path = resolve(configPath())
	let raw: unknown
	try {
		raw = JSON.parse(readFileSync(path, 'utf8'))
	} catch (error) {
		const reason = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'not found' : (error as Error).message
		throw new LetterError(`user config ${path}: ${reason} (set LETTER_CONFIG to use another file)`)
	}
	const config: UserConfig = {}
	const { signature } = raw as { signature?: unknown }
	if (typeof signature === 'string' && signature !== '') config.signature = resolve(dirname(path), signature)
	return config
}

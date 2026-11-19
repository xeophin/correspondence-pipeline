import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { LetterError } from './errors.ts'

/** The sender, printed in the return address, footer and QR-bill. */
export interface Sender {
	name: string
	street: string
	zip: string
	city: string
	country: string
	email: string
	phone: string
}

/** Per-user settings that must not live in the repo. */
export interface UserConfig {
	sender: Sender
	/** Header brands as `first/second`, one per `sender:` value. */
	brands: { business: string; personal: string }
	/** Absolute path of the signature image. */
	signature?: string
}

const SENDER_KEYS = ['name', 'street', 'zip', 'city', 'country', 'email', 'phone'] as const

export function configPath(): string {
	return process.env.LETTER_CONFIG ?? join(homedir(), '.config', 'letter', 'config.json')
}

export function loadUserConfig(): UserConfig {
	const path = resolve(configPath())
	const fail = (reason: string) => new LetterError(`user config ${path}: ${reason} (set LETTER_CONFIG to use another file)`)
	let raw: unknown
	try {
		raw = JSON.parse(readFileSync(path, 'utf8'))
	} catch (error) {
		throw fail((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'not found' : (error as Error).message)
	}
	const { sender, brands, signature } = raw as { sender?: Record<string, unknown>; brands?: Record<string, unknown>; signature?: unknown }
	for (const key of SENDER_KEYS) {
		if (typeof sender?.[key] !== 'string' || sender[key] === '') throw fail(`sender.${key} is missing`)
	}
	for (const key of ['business', 'personal'] as const) {
		const brand = brands?.[key]
		if (typeof brand !== 'string' || !/^[^/]+\/[^/]+$/.test(brand)) throw fail(`brands.${key} must look like "first/second"`)
	}
	const config = { sender, brands } as unknown as UserConfig
	if (typeof signature === 'string' && signature !== '') config.signature = resolve(dirname(path), signature)
	return config
}

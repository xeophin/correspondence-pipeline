import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'astro'

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** Builds the one-page site for `mdPath` into a temp dir. */
export async function buildDocument(mdPath: string): Promise<{ dir: string; cleanup(): Promise<void> }> {
	const tmp = await mkdtemp(join(tmpdir(), 'letter-build-'))
	const cleanup = () => rm(tmp, { recursive: true, force: true })
	process.env.LETTER_FILE = resolve(mdPath)
	try {
		await build({
			root: REPO_ROOT,
			outDir: join(tmp, 'dist'),
			cacheDir: join(tmp, 'cache'),
			logLevel: 'error',
		})
	} catch (error) {
		await cleanup()
		throw error
	}
	return { dir: join(tmp, 'dist'), cleanup }
}

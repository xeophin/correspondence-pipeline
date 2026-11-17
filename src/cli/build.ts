import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'astro'

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

/**
 * Builds the one-page site for `mdPath` into its own temp dir under the repo's
 * git-ignored `.astro/builds/`. Astro's prerender step must run inside the
 * working directory to resolve node_modules, so the build runs with the repo as cwd.
 */
export async function buildDocument(mdPath: string): Promise<{ dir: string; cleanup(): Promise<void> }> {
	const sourcePath = resolve(mdPath)
	const builds = join(REPO_ROOT, '.astro', 'builds')
	await mkdir(builds, { recursive: true })
	const tmp = await mkdtemp(join(builds, 'letter-'))
	const cleanup = () => rm(tmp, { recursive: true, force: true })
	const cwd = process.cwd()
	process.env.LETTER_FILE = sourcePath
	try {
		process.chdir(REPO_ROOT)
		await build({
			root: REPO_ROOT,
			outDir: join(tmp, 'dist'),
			cacheDir: join(tmp, 'cache'),
			logLevel: 'error',
		})
	} catch (error) {
		await cleanup()
		throw error
	} finally {
		process.chdir(cwd)
	}
	return { dir: join(tmp, 'dist'), cleanup }
}

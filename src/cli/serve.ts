import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import type { AddressInfo } from 'node:net'

const MIME: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.woff2': 'font/woff2',
	'.json': 'application/json',
}

/** Serves a directory on 127.0.0.1 with an ephemeral port. */
export async function serveDir(dir: string): Promise<{ url: string; close(): Promise<void> }> {
	const root = normalize(dir + sep)
	const server = createServer(async (req, res) => {
		let path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
		if (path.endsWith('/')) path += 'index.html'
		const file = normalize(join(root, path))
		if (!file.startsWith(root)) {
			res.writeHead(403).end()
			return
		}
		try {
			const body = await readFile(file)
			res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(body)
		} catch {
			res.writeHead(404).end()
		}
	})
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
	const { port } = server.address() as AddressInfo
	return {
		url: `http://127.0.0.1:${port}`,
		close: () => new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve()))),
	}
}

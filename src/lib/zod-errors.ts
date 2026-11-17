import type { z } from 'zod'

/** One line per issue: `path: message`, with unknown keys spelled out. */
export function describeIssues(error: z.ZodError): string {
	return error.issues.map(issue => {
		const path = issue.path.join('.')
		const message = issue.code === 'unrecognized_keys' ? `unknown key ${issue.keys.join(', ')}` : issue.message
		return path ? `${path}: ${message}` : message
	}).join('; ')
}

/** A problem with the user's input. The CLI prints its message and exits 1. */
export class LetterError extends Error {
	override name = 'LetterError'
}

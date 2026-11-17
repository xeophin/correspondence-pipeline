import { defineCollection } from 'astro:content'
import { letterLoader } from './lib/letter-loader.ts'

export const collections = {
	letter: defineCollection({ loader: letterLoader() }),
}

import { resolve } from 'node:path'
import { beforeEach } from 'vitest'

// Every test prints with the fictional sender unless it names another config.
const useExampleConfig = () => {
	process.env.LETTER_CONFIG = resolve('examples/config.json')
}
useExampleConfig()
beforeEach(useExampleConfig)

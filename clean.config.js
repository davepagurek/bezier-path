// @ts-check
import { rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { input, output } from './rollup.config.js'

/** @type {import('node:fs').RmOptions} */
const options = {
  force: true,
  recursive: true,
}

const dirs = [
  resolve(dirname(input)),
  resolve(dirname(output.iife)),
]

rmSync(dirs[0], options)
rmSync(dirs[1], options)

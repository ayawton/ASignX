import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const python = process.env.RECOGNITION_PYTHON || (process.platform === 'win32' ? 'py' : 'python3')
const args = [...(!process.env.RECOGNITION_PYTHON && process.platform === 'win32' ? ['-3.14'] : []), '-B', fileURLToPath(new URL('../recognition/tests/test_english_words.py', import.meta.url))]
const result = spawnSync(python, args, { stdio: 'inherit', windowsHide: true, timeout: 30000 })
if (result.error) console.error('NLP tests could not finish:', result.error.message)
process.exitCode = result.status ?? 1

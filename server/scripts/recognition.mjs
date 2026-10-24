import 'dotenv/config'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const python = process.env.RECOGNITION_PYTHON || (process.platform === 'win32' ? 'py' : 'python3')
const target = process.argv.includes('--test') ? '../recognition/tests/test_recognition.py' : '../recognition/run.py'
const args = [...(!process.env.RECOGNITION_PYTHON && process.platform === 'win32' ? ['-3.14'] : []), '-B', fileURLToPath(new URL(target, import.meta.url))]
const child = spawn(python, args, { stdio: 'inherit', windowsHide: true })
child.on('error', () => { console.error('Python could not start. Configure RECOGNITION_PYTHON in server/.env.'); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => child.kill(signal))

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
export default defineConfig({ plugins: [react()], server: {
 fs: { allow: [fileURLToPath(new URL('.', import.meta.url))], deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/private/**', '**/.recognition-deps/**', '**/.onnx-export-deps/**'] },
 proxy: { '/api': 'http://localhost:3000', '/health': 'http://localhost:3000' },
} })

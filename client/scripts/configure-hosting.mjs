import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Run before deploying: Vercel reads routing configuration before the build.
let url
try { url = new URL(process.argv[2]) } catch { throw new Error('Usage: node scripts/configure-hosting.mjs https://YOUR-API.up.railway.app') }
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    url.pathname !== '/' || /(^|\.)(localhost|invalid|example\.com)$/.test(url.hostname)) {
  throw new Error('Supply the real HTTPS API origin without credentials, paths, queries or fragments.')
}
const config = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api/:path*', destination: `${url.origin}/api/:path*` },
    { source: '/(.*)', destination: '/index.html' },
  ],
  headers: [{ source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] }],
}
writeFileSync(fileURLToPath(new URL('../vercel.json', import.meta.url)), `${JSON.stringify(config, null, 2)}\n`)
console.log('Configured client/vercel.json. Commit it before deploying Vercel.')

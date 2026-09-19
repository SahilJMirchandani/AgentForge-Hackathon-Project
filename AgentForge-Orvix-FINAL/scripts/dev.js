import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const viteBin = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const serverScript = resolve(projectRoot, 'server', 'index.js')

console.log('🚀 Checking AgentForge Backend Server (http://127.0.0.1:4000)...')
const serverProcess = spawn(process.execPath, ['--env-file-if-exists=.env', serverScript], {
  cwd: projectRoot,
  stdio: 'inherit',
})

console.log('⚡ Starting AgentForge Frontend (Vite)...')
const frontendProcess = spawn(process.execPath, [viteBin], {
  cwd: projectRoot,
  stdio: 'inherit',
})

function cleanup() {
  console.log('\nStopping AgentForge processes...')
  try { serverProcess.kill() } catch {}
  try { frontendProcess.kill() } catch {}
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

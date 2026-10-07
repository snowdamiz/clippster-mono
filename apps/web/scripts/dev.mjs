import { spawn } from 'node:child_process'
const children = ['dev:server', 'dev:ui'].map((script) =>
  spawn('npm', ['run', script, '--workspaces=false'], { stdio: 'inherit' })
)
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  children.forEach((child) => child.kill('SIGTERM'))
  process.exitCode = code
}
children.forEach((child) => child.on('exit', (code) => stop(code ?? 1)))
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

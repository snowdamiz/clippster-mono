import { spawn } from 'node:child_process'
export async function run(
  binary: string,
  args: string[],
  signal: AbortSignal,
  timeout = 30 * 60_000,
  onOutput?: (text: string) => void
): Promise<string> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      env: { ...process.env, NO_COLOR: '1' }
    })
    let output = ''
    let errorOutput = ''
    let failure: Error | undefined
    const stop = (error: Error) => {
      failure = error
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL')
        else child.kill('SIGKILL')
      } catch { /* The child may already have exited. */ }
    }
    const abort = () => stop(new Error('Cancelled.'))
    signal.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(
      () => stop(new Error('Media processing exceeded its time limit.')),
      timeout
    )
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      output += text
      onOutput?.(text)
      if (output.length > 8 * 1024 ** 2)
        stop(new Error('Media tool output exceeded its size limit.'))
    })
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      errorOutput = (errorOutput + text).slice(-128_000)
      onOutput?.(text)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(new Error(`Could not start ${binary}: ${error.message}`))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      if (failure) reject(failure)
      else if (code !== 0)
        reject(new Error(`${binary} failed: ${(errorOutput || output).slice(-1500)}`))
      else resolve(output)
    })
  })
}

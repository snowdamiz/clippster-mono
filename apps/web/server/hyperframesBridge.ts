import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

type Reply =
  | { id: string | null; type: 'ready' }
  | { id: string; type: 'progress'; progress: number; stage?: string; message?: string }
  | { id: string; type: 'result'; data: unknown }
  | { id: string; type: 'error'; error: string; cancelled?: boolean }

type Pending = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  onProgress?: (progress: number, stage?: string) => void
  signal?: AbortSignal
  abort?: () => void
}

/** One isolated renderer process for a web edit. The worker owns its lifetime. */
export class HyperframesBridge {
  private readonly child: ChildProcessWithoutNullStreams
  private readonly pending = new Map<string, Pending>()
  private readonly ready: Promise<void>
  private readyResolve!: () => void
  private readyReject!: (error: Error) => void
  private closed = false

  constructor(scriptPath: string, env: NodeJS.ProcessEnv = process.env) {
    this.ready = new Promise<void>((resolveReady, rejectReady) => {
      this.readyResolve = resolveReady
      this.readyReject = rejectReady
    })
    void this.ready.catch(() => {})
    this.child = spawn(process.execPath, [resolve(scriptPath)], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...env, HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1', HYPERFRAMES_SKIP_SKILLS: '1' },
    })
    createInterface({ input: this.child.stdout }).on('line', line => this.receive(line))
    this.child.stderr.on('data', () => { /* Never expose renderer logs or local paths to clients. */ })
    this.child.on('error', error => this.fail(new Error(`Could not start renderer: ${error.message}`)))
    this.child.on('close', code => this.fail(new Error(`Renderer exited (${code ?? 'signal'}).`)))
  }

  private receive(line: string) {
    let reply: Reply
    try { reply = JSON.parse(line) as Reply } catch { return }
    if (reply.type === 'ready') { this.readyResolve(); return }
    const entry = this.pending.get(reply.id)
    if (!entry) return
    if (reply.type === 'progress') { entry.onProgress?.(reply.progress, reply.stage); return }
    this.pending.delete(reply.id)
    if (entry.abort) entry.signal?.removeEventListener('abort', entry.abort)
    if (reply.type === 'result') entry.resolve(reply.data)
    else entry.reject(new Error(reply.cancelled ? 'Cancelled' : reply.error))
  }

  private fail(error: Error) {
    if (this.closed) return
    this.closed = true
    this.readyReject(error)
    for (const entry of this.pending.values()) {
      if (entry.abort) entry.signal?.removeEventListener('abort', entry.abort)
      entry.reject(error)
    }
    this.pending.clear()
  }

  async request<T>(op: string, params: Record<string, unknown> = {}, options: {
    signal?: AbortSignal
    onProgress?: (progress: number, stage?: string) => void
  } = {}): Promise<T> {
    await this.ready
    if (this.closed) throw new Error('Renderer is closed.')
    options.signal?.throwIfAborted()
    const id = randomUUID()
    return new Promise<T>((resolveRequest, rejectRequest) => {
      const abort = () => {
        this.child.stdin.write(`${JSON.stringify({ id: randomUUID(), op: 'cancel', target: id })}\n`)
      }
      const entry: Pending = {
        resolve: value => resolveRequest(value as T), reject: rejectRequest,
        onProgress: options.onProgress, signal: options.signal, abort,
      }
      this.pending.set(id, entry)
      options.signal?.addEventListener('abort', abort, { once: true })
      this.child.stdin.write(`${JSON.stringify({ id, op, ...params })}\n`, error => {
        if (error) {
          this.pending.delete(id)
          options.signal?.removeEventListener('abort', abort)
          rejectRequest(error)
        }
      })
    })
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.child.stdin.end()
    const exited = await new Promise<boolean>(resolveExit => {
      const timer = setTimeout(() => resolveExit(false), 5_000)
      this.child.once('close', () => { clearTimeout(timer); resolveExit(true) })
    })
    if (!exited) this.child.kill('SIGKILL')
  }
}

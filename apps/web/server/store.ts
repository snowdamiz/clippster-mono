import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { WebProject, WebJob } from '@clippster/shared-types'
import { HttpError } from './errors'
export interface StoredJob extends WebJob {
  owner: string
  sessionId: string
  payload: Record<string, unknown>
}
export interface Session {
  id: string
  owner: string
  token: string
  expires: number
}
export class Store {
  readonly db: DatabaseSync
  constructor(readonly directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(join(directory, 'workspace.sqlite'))
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS projects_owner ON projects(owner);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        owner TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, token TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS oauth_attempts (id TEXT PRIMARY KEY, state TEXT NOT NULL, verifier TEXT NOT NULL, expires INTEGER NOT NULL);`)
  }
  saveOAuthAttempt(id: string, state: string, verifier: string) {
    this.db.prepare('DELETE FROM oauth_attempts WHERE expires <= ?').run(Date.now())
    this.db
      .prepare('INSERT INTO oauth_attempts VALUES (?, ?, ?, ?)')
      .run(id, state, verifier, Date.now() + 600_000)
  }
  takeOAuthAttempt(id: string, state: string): string | undefined {
    const row = this.db
      .prepare(
        'DELETE FROM oauth_attempts WHERE id = ? AND state = ? AND expires > ? RETURNING verifier'
      )
      .get(id, state, Date.now()) as { verifier: string } | undefined
    return row?.verifier
  }
  deleteOAuthAttempt(id: string) {
    this.db.prepare('DELETE FROM oauth_attempts WHERE id = ?').run(id)
  }
  list(owner: string): WebProject[] {
    return (
      this.db.prepare('SELECT data FROM projects WHERE owner = ?').all(owner) as { data: string }[]
    )
      .map((row) => JSON.parse(row.data) as WebProject)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }
  get(id: string, owner: string): WebProject {
    const row = this.db
      .prepare('SELECT data FROM projects WHERE id = ? AND owner = ?')
      .get(id, owner) as { data: string } | undefined
    if (!row) throw new HttpError(404, 'Project not found.')
    return JSON.parse(row.data)
  }
  create(name: string, owner: string): WebProject {
    const now = Date.now()
    const project: WebProject = {
      id: randomUUID(),
      name,
      sourceUrl: null,
      status: 'empty',
      duration: 0,
      width: 0,
      height: 0,
      hasAudio: false,
      clips: [],
      words: [],
      error: null,
      createdAt: now,
      updatedAt: now
    }
    this.db
      .prepare('INSERT INTO projects VALUES (?, ?, ?)')
      .run(project.id, owner, JSON.stringify(project))
    return project
  }
  save(project: WebProject, owner: string) {
    project.updatedAt = Date.now()
    this.db
      .prepare('UPDATE projects SET data = ? WHERE id = ? AND owner = ?')
      .run(JSON.stringify(project), project.id, owner)
  }
  delete(id: string, owner: string) {
    this.db.prepare('DELETE FROM projects WHERE id = ? AND owner = ?').run(id, owner)
  }
  jobs(projectId: string, owner: string): StoredJob[] {
    return (
      this.db
        .prepare(
          'SELECT data FROM jobs WHERE project_id = ? AND owner = ? ORDER BY rowid DESC LIMIT 30'
        )
        .all(projectId, owner) as { data: string }[]
    ).map((row) => JSON.parse(row.data))
  }
  activeJobs(): StoredJob[] {
    return (
      this.db
        .prepare("SELECT data FROM jobs WHERE status IN ('queued', 'running') ORDER BY rowid")
        .all() as { data: string }[]
    ).map((row) => JSON.parse(row.data))
  }
  job(id: string, owner: string): StoredJob {
    const row = this.db
      .prepare('SELECT data FROM jobs WHERE id = ? AND owner = ?')
      .get(id, owner) as { data: string } | undefined
    if (!row) throw new HttpError(404, 'Job not found.')
    return JSON.parse(row.data)
  }
  saveJob(job: StoredJob) {
    this.db
      .prepare(
        'INSERT INTO jobs VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, data=excluded.data'
      )
      .run(job.id, job.projectId, job.owner, job.status, JSON.stringify(job))
    if (!['queued', 'running'].includes(job.status)) {
      this.db
        .prepare(
          "DELETE FROM jobs WHERE project_id = ? AND status NOT IN ('queued', 'running') AND id NOT IN (SELECT id FROM jobs WHERE project_id = ? ORDER BY rowid DESC LIMIT 30)"
        )
        .run(job.projectId, job.projectId)
    }
  }
  saveSession(session: Session) {
    this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now())
    this.db
      .prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)')
      .run(session.id, session.owner, session.token, session.expires)
  }
  session(id: string): Session | undefined {
    return this.db
      .prepare('SELECT * FROM sessions WHERE id = ? AND expires > ?')
      .get(id, Date.now()) as Session | undefined
  }
  deleteSession(id: string) {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  }
  close() {
    this.db.close()
  }
}
export function publicJob({
  id,
  projectId,
  kind,
  status,
  progress,
  message,
  createdAt
}: WebJob): WebJob {
  return { id, projectId, kind, status, progress, message, createdAt }
}

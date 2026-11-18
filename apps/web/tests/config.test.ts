import { it, expect } from 'vitest'
import { resolve } from 'node:path'
import { readConfig } from '../server/config'

it('keeps the database with the data unless WEB_DATABASE_DIR moves it off a mounted data folder', () => {
  expect(readConfig({ WEB_DATA_DIR: '/data' }).databaseDir).toBe(resolve('/data'))
  expect(readConfig({ WEB_DATA_DIR: '/data', WEB_DATABASE_DIR: '/var/lib/clippster' }).databaseDir).toBe(resolve('/var/lib/clippster'))
})

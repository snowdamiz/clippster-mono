import { it, expect } from 'vitest'
import { readConfig } from '../server/config'

it('keeps the database with the data unless WEB_DATABASE_DIR moves it off a mounted data folder', () => {
  expect(readConfig({ WEB_DATA_DIR: '/data' }).databaseDir).toBe('/data')
  expect(readConfig({ WEB_DATA_DIR: '/data', WEB_DATABASE_DIR: '/var/lib/clippster' }).databaseDir).toBe('/var/lib/clippster')
})

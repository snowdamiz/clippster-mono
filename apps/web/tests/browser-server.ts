import { startFixture } from './fixtures'
const fixture = await startFixture({ port: 8091, origin: 'http://127.0.0.1:8091' })
console.log('Browser fixture is ready; authentication and AI responses are test fixtures.')
process.on('SIGTERM', async () => {
  await fixture.dispose()
  process.exit(0)
})
process.on('SIGINT', async () => {
  await fixture.dispose()
  process.exit(0)
})

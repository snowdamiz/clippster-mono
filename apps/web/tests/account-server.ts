import { startFixture } from './fixtures'
const fixture = await startFixture({ port: 8096, origin: 'http://127.0.0.1:8096', accountOrigin: 'http://127.0.0.1:8097' })
for (const event of ['SIGINT', 'SIGTERM']) process.on(event, async () => {
  await fixture.dispose()
  process.exit(0)
})

import { expect, it } from 'vitest'
import { creatorSkillCaptureText, publicPageText } from '../server/creatorSkillSourceCaptures'

it('extracts readable public page text without script or style content', () => {
  const text = publicPageText('<html><head><style>secret-style</style><script>secret-script</script></head><body><h1>Acme &amp; Co</h1><p>Published 2026-11-01<br>Figure: 42</p></body></html>')
  expect(text).toContain('Acme & Co')
  expect(text).toContain('Published 2026-11-01')
  expect(text).toContain('Figure: 42')
  expect(text).not.toContain('secret-script')
  expect(text).not.toContain('secret-style')
  const capture = creatorSkillCaptureText('source', 'Acme report', 'https://example.com/report', '2026-11-02T00:00:00.000Z', text)
  expect(capture).toContain('Requested URL: https://example.com/report')
  expect(capture).toContain('Captured at: 2026-11-02T00:00:00.000Z')
  expect(capture).toContain('Claim support and asset rights require human review.')
})

import { dirname, join } from 'node:path'
import type { Config } from './config'
import { run } from './process'
import { requireValue } from './errors'
const resolver = `
import json,re,sys
from urllib.parse import urlparse
from curl_cffi import requests
page=urlparse(sys.argv[1])
video_id=page.path.rsplit('/',1)[-1]
r=requests.get(sys.argv[1],impersonate='chrome',proxies={'https':sys.argv[2]},timeout=25)
r.raise_for_status()
if len(r.content)>8*1024*1024: raise ValueError('Video page exceeded the size limit')
text=r.text.replace('\\\\"','"')
match=re.search(r'"recording_url"\\s*:\\s*"(https:[^"]+)"',text)
if not match: raise ValueError('No archived playback source')
record=text[max(0,match.start()-1800):match.end()+300]
if not re.search(r'"id"\\s*:\\s*"'+re.escape(video_id)+'"',record): raise ValueError('Recording identity mismatch')
if re.search(r'"is_live"\\s*:\\s*true',record): raise ValueError('Recording is live')
duration=re.findall(r'"duration"\\s*:\\s*([0-9.]+)',record[:record.find('"recording_url"')])
if not duration: raise ValueError('Recording duration is unavailable')
source=json.loads('"'+match.group(1)+'"')
if urlparse(source).scheme!='https' or urlparse(source).hostname!='stream.kick.com': raise ValueError('Unexpected playback host')
print(json.dumps({'source':source,'duration':float(duration[-1])}))
`
export async function kickArchivedSource(url: string, proxy: string, config: Config, signal: AbortSignal) {
  const page = new URL(url)
  requireValue(['kick.com', 'www.kick.com'].includes(page.hostname) && /^\/[\w-]+\/videos\/[a-f\d-]{36}$/.test(page.pathname), 400, 'Use a completed Kick VOD link.')
  const python = process.env.WEB_PYTHON_PATH || (process.platform === 'win32' ? 'python' : join(dirname(config.ytdlp), 'python'))
  try {
    const result = JSON.parse(await run(python, ['-c', resolver, url, proxy], signal, 30_000))
    const source = new URL(result.source)
    requireValue(source.protocol === 'https:' && source.hostname === 'stream.kick.com' && !source.username && !source.password && (!source.port || source.port === '443') && Number.isFinite(result.duration) && result.duration > 0, 502, 'Kick returned an invalid recording.')
    return { source: source.href, duration: result.duration as number, is_live: false }
  } catch { throw new Error('Kick could not provide a completed playback source. Retry this VOD from Video Library.') }
}

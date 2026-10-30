import fs from 'node:fs/promises';import path from 'node:path';
process.env.HYPERFRAMES_FFMPEG_PATH=path.resolve('client/src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe');
process.env.HYPERFRAMES_FFPROBE_PATH=path.resolve('client/src-tauri/binaries/ffprobe-x86_64-pc-windows-msvc.exe');
process.env.HYPERFRAMES_NO_TELEMETRY='1';process.env.DO_NOT_TRACK='1';
const {render}=await import('../client/src-tauri/sidecars/hyperframes-renderer/lib/render.mjs');
const files=JSON.parse(await fs.readFile('.tmp-ai-video-qa/parity-files.json','utf8'));
const projectDir=(await fs.readFile('.tmp-ai-video-qa/visibility-project-path.txt','utf8')).trim();
// Deliberately change the live workspace after capturing the export version.
await fs.writeFile(path.join(projectDir,'index.html'),'<html><body>NEWER EDIT MUST NOT EXPORT</body></html>');
let last=-1;const result=await render({projectDir,files,outputPath:path.resolve('.tmp-ai-video-qa/export-parity.mp4'),fps:30},{signal:AbortSignal.timeout(120000),onProgress(p){const step=Math.floor(p*10);if(step!==last){last=step;console.log('Export',step*10+'%')}}});
console.log(JSON.stringify(result));
if(result.duration!==13)throw new Error('Export did not include scene trim');
await fs.writeFile('.tmp-ai-video-qa/parity-result.json',JSON.stringify(result));
console.log('PASS actual sidecar export uses frozen edited project despite newer live workspace');

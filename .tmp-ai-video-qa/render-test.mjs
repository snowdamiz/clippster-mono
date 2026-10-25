import path from 'node:path';
process.env.HYPERFRAMES_FFMPEG_PATH=path.resolve('client/src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe');
process.env.HYPERFRAMES_FFPROBE_PATH=path.resolve('client/src-tauri/binaries/ffprobe-x86_64-pc-windows-msvc.exe');
process.env.HYPERFRAMES_NO_TELEMETRY='1';
process.env.DO_NOT_TRACK='1';
const { createRenderJob,executeRenderJob }=await import('../client/src-tauri/sidecars/hyperframes-renderer/node_modules/@hyperframes/producer/dist/index.js');
const job=createRenderJob({fps:30,quality:'high',format:'mp4',crf:20,debug:true});
await executeRenderJob(job,path.resolve(process.argv[2]||'.tmp-ai-video-qa/project'),path.resolve(process.argv[3]||'.tmp-ai-video-qa/clippster-launch.mp4'),(j,message)=>console.log(j.status,j.progress,message),AbortSignal.timeout(90000));
console.log(JSON.stringify({status:job.status,error:job.error,duration:job.duration}));

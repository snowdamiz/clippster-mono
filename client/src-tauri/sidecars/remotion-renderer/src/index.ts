import { stdin, stdout } from 'process';
import { renderVideo } from './render.js';
import readline from 'readline';

const rl = readline.createInterface({ 
  input: stdin, 
  output: stdout, 
  terminal: false 
});

interface RenderCommand {
  type: 'render';
  id: string;
  composition: any;
  outputPath: string;
  options?: {
    codec?: 'h264' | 'h265';
    crf?: number;
  };
}

interface CancelCommand {
  type: 'cancel';
  id: string;
}

type Command = RenderCommand | CancelCommand;

const activeRenders = new Map<string, AbortController>();

function sendMessage(msg: object) {
  console.log(JSON.stringify(msg));
}

rl.on('line', async (line) => {
  try {
    const command: Command = JSON.parse(line);
    
    if (command.type === 'render') {
      const abortController = new AbortController();
      activeRenders.set(command.id, abortController);
      
      try {
        await renderVideo({
          composition: command.composition,
          outputPath: command.outputPath,
          options: command.options,
          onProgress: (progress) => {
            sendMessage({
              type: 'progress',
              id: command.id,
              progress: progress.progress,
              renderedFrames: progress.renderedFrames,
              totalFrames: progress.totalFrames,
            });
          },
          signal: abortController.signal,
        });
        
        sendMessage({ type: 'complete', id: command.id, success: true });
      } catch (error: any) {
        if (error.name === 'AbortError') {
          sendMessage({ type: 'cancelled', id: command.id });
        } else {
          sendMessage({ type: 'error', id: command.id, error: error.message });
        }
      } finally {
        activeRenders.delete(command.id);
      }
    } else if (command.type === 'cancel') {
      const controller = activeRenders.get(command.id);
      controller?.abort();
    }
  } catch (error: any) {
    sendMessage({ type: 'error', error: error.message });
  }
});

sendMessage({ type: 'ready' });

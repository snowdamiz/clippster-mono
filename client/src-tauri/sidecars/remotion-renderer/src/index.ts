import { renderVideo, cancelRender } from './render';
import { RenderCommand, ProgressMessage, ErrorMessage, CompleteMessage } from './types';

// IPC Protocol: Read commands from stdin, write messages to stdout
const activeRenders = new Map<string, AbortController>();

process.stdin.setEncoding('utf8');

let buffer = '';

process.stdin.on('data', (chunk: string) => {
  buffer += chunk;
  
  // Process complete lines
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const command: RenderCommand = JSON.parse(line);
        handleCommand(command);
      } catch (error) {
        sendError('invalid-command', `Failed to parse command: ${error}`);
      }
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

async function handleCommand(command: RenderCommand) {
  switch (command.type) {
    case 'render':
      if (command.composition && command.outputPath) {
        await handleRender(command as RenderCommand & { type: 'render'; composition: any; outputPath: string });
      } else {
        sendError('invalid-command', 'Missing composition or outputPath for render command');
      }
      break;
      
    case 'cancel':
      handleCancel(command.renderId);
      break;
      
    default:
      sendError('unknown-command', `Unknown command type: ${(command as any).type}`);
  }
}

async function handleRender(command: RenderCommand & { type: 'render'; composition: any; outputPath: string }) {
  const { renderId, composition, outputPath, codec, crf } = command;
  
  // Create abort controller for this render
  const abortController = new AbortController();
  activeRenders.set(renderId, abortController);
  
  try {
    await renderVideo({
      renderId,
      composition,
      outputPath,
      codec: codec || 'h264',
      crf: crf || 23,
      signal: abortController.signal,
      onProgress: (progress) => {
        sendProgress(renderId, progress);
      },
    });
    
    // Render completed successfully
    sendComplete(renderId, outputPath);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      sendError(renderId, 'Render cancelled');
    } else {
      sendError(renderId, error.message || 'Render failed');
    }
  } finally {
    activeRenders.delete(renderId);
  }
}

function handleCancel(renderId: string) {
  const abortController = activeRenders.get(renderId);
  if (abortController) {
    abortController.abort();
    activeRenders.delete(renderId);
  }
}

function sendProgress(renderId: string, progress: number) {
  const message: ProgressMessage = {
    type: 'progress',
    renderId,
    progress,
  };
  sendMessage(message);
}

function sendComplete(renderId: string, outputPath: string) {
  const message: CompleteMessage = {
    type: 'complete',
    renderId,
    outputPath,
  };
  sendMessage(message);
}

function sendError(renderId: string, error: string) {
  const message: ErrorMessage = {
    type: 'error',
    renderId,
    error,
  };
  sendMessage(message);
}

function sendMessage(message: any) {
  console.log(JSON.stringify(message));
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  sendError('system', `Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  sendError('system', `Unhandled rejection: ${reason}`);
  process.exit(1);
});

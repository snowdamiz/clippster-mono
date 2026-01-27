# AI Video Creator - Implementation Plan

**Status:** Planning  
**Target:** Full-featured AI-powered video composition tool with Remotion  
**Timeline:** 18-24 days  
**Last Updated:** January 26, 2026

---

## Executive Summary

This plan outlines the implementation of a standalone AI Video Creator page that integrates Remotion (React-based video framework) into the Vue 3 Tauri application. The system will allow users to generate professional video compositions using AI prompts, with real-time preview via Remotion Player and export via a bundled Node.js sidecar for perfect preview-export parity.

### Key Features

- **AI-Powered Composition Generation**: Natural language prompts to create video layouts
- **Real-Time Preview**: Remotion Player embedded via React island for frame-accurate preview
- **Media Integration**: Import from local files, Assets library, or existing Clips
- **Full Animation Support**: Text animations, transitions, effects, keyframes
- **Perfect Export Parity**: Node.js sidecar with `@remotion/renderer` ensures what you see is what you export
- **Professional UI/UX**: Matches existing Clippster design system

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Tauri App                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Vue 3 Frontend                            │ │
│  │  ┌─────────────┐  ┌──────────────────┐  ┌────────────────┐  │ │
│  │  │ AIVideoSidebar │  │ React Island      │  │ AIVideoTimeline │  │ │
│  │  │ (Vue)          │  │ (Remotion Player) │  │ (Vue)           │  │ │
│  │  └─────────────┘  └──────────────────┘  └────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Rust Backend                              │ │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐   │ │
│  │  │ Video Server    │  │ Sidecar Manager                  │   │ │
│  │  │ (existing)      │  │ (spawns Node.js for rendering)   │   │ │
│  │  └─────────────────┘  └─────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Node.js Sidecar (Bundled)                       │ │
│  │  ┌─────────────────────────────────────────────────────┐    │ │
│  │  │ @remotion/renderer                                   │    │ │
│  │  │ - Receives composition JSON via IPC                  │    │ │
│  │  │ - Renders to MP4 using Chromium headless             │    │ │
│  │  │ - Reports progress back to Rust                      │    │ │
│  │  └─────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
client/
├── src/
│   ├── pages/
│   │   └── AIVideoCreator.vue                    # Main page
│   ├── components/
│   │   └── ai-video/
│   │       ├── AIVideoSidebar.vue                # Left panel: media + prompts
│   │       ├── AIVideoTimeline.vue               # Bottom: composition timeline
│   │       ├── AIVideoControls.vue               # Playback controls
│   │       ├── RemotionPlayerMount.vue           # Vue→React bridge
│   │       ├── MediaLibraryPanel.vue             # Imported media list
│   │       ├── PromptPanel.vue                   # AI prompt input
│   │       ├── StylePresetsPanel.vue             # Style presets
│   │       ├── ExportDialog.vue                  # Export settings + progress
│   │       └── pickers/
│   │           ├── AssetPickerDialog.vue         # Select from Assets
│   │           └── ClipPickerDialog.vue          # Select from Clips
│   ├── remotion/                                 # React/Remotion code
│   │   ├── index.tsx                             # Remotion entry point
│   │   ├── Root.tsx                              # Remotion root
│   │   ├── bridge/
│   │   │   └── RemotionPlayerWrapper.tsx         # Player wrapper for Vue
│   │   ├── compositions/
│   │   │   └── AIComposition.tsx                 # Dynamic composition renderer
│   │   └── components/
│   │       ├── AnimatedText.tsx                  # Text with animations
│   │       ├── MediaClip.tsx                     # Video/image handling
│   │       ├── AudioTrack.tsx                    # Audio with waveform
│   │       ├── ImageElement.tsx                  # Static/animated images
│   │       ├── ShapeElement.tsx                  # Rectangles, circles, etc.
│   │       └── TransitionEffect.tsx              # Transition wrappers
│   ├── composables/
│   │   ├── useAIVideoGeneration.ts               # AI composition generation
│   │   └── useRemotionExport.ts                  # Sidecar export integration
│   ├── services/
│   │   └── aiVideoApi.ts                         # Backend API calls
│   └── types/
│       └── ai-video.ts                           # Type definitions
│
├── src-tauri/
│   ├── src/
│   │   ├── sidecar/
│   │   │   └── mod.rs                            # Sidecar manager
│   │   └── commands/
│   │       └── remotion_export.rs                # Tauri commands for export
│   └── sidecars/
│       └── remotion-renderer/                    # Node.js sidecar project
│           ├── package.json
│           ├── src/
│           │   ├── index.ts                      # Entry point
│           │   ├── render.ts                     # Remotion render logic
│           │   └── ipc.ts                        # IPC with Rust
│           └── remotion/                         # Copy of client/src/remotion
│               ├── index.tsx
│               ├── Root.tsx
│               └── compositions/
│                   └── AIComposition.tsx
│
server/
└── lib/
    └── clippster_server/
        └── ai/
            └── video_composer.ex                  # AI composition generator
```

---

## UI/UX Design System

### Color Palette (Matching Existing App)

```css
/* Primary Colors */
--background: 222.2 84% 4.9%;           /* #0a0a0b - Main background */
--foreground: 210 40% 98%;              /* #f8fafc - Text */
--card: 222.2 84% 4.9%;                 /* Card backgrounds */
--border: 217.2 32.6% 17.5%;            /* #1e293b - Borders */

/* Accent Colors */
--primary: 210 40% 98%;                 /* Primary actions */
--secondary: 217.2 32.6% 17.5%;         /* Secondary surfaces */
--accent: 217.2 32.6% 17.5%;            /* Accent elements */
--muted: 217.2 32.6% 17.5%;             /* Muted backgrounds */
--muted-foreground: 215 20.2% 65.1%;    /* Muted text */

/* Semantic Colors */
--destructive: 0 62.8% 30.6%;           /* #dc2626 - Delete/danger */
--success: 142 76% 36%;                 /* #16a34a - Success states */
--warning: 38 92% 50%;                  /* #f59e0b - Warnings */
--info: 199 89% 48%;                    /* #0ea5e9 - Info/accent blue */
```

### Component Styling Patterns

**Cards:**
```css
.ai-video-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  transition: all 150ms ease;
}

.ai-video-card:hover {
  border-color: rgba(14, 165, 233, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

**Buttons:**
```css
.ai-video-btn {
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  transition: all 150ms ease;
}

.ai-video-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
}

.ai-video-btn--secondary {
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
}
```

**Inputs:**
```css
.ai-video-input {
  background-color: hsl(var(--input));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 0.625rem 0.875rem;
  color: hsl(var(--foreground));
  transition: all 150ms ease;
}

.ai-video-input:focus {
  outline: none;
  border-color: rgba(14, 165, 233, 0.5);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}
```

**Badges:**
```css
.ai-video-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
}

.ai-video-badge--primary {
  background-color: rgba(14, 165, 233, 0.15);
  color: #0ea5e9;
  border: 1px solid rgba(14, 165, 233, 0.3);
}

.ai-video-badge--success {
  background-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}
```

---

## Phase 1: Project Setup

### 1.1 Frontend Dependencies
```bash
cd client
yarn add remotion@^4.0.0 @remotion/player@^4.0.0 @remotion/cli@^4.0.0 @remotion/bundler@^4.0.0
yarn add react@18 react-dom@18
yarn add -D @types/react @types/react-dom @vitejs/plugin-react @remotion/eslint-plugin
```

### 1.2 Vite Configuration
```typescript
// client/vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    // Only process .tsx files in /remotion folder as React
    react({
      include: /src\/remotion\/.*\.tsx$/,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'remotion', '@remotion/player'],
  },
});
```

### 1.3 TypeScript Configuration
```json
// client/tsconfig.json (add to compilerOptions)
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

---

## Phase 2: React Island Bridge

### 2.1 Vue Mount Component
```vue
<!-- client/src/components/ai-video/RemotionPlayerMount.vue -->
<template>
  <div ref="mountPoint" class="remotion-player-mount" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, toRaw } from 'vue';
import type { AIVideoComposition } from '@/types/ai-video';

const props = defineProps<{
  composition: AIVideoComposition | null;
  currentTime: number;
  isPlaying: boolean;
}>();

const emit = defineEmits<{
  (e: 'timeUpdate', time: number): void;
  (e: 'durationChange', duration: number): void;
  (e: 'playingChange', playing: boolean): void;
}>();

const mountPoint = ref<HTMLElement | null>(null);
let root: any = null;
let React: any = null;

async function renderPlayer() {
  if (!mountPoint.value || !root) return;
  
  const { RemotionPlayerWrapper } = await import('@/remotion/bridge/RemotionPlayerWrapper');
  
  root.render(
    React.createElement(RemotionPlayerWrapper, {
      composition: toRaw(props.composition),
      currentFrame: Math.floor(props.currentTime * (props.composition?.fps || 30)),
      isPlaying: props.isPlaying,
      videoServerPort: await getVideoServerPort(),
      onFrameUpdate: (frame: number) => {
        emit('timeUpdate', frame / (props.composition?.fps || 30));
      },
      onDurationChange: (dur: number) => emit('durationChange', dur),
      onPlayingChange: (playing: boolean) => emit('playingChange', playing),
    })
  );
}

async function getVideoServerPort(): Promise<number> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<number>('get_video_server_port');
}

onMounted(async () => {
  if (mountPoint.value) {
    const ReactModule = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    React = ReactModule;
    root = ReactDOMClient.createRoot(mountPoint.value);
    renderPlayer();
  }
});

watch(
  () => [props.composition, props.currentTime, props.isPlaying],
  () => renderPlayer(),
  { deep: true }
);

onUnmounted(() => {
  root?.unmount();
});
</script>

<style scoped>
.remotion-player-mount {
  width: 100%;
  height: 100%;
  background: #0a0a0b;
  border-radius: 12px;
  overflow: hidden;
}
</style>
```

### 2.2 React Player Wrapper
```tsx
// client/src/remotion/bridge/RemotionPlayerWrapper.tsx
import React, { useCallback, useEffect, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { AIComposition } from '../compositions/AIComposition';
import type { AIVideoComposition } from '../../types/ai-video';

interface Props {
  composition: AIVideoComposition | null;
  currentFrame: number;
  isPlaying: boolean;
  videoServerPort: number;
  onFrameUpdate?: (frame: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlayingChange?: (playing: boolean) => void;
}

export const RemotionPlayerWrapper: React.FC<Props> = ({
  composition,
  currentFrame,
  isPlaying,
  videoServerPort,
  onFrameUpdate,
  onDurationChange,
  onPlayingChange,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  
  const fps = composition?.fps || 30;
  const durationInFrames = composition 
    ? Math.ceil(composition.duration * fps) 
    : 150;

  useEffect(() => {
    onDurationChange?.(durationInFrames / fps);
  }, [durationInFrames, fps]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.play();
    } else {
      playerRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (playerRef.current && !isPlaying) {
      playerRef.current.seekTo(currentFrame);
    }
  }, [currentFrame, isPlaying]);

  if (!composition) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0a0a0b',
        color: '#64748b',
        gap: '1rem',
      }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 17l10 5 10-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12l10 5 10-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p style={{ fontSize: '0.875rem' }}>Add media and generate a composition to preview</p>
      </div>
    );
  }

  return (
    <Player
      ref={playerRef}
      component={AIComposition}
      inputProps={{ 
        composition,
        videoServerPort,
      }}
      durationInFrames={durationInFrames}
      fps={fps}
      compositionWidth={composition.width}
      compositionHeight={composition.height}
      style={{ width: '100%', height: '100%' }}
      controls={false}
      loop={false}
      onFrameUpdate={(e) => onFrameUpdate?.(e.frame)}
      onPlay={() => onPlayingChange?.(true)}
      onPause={() => onPlayingChange?.(false)}
    />
  );
};
```

---

## Phase 3: Node.js Sidecar Setup

### 3.1 Sidecar Project Structure
```
client/src-tauri/sidecars/remotion-renderer/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Entry: listens for IPC commands
│   ├── render.ts         # Remotion rendering logic
│   └── ipc.ts            # Stdin/stdout IPC protocol
└── remotion/             # Symlink or copy of client/src/remotion
```

### 3.2 Sidecar Package.json
```json
{
  "name": "remotion-renderer",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc && esbuild dist/index.js --bundle --platform=node --outfile=dist/bundle.js",
    "pkg": "pkg dist/bundle.js -t node18-win-x64,node18-macos-x64,node18-linux-x64 -o bin/remotion-renderer"
  },
  "dependencies": {
    "remotion": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "@remotion/bundler": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "esbuild": "^0.20.0",
    "pkg": "^5.8.0"
  }
}
```

### 3.3 Sidecar Entry Point
```typescript
// client/src-tauri/sidecars/remotion-renderer/src/index.ts
import { stdin, stdout } from 'process';
import { renderVideo } from './render';
import readline from 'readline';

const rl = readline.createInterface({ input: stdin, output: stdout, terminal: false });

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
```

### 3.4 Render Logic
```typescript
// client/src-tauri/sidecars/remotion-renderer/src/render.ts
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface RenderOptions {
  composition: any;
  outputPath: string;
  options?: {
    codec?: 'h264' | 'h265';
    crf?: number;
  };
  onProgress?: (progress: { progress: number; renderedFrames: number; totalFrames: number }) => void;
  signal?: AbortSignal;
}

let bundleLocation: string | null = null;

async function ensureBundled(): Promise<string> {
  if (bundleLocation) return bundleLocation;
  
  const entryPoint = path.join(__dirname, '../remotion/index.tsx');
  bundleLocation = await bundle({
    entryPoint,
    onProgress: (progress) => {
      console.error(`Bundling: ${Math.round(progress * 100)}%`);
    },
  });
  
  return bundleLocation;
}

export async function renderVideo(options: RenderOptions): Promise<void> {
  const bundled = await ensureBundled();
  
  const comp = await selectComposition({
    serveUrl: bundled,
    id: 'AIVideo',
    inputProps: { composition: options.composition },
  });
  
  await renderMedia({
    composition: comp,
    serveUrl: bundled,
    codec: options.options?.codec || 'h264',
    outputLocation: options.outputPath,
    inputProps: { composition: options.composition },
    crf: options.options?.crf,
    onProgress: ({ progress, renderedFrames, totalFrames }) => {
      options.onProgress?.({ progress, renderedFrames, totalFrames });
    },
    cancelSignal: options.signal,
  });
}
```

### 3.5 Rust Sidecar Manager
```rust
// client/src-tauri/src/sidecar/mod.rs
use std::process::{Child, Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum RenderCommand {
    #[serde(rename = "render")]
    Render {
        id: String,
        composition: serde_json::Value,
        #[serde(rename = "outputPath")]
        output_path: String,
        options: Option<RenderOptions>,
    },
    #[serde(rename = "cancel")]
    Cancel { id: String },
}

#[derive(Debug, Serialize)]
pub struct RenderOptions {
    pub codec: Option<String>,
    pub crf: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum SidecarMessage {
    #[serde(rename = "ready")]
    Ready,
    #[serde(rename = "progress")]
    Progress {
        id: String,
        progress: f64,
        #[serde(rename = "renderedFrames")]
        rendered_frames: u32,
        #[serde(rename = "totalFrames")]
        total_frames: u32,
    },
    #[serde(rename = "complete")]
    Complete { id: String, success: bool },
    #[serde(rename = "error")]
    Error { id: String, error: String },
    #[serde(rename = "cancelled")]
    Cancelled { id: String },
}

pub struct RemotionSidecar {
    process: Child,
    stdin: Arc<Mutex<std::process::ChildStdin>>,
}

impl RemotionSidecar {
    pub fn spawn(app: &AppHandle) -> Result<Self, String> {
        let sidecar_path = app
            .path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("sidecars")
            .join("remotion-renderer");
        
        let mut child = Command::new(sidecar_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;
        
        let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
        
        Ok(Self {
            process: child,
            stdin: Arc::new(Mutex::new(stdin)),
        })
    }
    
    pub fn send_command(&self, cmd: RenderCommand) -> Result<(), String> {
        let json = serde_json::to_string(&cmd).map_err(|e| e.to_string())?;
        let mut stdin = self.stdin.lock().map_err(|e| e.to_string())?;
        writeln!(stdin, "{}", json).map_err(|e| e.to_string())?;
        Ok(())
    }
    
    pub fn read_messages<F>(&mut self, callback: F) -> Result<(), String>
    where
        F: Fn(SidecarMessage) + Send + 'static,
    {
        let stdout = self.process.stdout.take().ok_or("Failed to get stdout")?;
        let reader = BufReader::new(stdout);
        
        std::thread::spawn(move || {
            for line in reader.lines() {
                if let Ok(line) = line {
                    if let Ok(msg) = serde_json::from_str::<SidecarMessage>(&line) {
                        callback(msg);
                    }
                }
            }
        });
        
        Ok(())
    }
}
```

### 3.6 Tauri Commands for Export
```rust
// client/src-tauri/src/commands/remotion_export.rs
use tauri::{command, AppHandle, State, Window};
use crate::sidecar::{RemotionSidecar, RenderCommand, RenderOptions};
use std::sync::Mutex;
use uuid::Uuid;

pub struct SidecarState(pub Mutex<Option<RemotionSidecar>>);

#[command]
pub async fn start_remotion_export(
    app: AppHandle,
    window: Window,
    state: State<'_, SidecarState>,
    composition: serde_json::Value,
    output_path: String,
    codec: Option<String>,
    crf: Option<u32>,
) -> Result<String, String> {
    let render_id = Uuid::new_v4().to_string();
    
    // Ensure sidecar is running
    let mut sidecar_guard = state.0.lock().map_err(|e| e.to_string())?;
    if sidecar_guard.is_none() {
        let mut sidecar = RemotionSidecar::spawn(&app)?;
        let window_clone = window.clone();
        sidecar.read_messages(move |msg| {
            let _ = window_clone.emit("remotion-export-progress", &msg);
        })?;
        *sidecar_guard = Some(sidecar);
    }
    
    // Send render command
    if let Some(sidecar) = sidecar_guard.as_ref() {
        sidecar.send_command(RenderCommand::Render {
            id: render_id.clone(),
            composition,
            output_path,
            options: Some(RenderOptions { codec, crf }),
        })?;
    }
    
    Ok(render_id)
}

#[command]
pub async fn cancel_remotion_export(
    state: State<'_, SidecarState>,
    render_id: String,
) -> Result<(), String> {
    let sidecar_guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(sidecar) = sidecar_guard.as_ref() {
        sidecar.send_command(RenderCommand::Cancel { id: render_id })?;
    }
    Ok(())
}
```

---

## Phase 4: Type Definitions

```typescript
// client/src/types/ai-video.ts
export interface AIVideoComposition {
  id: string;
  name: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  backgroundColor?: string;
  tracks: AIVideoTrack[];
}

export interface AIVideoTrack {
  id: string;
  type: 'video' | 'audio' | 'image' | 'text' | 'shape';
  name: string;
  source?: MediaSource;
  startTime: number;
  endTime: number;
  layer: number;
  properties: TrackProperties;
}

export interface MediaSource {
  type: 'local' | 'asset' | 'clip';
  path: string;
  thumbnailPath?: string;
  duration?: number;
  assetId?: string;
  clipId?: string;
}

export interface TrackProperties {
  // Transform (can be animated)
  x?: number | KeyframeAnimation;
  y?: number | KeyframeAnimation;
  width?: number | KeyframeAnimation;
  height?: number | KeyframeAnimation;
  scale?: number | KeyframeAnimation;
  rotation?: number | KeyframeAnimation;
  opacity?: number | KeyframeAnimation;
  
  // Video/Audio specific
  trimStart?: number;
  trimEnd?: number;
  playbackRate?: number;
  volume?: number | KeyframeAnimation;
  
  // Text specific
  text?: TextProperties;
  
  // Shape specific
  shape?: ShapeProperties;
  
  // Effects & transitions
  effects?: Effect[];
  enterTransition?: Transition;
  exitTransition?: Transition;
}

export interface TextProperties {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700 | 800 | 900;
  color: string;
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
  textAlign: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  textShadow?: string;
  stroke?: { color: string; width: number };
  animation?: TextAnimation;
}

export type TextAnimation = 
  | { type: 'none' }
  | { type: 'fade'; duration: number }
  | { type: 'slide-up'; duration: number; distance?: number }
  | { type: 'slide-down'; duration: number; distance?: number }
  | { type: 'typewriter'; speed: number }
  | { type: 'bounce'; duration: number }
  | { type: 'scale-in'; duration: number }
  | { type: 'blur-in'; duration: number };

export interface ShapeProperties {
  type: 'rectangle' | 'circle' | 'ellipse' | 'line';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface KeyframeAnimation {
  keyframes: Keyframe[];
}

export interface Keyframe {
  time: number; // 0-1 normalized within track duration
  value: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
}

export interface Effect {
  type: 'blur' | 'brightness' | 'contrast' | 'saturation' | 'hue-rotate' | 'grayscale' | 'sepia';
  value: number | KeyframeAnimation;
}

export interface Transition {
  type: 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom' | 'wipe';
  duration: number;
  easing?: string;
}

// Media library types
export interface AIVideoMediaItem {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  source: MediaSource;
  thumbnailUrl?: string;
  duration?: number;
  dimensions?: { width: number; height: number };
  addedAt: Date;
}

// AI generation
export interface AIGenerationRequest {
  prompt: string;
  media: AIVideoMediaItem[];
  style?: string;
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
}

// Export
export interface ExportSettings {
  outputPath: string;
  codec: 'h264' | 'h265';
  quality: 'draft' | 'standard' | 'high';
  crf?: number;
}

export interface ExportProgress {
  id: string;
  status: 'preparing' | 'rendering' | 'complete' | 'error' | 'cancelled';
  progress: number;
  renderedFrames: number;
  totalFrames: number;
  error?: string;
}
```

---

## Phase 5: Navigation & Routing

### 5.1 Add to Navigation Config
```typescript
// client/src/config/navigation.ts
import { Wand2 } from 'lucide-vue-next';

// Add to navigationItems array in 'create' group:
{
  name: 'AI Video',
  path: '/ai-video',
  icon: Wand2,
  group: 'create',
  badge: 'Beta',
},
```

### 5.2 Add Route
```typescript
// client/src/router/index.ts
{
  path: '/ai-video',
  name: 'ai-video',
  component: () => import('@/layouts/DashboardLayout.vue'),
  meta: { requiresAuth: true },
  children: [
    {
      path: '',
      name: 'ai-video-home',
      component: () => import('@/pages/AIVideoCreator.vue'),
    },
  ],
},
```

---

## Phase 6-10: Component Implementation

### Phase 6: Main Page & UI Components
- `AIVideoCreator.vue` - Main page layout
- `AIVideoSidebar.vue` - Left panel with tabs
- `AIVideoTimeline.vue` - Bottom timeline view
- `AIVideoControls.vue` - Playback controls

### Phase 7: Media Pickers
- `AssetPickerDialog.vue` - Browse/select from Assets
- `ClipPickerDialog.vue` - Browse/select from Clips

### Phase 8: AI Generation
- `useAIVideoGeneration.ts` - Composable
- `aiVideoApi.ts` - API service
- Backend `video_composer.ex` - AI integration

### Phase 9: Remotion Compositions
- `AIComposition.tsx` - Main renderer
- Component library for all track types

### Phase 10: Export Pipeline
- `useRemotionExport.ts` - Export composable
- `ExportDialog.vue` - Export UI
- Integration with sidecar

---

## Estimated Effort

| Phase | Effort | Notes |
|-------|--------|-------|
| Phase 1: Project Setup | 1 day | Dependencies, Vite config |
| Phase 2: React Island Bridge | 2 days | Vue↔React integration |
| Phase 3: Node.js Sidecar | 3-4 days | Most complex - IPC, bundling, Rust integration |
| Phase 4: Type Definitions | 0.5 days | TypeScript types |
| Phase 5: Navigation & Routing | 0.5 days | Simple additions |
| Phase 6: Main Page & UI | 2-3 days | Vue components |
| Phase 7: Media Pickers | 1-2 days | Dialog components |
| Phase 8: AI Generation | 2-3 days | Frontend + backend |
| Phase 9: Remotion Compositions | 3-4 days | React components with animations |
| Phase 10: Export Pipeline | 2-3 days | Integration & testing |
| **Total** | **18-24 days** |

---

## Build & Distribution

### Sidecar Bundling
```bash
cd client/src-tauri/sidecars/remotion-renderer
npm run build
npm run pkg  # Creates bin/remotion-renderer-{platform}
```

### Tauri Configuration
```json
// tauri.conf.json
{
  "bundle": {
    "externalBin": [
      "sidecars/remotion-renderer/bin/remotion-renderer"
    ]
  }
}
```

### App Size Impact
- Node.js sidecar (pkg'd): ~50-80MB per platform
- Chromium for Remotion: Uses system Chrome or bundled (~100MB)
- Total increase: ~150-180MB

---

## Success Criteria

- ✅ Real-time preview with Remotion Player
- ✅ AI-generated compositions from natural language
- ✅ Media import from local files, Assets, and Clips
- ✅ Full animation support (text, transitions, effects)
- ✅ Perfect preview-export parity
- ✅ UI/UX matches existing Clippster design
- ✅ Export progress tracking
- ✅ Professional video output quality

---

**Next Steps:** Begin Phase 1 implementation when ready.

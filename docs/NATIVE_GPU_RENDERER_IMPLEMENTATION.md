# Native GPU Video Renderer Implementation Plan

**Status:** In Progress  
**Start Date:** January 18, 2026  
**Target Completion:** 12-16 weeks  
**Goal:** CapCut-level video editor with 100% preview-export parity

---

## Executive Summary

This document outlines the complete implementation of a native GPU-based video rendering system to replace the current browser-based playback. This approach guarantees 100% preview-export parity by using the same rendering pipeline for both preview and export.

### Why This Approach

**Current Problems:**
- Browser video elements can't seamlessly switch between segments (10-50ms lag)
- WebCodecs not designed for multi-segment timeline playback
- Preview cache requires pre-rendering (slow, not instant)
- Preview (browser) vs Export (FFmpeg) use different rendering = parity issues

**Solution:**
- Native Rust + wgpu GPU rendering
- Same compositor for preview AND export
- FFmpeg for decode/encode only
- All effects/overlays rendered on GPU
- Frame-accurate seeking
- Zero segment transition lag

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Vue UI Layer (Browser - Unchanged)                     │
│  - Timeline controls                                     │
│  - Property panels                                       │
│  - Asset management                                      │
│  - Database operations                                   │
└─────────────────────────────────────────────────────────┘
                    ↕ Tauri IPC
┌─────────────────────────────────────────────────────────┐
│  Rust Native Video Renderer (NEW)                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │ UnifiedCompositor                                 │  │
│  │ - FFmpeg video decoder                            │  │
│  │ - GPU texture management (wgpu)                   │  │
│  │ - Text rendering (GPU)                            │  │
│  │ - Image overlays (GPU)                            │  │
│  │ - Effect shaders (GPU)                            │  │
│  │ - Frame cache (LRU)                               │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  Preview: Compositor → Screen                           │
│  Export:  Compositor → Encoder → File                   │
└─────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Core Dependencies

**Rust Crates:**
```toml
[dependencies]
# GPU Rendering
wgpu = "0.19"
wgpu-text = "0.8"  # GPU text rendering
image = "0.24"     # Image loading/processing

# Video Processing
ffmpeg-next = "6.1"  # FFmpeg bindings

# Caching & Performance
lru = "0.12"
parking_lot = "0.12"  # Fast mutexes

# Async & Threading
tokio = { version = "1.35", features = ["full"] }
rayon = "1.8"  # Parallel processing

# Tauri Integration
tauri = "2.0"
serde = { version = "1.0", features = ["derive"] }
```

**Frontend (Unchanged):**
- Vue 3
- Pinia
- Tauri API

---

## Implementation Phases

### Phase 1: Core Video Decoder (Weeks 1-2)

#### 1.1 FFmpeg Video Decoder

**File:** `src-tauri/src/video_renderer/decoder.rs`

```rust
use ffmpeg_next as ffmpeg;
use std::path::Path;

pub struct VideoDecoder {
    input_context: ffmpeg::format::context::Input,
    video_stream_index: usize,
    decoder: ffmpeg::decoder::Video,
    scaler: ffmpeg::software::scaling::Context,
}

impl VideoDecoder {
    pub fn new(path: &Path) -> Result<Self, String> {
        ffmpeg::init().map_err(|e| e.to_string())?;
        
        let input = ffmpeg::format::input(path)
            .map_err(|e| format!("Failed to open video: {}", e))?;
        
        let video_stream = input
            .streams()
            .best(ffmpeg::media::Type::Video)
            .ok_or("No video stream found")?;
        
        let video_stream_index = video_stream.index();
        
        let context = ffmpeg::codec::context::Context::from_parameters(video_stream.parameters())
            .map_err(|e| e.to_string())?;
        
        let decoder = context
            .decoder()
            .video()
            .map_err(|e| e.to_string())?;
        
        // Create scaler to convert to RGB for GPU upload
        let scaler = ffmpeg::software::scaling::Context::get(
            decoder.format(),
            decoder.width(),
            decoder.height(),
            ffmpeg::format::Pixel::RGB24,
            decoder.width(),
            decoder.height(),
            ffmpeg::software::scaling::Flags::BILINEAR,
        ).map_err(|e| e.to_string())?;
        
        Ok(Self {
            input_context: input,
            video_stream_index,
            decoder,
            scaler,
        })
    }
    
    pub fn seek_to_timestamp(&mut self, timestamp: f64) -> Result<(), String> {
        let time_base = self.input_context
            .stream(self.video_stream_index)
            .ok_or("Stream not found")?
            .time_base();
        
        let ts = (timestamp / f64::from(time_base)) as i64;
        
        self.input_context
            .seek(ts, ..ts)
            .map_err(|e| format!("Seek failed: {}", e))?;
        
        self.decoder.flush();
        Ok(())
    }
    
    pub fn decode_frame(&mut self) -> Result<DecodedFrame, String> {
        let mut decoded = ffmpeg::util::frame::Video::empty();
        
        for (stream, packet) in self.input_context.packets() {
            if stream.index() == self.video_stream_index {
                self.decoder.send_packet(&packet)
                    .map_err(|e| e.to_string())?;
                
                if self.decoder.receive_frame(&mut decoded).is_ok() {
                    // Scale to RGB24
                    let mut rgb_frame = ffmpeg::util::frame::Video::empty();
                    self.scaler.run(&decoded, &mut rgb_frame)
                        .map_err(|e| e.to_string())?;
                    
                    return Ok(DecodedFrame {
                        data: rgb_frame.data(0).to_vec(),
                        width: rgb_frame.width(),
                        height: rgb_frame.height(),
                        timestamp: decoded.timestamp().unwrap_or(0) as f64 * f64::from(stream.time_base()),
                    });
                }
            }
        }
        
        Err("No frame decoded".to_string())
    }
}

pub struct DecodedFrame {
    pub data: Vec<u8>,  // RGB24 data
    pub width: u32,
    pub height: u32,
    pub timestamp: f64,
}
```

#### 1.2 Decoder Pool

**File:** `src-tauri/src/video_renderer/decoder_pool.rs`

```rust
use std::collections::HashMap;
use std::path::PathBuf;
use parking_lot::Mutex;
use super::decoder::VideoDecoder;

pub struct DecoderPool {
    decoders: Mutex<HashMap<PathBuf, VideoDecoder>>,
    max_decoders: usize,
}

impl DecoderPool {
    pub fn new(max_decoders: usize) -> Self {
        Self {
            decoders: Mutex::new(HashMap::new()),
            max_decoders,
        }
    }
    
    pub fn get_frame(&self, path: &PathBuf, timestamp: f64) -> Result<DecodedFrame, String> {
        let mut decoders = self.decoders.lock();
        
        // Get or create decoder
        let decoder = decoders.entry(path.clone()).or_insert_with(|| {
            VideoDecoder::new(path).expect("Failed to create decoder")
        });
        
        // Seek and decode
        decoder.seek_to_timestamp(timestamp)?;
        decoder.decode_frame()
    }
    
    pub fn clear(&self) {
        self.decoders.lock().clear();
    }
}
```

#### 1.3 Frame Cache

**File:** `src-tauri/src/video_renderer/frame_cache.rs`

```rust
use lru::LruCache;
use parking_lot::Mutex;
use std::num::NonZeroUsize;

#[derive(Hash, Eq, PartialEq, Clone)]
pub struct FrameKey {
    pub path: String,
    pub timestamp_ms: u64,  // Millisecond precision
}

pub struct FrameCache {
    cache: Mutex<LruCache<FrameKey, Vec<u8>>>,  // RGB data
}

impl FrameCache {
    pub fn new(capacity: usize) -> Self {
        Self {
            cache: Mutex::new(LruCache::new(NonZeroUsize::new(capacity).unwrap())),
        }
    }
    
    pub fn get(&self, key: &FrameKey) -> Option<Vec<u8>> {
        self.cache.lock().get(key).cloned()
    }
    
    pub fn put(&self, key: FrameKey, data: Vec<u8>) {
        self.cache.lock().put(key, data);
    }
    
    pub fn clear(&self) {
        self.cache.lock().clear();
    }
}
```

---

### Phase 2: GPU Rendering Pipeline (Weeks 3-4)

#### 2.1 GPU Initialization

**File:** `src-tauri/src/video_renderer/gpu_context.rs`

```rust
use wgpu;

pub struct GPUContext {
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub surface: wgpu::Surface,
    pub surface_config: wgpu::SurfaceConfiguration,
}

impl GPUContext {
    pub async fn new(window: &impl raw_window_handle::HasRawWindowHandle) -> Result<Self, String> {
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });
        
        let surface = unsafe { instance.create_surface(window) }
            .map_err(|e| e.to_string())?;
        
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .ok_or("Failed to find adapter")?;
        
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("Video Renderer Device"),
                    features: wgpu::Features::empty(),
                    limits: wgpu::Limits::default(),
                },
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        
        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps
            .formats
            .iter()
            .copied()
            .find(|f| f.is_srgb())
            .unwrap_or(surface_caps.formats[0]);
        
        let size = window.inner_size();
        let surface_config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width: size.width,
            height: size.height,
            present_mode: wgpu::PresentMode::Fifo,
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
        };
        
        surface.configure(&device, &surface_config);
        
        Ok(Self {
            device,
            queue,
            surface,
            surface_config,
        })
    }
}
```

#### 2.2 Video Texture Renderer

**File:** `src-tauri/src/video_renderer/video_pipeline.rs`

```rust
use wgpu;

pub struct VideoPipeline {
    pipeline: wgpu::RenderPipeline,
    bind_group_layout: wgpu::BindGroupLayout,
    sampler: wgpu::Sampler,
}

impl VideoPipeline {
    pub fn new(device: &wgpu::Device, format: wgpu::TextureFormat) -> Self {
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Video Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/video.wgsl").into()),
        });
        
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Video Bind Group Layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });
        
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Video Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });
        
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Video Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: "vs_main",
                buffers: &[],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: "fs_main",
                targets: &[Some(wgpu::ColorTargetState {
                    format,
                    blend: Some(wgpu::BlendState::REPLACE),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
        });
        
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });
        
        Self {
            pipeline,
            bind_group_layout,
            sampler,
        }
    }
    
    pub fn upload_frame_to_texture(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        frame_data: &[u8],
        width: u32,
        height: u32,
    ) -> wgpu::Texture {
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Video Frame Texture"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8UnormSrgb,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        
        // Convert RGB24 to RGBA8
        let rgba_data: Vec<u8> = frame_data
            .chunks(3)
            .flat_map(|rgb| [rgb[0], rgb[1], rgb[2], 255])
            .collect();
        
        queue.write_texture(
            wgpu::ImageCopyTexture {
                texture: &texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &rgba_data,
            wgpu::ImageDataLayout {
                offset: 0,
                bytes_per_row: Some(4 * width),
                rows_per_image: Some(height),
            },
            wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
        );
        
        texture
    }
}
```

#### 2.3 Video Shader

**File:** `src-tauri/src/video_renderer/shaders/video.wgsl`

```wgsl
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) tex_coords: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;
    
    // Full-screen quad
    let x = f32((vertex_index & 1u) << 1u) - 1.0;
    let y = f32((vertex_index & 2u)) - 1.0;
    
    out.position = vec4<f32>(x, -y, 0.0, 1.0);
    out.tex_coords = vec2<f32>((x + 1.0) * 0.5, (y + 1.0) * 0.5);
    
    return out;
}

@group(0) @binding(0)
var video_texture: texture_2d<f32>;

@group(0) @binding(1)
var video_sampler: sampler;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return textureSample(video_texture, video_sampler, in.tex_coords);
}
```

---

### Phase 3: Unified Compositor (Weeks 5-6)

**File:** `src-tauri/src/video_renderer/compositor.rs`

```rust
use super::{
    decoder_pool::DecoderPool,
    frame_cache::{FrameCache, FrameKey},
    gpu_context::GPUContext,
    video_pipeline::VideoPipeline,
};
use std::path::PathBuf;

pub struct UnifiedCompositor {
    gpu: GPUContext,
    decoder_pool: DecoderPool,
    frame_cache: FrameCache,
    video_pipeline: VideoPipeline,
}

impl UnifiedCompositor {
    pub fn new(window: &impl raw_window_handle::HasRawWindowHandle) -> Result<Self, String> {
        let gpu = pollster::block_on(GPUContext::new(window))?;
        let video_pipeline = VideoPipeline::new(&gpu.device, gpu.surface_config.format);
        
        Ok(Self {
            gpu,
            decoder_pool: DecoderPool::new(10),
            frame_cache: FrameCache::new(500),  // Cache 500 frames (~16 seconds at 30fps)
            video_pipeline,
        })
    }
    
    /// Core rendering function used by BOTH preview and export
    pub fn render_frame_at_time(
        &mut self,
        video_path: &PathBuf,
        timestamp: f64,
    ) -> Result<wgpu::Texture, String> {
        // Check cache first
        let cache_key = FrameKey {
            path: video_path.to_string_lossy().to_string(),
            timestamp_ms: (timestamp * 1000.0) as u64,
        };
        
        let frame_data = if let Some(cached) = self.frame_cache.get(&cache_key) {
            cached
        } else {
            // Decode from video
            let decoded = self.decoder_pool.get_frame(video_path, timestamp)?;
            self.frame_cache.put(cache_key, decoded.data.clone());
            decoded.data
        };
        
        // Upload to GPU texture
        let texture = self.video_pipeline.upload_frame_to_texture(
            &self.gpu.device,
            &self.gpu.queue,
            &frame_data,
            1920,  // TODO: Get from video metadata
            1080,
        );
        
        Ok(texture)
    }
    
    /// Preview: render to screen
    pub fn render_preview_frame(&mut self, video_path: &PathBuf, timestamp: f64) -> Result<(), String> {
        let texture = self.render_frame_at_time(video_path, timestamp)?;
        
        let output = self.gpu.surface.get_current_texture()
            .map_err(|e| e.to_string())?;
        
        let view = output.texture.create_view(&wgpu::TextureViewDescriptor::default());
        
        let mut encoder = self.gpu.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Render Encoder"),
        });
        
        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            
            // TODO: Bind texture and render
            // render_pass.set_pipeline(&self.video_pipeline.pipeline);
            // render_pass.draw(0..6, 0..1);
        }
        
        self.gpu.queue.submit(std::iter::once(encoder.finish()));
        output.present();
        
        Ok(())
    }
}
```

---

### Phase 4: Text Rendering (Weeks 7-8)

**File:** `src-tauri/src/video_renderer/text_renderer.rs`

```rust
use wgpu_text::{BrushBuilder, TextBrush, glyph_brush::Section};

pub struct TextRenderer {
    brush: TextBrush<()>,
}

impl TextRenderer {
    pub fn new(device: &wgpu::Device, format: wgpu::TextureFormat) -> Self {
        let brush = BrushBuilder::using_font_bytes(include_bytes!("../fonts/Arial.ttf"))
            .unwrap()
            .build(device, format);
        
        Self { brush }
    }
    
    pub fn render_text(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        view: &wgpu::TextureView,
        text: &str,
        x: f32,
        y: f32,
        font_size: f32,
        color: [f32; 4],
    ) {
        let section = Section::default()
            .add_text(
                wgpu_text::glyph_brush::Text::new(text)
                    .with_color(color)
                    .with_scale(font_size),
            )
            .with_screen_position((x, y));
        
        self.brush.queue(device, queue, vec![&section]).unwrap();
        
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Text Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Load,
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
        });
        
        self.brush.draw(&mut render_pass);
    }
}
```

---

### Phase 5: Tauri Integration (Weeks 9-10)

#### 5.1 Tauri Commands

**File:** `src-tauri/src/video_renderer/commands.rs`

```rust
use tauri::State;
use super::compositor::UnifiedCompositor;
use parking_lot::Mutex;

pub struct VideoRendererState {
    pub compositor: Mutex<Option<UnifiedCompositor>>,
}

#[tauri::command]
pub async fn init_video_renderer(
    state: State<'_, VideoRendererState>,
    window: tauri::Window,
) -> Result<(), String> {
    let compositor = UnifiedCompositor::new(&window)?;
    *state.compositor.lock() = Some(compositor);
    Ok(())
}

#[tauri::command]
pub async fn render_preview_frame(
    state: State<'_, VideoRendererState>,
    video_path: String,
    timestamp: f64,
) -> Result<(), String> {
    let mut compositor_guard = state.compositor.lock();
    let compositor = compositor_guard.as_mut()
        .ok_or("Compositor not initialized")?;
    
    compositor.render_preview_frame(&video_path.into(), timestamp)
}

#[tauri::command]
pub async fn play_video(
    state: State<'_, VideoRendererState>,
    video_path: String,
) -> Result<(), String> {
    // Start playback loop
    // TODO: Implement RAF-style playback loop
    Ok(())
}

#[tauri::command]
pub async fn pause_video(
    state: State<'_, VideoRendererState>,
) -> Result<(), String> {
    // Pause playback
    Ok(())
}

#[tauri::command]
pub async fn seek_video(
    state: State<'_, VideoRendererState>,
    timestamp: f64,
) -> Result<(), String> {
    // Seek to timestamp
    Ok(())
}
```

#### 5.2 Register Commands

**File:** `src-tauri/src/lib.rs`

```rust
mod video_renderer;

use video_renderer::{commands::*, VideoRendererState};
use parking_lot::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(VideoRendererState {
            compositor: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            init_video_renderer,
            render_preview_frame,
            play_video,
            pause_video,
            seek_video,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

### Phase 6: Vue Integration (Weeks 11-12)

#### 6.1 Native Renderer Component

**File:** `client/src/components/clip-editor/NativeVideoRenderer.vue`

```vue
<template>
  <div ref="rendererContainer" class="native-video-renderer w-full h-full" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { VideoEditorSource } from '@/types';

const props = defineProps<{
  videoSources: VideoEditorSource[];
  currentTime: number;
  isPlaying: boolean;
}>();

const emit = defineEmits<{
  'time-update': [time: number];
  'play-state-change': [isPlaying: boolean];
  'error': [error: string];
}>();

const rendererContainer = ref<HTMLDivElement>();
let rafId: number | null = null;
let lastFrameTime = 0;

onMounted(async () => {
  try {
    await invoke('init_video_renderer');
    console.log('[NativeVideoRenderer] Initialized');
  } catch (error) {
    emit('error', String(error));
  }
});

// Watch for time changes
watch(() => props.currentTime, async (time) => {
  if (!props.isPlaying) {
    await renderFrame(time);
  }
});

// Watch for play state changes
watch(() => props.isPlaying, (playing) => {
  if (playing) {
    startPlayback();
  } else {
    stopPlayback();
  }
});

async function renderFrame(time: number) {
  // Find active video source at this time
  const activeSource = props.videoSources.find(
    s => time >= s.start_time && time < s.end_time
  );
  
  if (!activeSource) {
    return;
  }
  
  // Calculate time within source video
  const sourceTime = activeSource.trim_start + (time - activeSource.start_time);
  
  try {
    await invoke('render_preview_frame', {
      videoPath: activeSource.source_path,
      timestamp: sourceTime,
    });
  } catch (error) {
    console.error('[NativeVideoRenderer] Render error:', error);
  }
}

function startPlayback() {
  lastFrameTime = performance.now();
  rafId = requestAnimationFrame(tick);
}

function stopPlayback() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function tick(timestamp: number) {
  if (!props.isPlaying) return;
  
  const delta = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;
  
  const newTime = props.currentTime + delta;
  emit('time-update', newTime);
  
  renderFrame(newTime);
  
  rafId = requestAnimationFrame(tick);
}

onUnmounted(() => {
  stopPlayback();
});

// Public methods
defineExpose({
  play: () => startPlayback(),
  pause: () => stopPlayback(),
  seek: (time: number) => renderFrame(time),
});
</script>

<style scoped>
.native-video-renderer {
  background: black;
  position: relative;
}
</style>
```

#### 6.2 Integration with ClipEditorDialog

**File:** `client/src/components/clip-editor/ClipEditorDialog.vue`

```vue
<!-- Replace ClipEditorPreviewWebCodecs with NativeVideoRenderer -->
<template>
  <NativeVideoRenderer
    v-if="editorMode"
    ref="nativeRendererRef"
    :video-sources="videoSources"
    :current-time="previewTime"
    :is-playing="isPlaying"
    @time-update="onPreviewTimeUpdate"
    @play-state-change="onPlayStateChange"
    @error="onRendererError"
  />
</template>

<script setup lang="ts">
import NativeVideoRenderer from './NativeVideoRenderer.vue';

const nativeRendererRef = ref<InstanceType<typeof NativeVideoRenderer>>();

function onRendererError(error: string) {
  console.error('[ClipEditorDialog] Renderer error:', error);
  // Show error to user
}
</script>
```

---

## Export Pipeline Integration

**File:** `src-tauri/src/video_renderer/export.rs`

```rust
use super::compositor::UnifiedCompositor;
use ffmpeg_next as ffmpeg;

pub struct VideoExporter {
    compositor: UnifiedCompositor,
}

impl VideoExporter {
    pub fn export(
        &mut self,
        video_path: &str,
        output_path: &str,
        duration: f64,
        fps: f64,
    ) -> Result<(), String> {
        // Initialize FFmpeg encoder
        let mut encoder = self.init_encoder(output_path, 1920, 1080, fps)?;
        
        let frame_count = (duration * fps) as usize;
        
        for i in 0..frame_count {
            let timestamp = i as f64 / fps;
            
            // SAME rendering as preview!
            let texture = self.compositor.render_frame_at_time(
                &video_path.into(),
                timestamp,
            )?;
            
            // Download from GPU
            let rgb_data = self.download_texture(texture)?;
            
            // Encode frame
            self.encode_frame(&mut encoder, &rgb_data)?;
            
            // Progress callback
            if i % 30 == 0 {
                println!("Export progress: {}/{}", i, frame_count);
            }
        }
        
        self.finalize_encoder(encoder)?;
        Ok(())
    }
    
    fn init_encoder(
        &self,
        output_path: &str,
        width: u32,
        height: u32,
        fps: f64,
    ) -> Result<ffmpeg::encoder::Video, String> {
        // TODO: Initialize FFmpeg encoder
        todo!()
    }
    
    fn download_texture(&self, texture: wgpu::Texture) -> Result<Vec<u8>, String> {
        // TODO: Download texture from GPU to CPU memory
        todo!()
    }
    
    fn encode_frame(
        &self,
        encoder: &mut ffmpeg::encoder::Video,
        rgb_data: &[u8],
    ) -> Result<(), String> {
        // TODO: Encode frame
        todo!()
    }
    
    fn finalize_encoder(&self, encoder: ffmpeg::encoder::Video) -> Result<(), String> {
        // TODO: Finalize encoding
        todo!()
    }
}
```

---

## Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_decoder_seek() {
        let decoder = VideoDecoder::new(Path::new("test.mp4")).unwrap();
        decoder.seek_to_timestamp(5.0).unwrap();
        let frame = decoder.decode_frame().unwrap();
        assert!(frame.timestamp >= 4.9 && frame.timestamp <= 5.1);
    }
    
    #[test]
    fn test_frame_cache() {
        let cache = FrameCache::new(10);
        let key = FrameKey {
            path: "test.mp4".to_string(),
            timestamp_ms: 5000,
        };
        cache.put(key.clone(), vec![1, 2, 3]);
        assert_eq!(cache.get(&key), Some(vec![1, 2, 3]));
    }
}
```

### Integration Tests

1. **Playback Test**: Load video, play for 10 seconds, verify frames rendered
2. **Seek Test**: Seek to various timestamps, verify correct frames
3. **Multi-Segment Test**: Play timeline with multiple segments, verify seamless transitions
4. **Export Test**: Export video, compare with preview frames

---

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Frame decode latency | <16ms | ✅ |
| GPU upload time | <5ms | ✅ |
| Render to screen | <16ms (60fps) | ✅ |
| Seek latency | <50ms | ✅ |
| Cache hit rate | >80% | ⚠️ |
| Memory usage (1hr timeline) | <2GB | ⚠️ |

---

## Migration Checklist

- [ ] Phase 1: FFmpeg decoder (Weeks 1-2)
  - [ ] VideoDecoder implementation
  - [ ] DecoderPool implementation
  - [ ] FrameCache implementation
  - [ ] Unit tests
  
- [ ] Phase 2: GPU pipeline (Weeks 3-4)
  - [ ] wgpu initialization
  - [ ] Video texture upload
  - [ ] Basic rendering shader
  - [ ] Render to window
  
- [ ] Phase 3: Compositor (Weeks 5-6)
  - [ ] UnifiedCompositor structure
  - [ ] Frame rendering pipeline
  - [ ] Cache integration
  - [ ] Preview rendering
  
- [ ] Phase 4: Text rendering (Weeks 7-8)
  - [ ] GPU text rendering
  - [ ] Font loading
  - [ ] Text positioning
  - [ ] Integration with compositor
  
- [ ] Phase 5: Tauri integration (Weeks 9-10)
  - [ ] Tauri commands
  - [ ] State management
  - [ ] IPC communication
  - [ ] Error handling
  
- [ ] Phase 6: Vue integration (Weeks 11-12)
  - [ ] NativeVideoRenderer component
  - [ ] ClipEditorDialog integration
  - [ ] Playback controls
  - [ ] Time synchronization
  
- [ ] Phase 7: Export pipeline (Weeks 13-14)
  - [ ] Export using same compositor
  - [ ] FFmpeg encoding
  - [ ] Progress tracking
  - [ ] Quality settings
  
- [ ] Phase 8: Testing & polish (Weeks 15-16)
  - [ ] Integration tests
  - [ ] Performance optimization
  - [ ] Bug fixes
  - [ ] Documentation

---

## Success Criteria

1. ✅ **Preview-Export Parity**: 100% pixel-perfect match
2. ✅ **Seamless Playback**: Zero lag at segment boundaries
3. ✅ **Frame-Accurate Seeking**: <50ms seek latency
4. ✅ **60fps Preview**: Locked 60fps during playback
5. ✅ **Professional Performance**: Matches CapCut/DaVinci

---

## Notes

- All existing business logic, database, and UI components remain unchanged
- Only the video rendering layer is replaced
- Preview and export use identical rendering code
- FFmpeg used only for decode/encode, not for overlay rendering
- GPU handles all compositing for perfect parity

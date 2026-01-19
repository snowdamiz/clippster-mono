pub mod decoder;
pub mod decoder_pool;
pub mod frame_cache;
pub mod commands;
pub mod playback_engine;
pub mod audio_engine;
pub mod audio_decoder;
pub mod decode_worker;
pub mod proxy;
pub mod keyframe_index;

pub use commands::VideoRendererState;

use std::sync::atomic::{AtomicBool, Ordering};

/// Global flag to prevent get_frame_at from running during playback
/// When true, only the playback thread should decode frames
pub static PLAYBACK_ACTIVE: AtomicBool = AtomicBool::new(false);

pub fn is_playback_active() -> bool {
    PLAYBACK_ACTIVE.load(Ordering::Relaxed)
}

pub fn set_playback_active(active: bool) {
    PLAYBACK_ACTIVE.store(active, Ordering::Relaxed);
}

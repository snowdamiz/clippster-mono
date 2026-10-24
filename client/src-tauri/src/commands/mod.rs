//! Command modules for Tauri application
//!
//! This module organizes all Tauri command functions into logical groups:
//! - system: Basic system and utility commands
//! - download_management: Download control and cancellation commands
//! - file_operations: File validation and media processing commands
//! - focal_detection_commands: Focal point detection for videos
//! - file_utils: File utility commands
//! - hyperframes: Hyperframes sidecar bridge (AI video lint, check, snapshot, beats, render)
//! - video_measure: Frame-accurate shot measurement and example import for the AI video editor
//! - ai_media: Media fingerprints and downscaled JPEGs for AI video model input
//! - download_audio: Download audio commands
//! - convert_video: Video conversion commands

pub mod ai_media;
pub mod convert_video;
pub mod delete_local_storage;
pub mod download_audio;
pub mod download_broll;
pub mod download_management;
pub mod file_operations;
pub mod file_utils;
pub mod focal_detection_commands;
pub mod hyperframes;
pub mod reference_video;
pub mod system;
pub mod video_measure;

// Re-export all commands for convenient importing
pub use convert_video::*;
pub use delete_local_storage::*;
pub use download_audio::*;
pub use download_broll::*;
pub use download_management::*;
pub use file_operations::*;
pub use focal_detection_commands::*;
pub use system::*;
// file_utils and hyperframes are used directly via module path in lib.rs

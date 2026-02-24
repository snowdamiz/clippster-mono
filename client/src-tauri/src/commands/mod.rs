//! Command modules for Tauri application
//!
//! This module organizes all Tauri command functions into logical groups:
//! - system: Basic system and utility commands
//! - download_management: Download control and cancellation commands
//! - file_operations: File validation and media processing commands
//! - focal_detection_commands: Focal point detection for videos
//! - file_utils: File utility commands
//! - remotion_export: Remotion export commands
//! - download_audio: Download audio commands

pub mod system;
pub mod download_management;
pub mod file_operations;
pub mod focal_detection_commands;
pub mod file_utils;
pub mod remotion_export;
pub mod download_audio;

// Re-export all commands for convenient importing
pub use system::*;
pub use download_management::*;
pub use file_operations::*;
pub use focal_detection_commands::*;
pub use download_audio::*;
// file_utils and remotion_export are used directly via module path in lib.rs
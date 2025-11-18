//! Command modules for Tauri application
//!
//! This module organizes all Tauri command functions into logical groups:
//! - system: Basic system and utility commands
//! - download_management: Download control and cancellation commands
//! - file_operations: File validation and media processing commands
//! - focal_detection_commands: Focal point detection for videos

pub mod system;
pub mod download_management;
pub mod file_operations;
pub mod focal_detection_commands;

// Re-export all commands for convenient importing
pub use system::*;
pub use download_management::*;
pub use file_operations::*;
pub use focal_detection_commands::*;
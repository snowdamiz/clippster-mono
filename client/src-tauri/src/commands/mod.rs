//! Command modules for Tauri application
//!
//! This module organizes all Tauri command functions into logical groups:
//! - system: Basic system and utility commands
//! - download_management: Download control and cancellation commands
//! - file_operations: File validation and media processing commands

pub mod system;
pub mod download_management;
pub mod file_operations;

// Re-export all commands for convenient importing
pub use system::*;
pub use download_management::*;
pub use file_operations::*;
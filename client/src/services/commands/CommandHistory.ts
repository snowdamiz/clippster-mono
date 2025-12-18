/**
 * Command History Manager
 *
 * Manages the undo/redo stack for the editor.
 * Supports both clip editor and video editor modes.
 */

import type { ICommand } from './Command';

export class CommandHistory {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private maxHistorySize: number = 100; // Limit history to prevent memory issues

  /**
   * Execute a command and add it to the history
   */
  async executeCommand(command: ICommand): Promise<void> {
    try {
      await command.execute();

      // Try to merge with the last command if possible
      if (this.undoStack.length > 0) {
        const lastCommand = this.undoStack[this.undoStack.length - 1];
        if (lastCommand.canMerge(command)) {
          lastCommand.merge(command);
          return; // Don't add to stack, already merged
        }
      }

      // Add to undo stack
      this.undoStack.push(command);

      // Clear redo stack (can't redo after new action)
      this.redoStack = [];

      // Trim history if too large
      if (this.undoStack.length > this.maxHistorySize) {
        this.undoStack.shift(); // Remove oldest command
      }

      console.log(`[CommandHistory] Executed: ${command.description}`);
    } catch (error) {
      console.error(`[CommandHistory] Failed to execute command: ${command.description}`, error);
      throw error;
    }
  }

  /**
   * Undo the last command
   */
  async undo(): Promise<void> {
    if (!this.canUndo()) {
      console.warn('[CommandHistory] Nothing to undo');
      return;
    }

    const command = this.undoStack.pop()!;

    try {
      await command.undo();
      this.redoStack.push(command);
      console.log(`[CommandHistory] Undone: ${command.description}`);
    } catch (error) {
      console.error(`[CommandHistory] Failed to undo command: ${command.description}`, error);
      // Put command back on undo stack if undo fails
      this.undoStack.push(command);
      throw error;
    }
  }

  /**
   * Redo the last undone command
   */
  async redo(): Promise<void> {
    if (!this.canRedo()) {
      console.warn('[CommandHistory] Nothing to redo');
      return;
    }

    const command = this.redoStack.pop()!;

    try {
      await command.execute();
      this.undoStack.push(command);
      console.log(`[CommandHistory] Redone: ${command.description}`);
    } catch (error) {
      console.error(`[CommandHistory] Failed to redo command: ${command.description}`, error);
      // Put command back on redo stack if redo fails
      this.redoStack.push(command);
      throw error;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Clear all history (e.g., when closing editor or switching projects)
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    console.log('[CommandHistory] History cleared');
  }

  /**
   * Get the size of the undo stack (for debugging/UI)
   */
  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  /**
   * Get the size of the redo stack (for debugging/UI)
   */
  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  /**
   * Get the description of the next command to undo (for UI display)
   */
  getNextUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * Get the description of the next command to redo (for UI display)
   */
  getNextRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  /**
   * Set maximum history size (default 100)
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(1, size);
  }
}

// Singleton instance for the application
export const commandHistory = new CommandHistory();

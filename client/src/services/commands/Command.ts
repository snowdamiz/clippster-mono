/**
 * Base Command Interface
 * 
 * Implements the Command Pattern for undo/redo functionality.
 * Every command must be aware of which mode (clip or editor) it operates in.
 */

export interface ICommand {
  /**
   * The mode this command operates in
   * - false = Clip Editor Mode (clip_* tables)
   * - true = Video Editor Mode (video_editor_* tables)
   */
  editorMode: boolean;

  /**
   * Description of the command for debugging/history display
   */
  description: string;

  /**
   * Execute the command (perform the action)
   */
  execute(): Promise<void>;

  /**
   * Undo the command (reverse the action)
   */
  undo(): Promise<void>;

  /**
   * Check if this command can be merged with another command
   * Useful for combining sequential similar operations (e.g., multiple text edits)
   */
  canMerge(other: ICommand): boolean;

  /**
   * Merge this command with another command
   * Only called if canMerge returns true
   */
  merge(other: ICommand): void;
}

/**
 * Abstract base class for commands
 * Provides default implementations of common functionality
 */
export abstract class BaseCommand implements ICommand {
  public readonly editorMode: boolean;
  public readonly description: string;

  constructor(editorMode: boolean, description: string) {
    this.editorMode = editorMode;
    this.description = description;
  }

  abstract execute(): Promise<void>;
  abstract undo(): Promise<void>;

  /**
   * Default: commands cannot be merged
   * Override in subclasses if merging makes sense
   */
  canMerge(_other: ICommand): boolean {
    return false;
  }

  /**
   * Default: no merge implementation
   * Override in subclasses if merging is supported
   */
  merge(_other: ICommand): void {
    throw new Error('Merge not supported for this command');
  }
}


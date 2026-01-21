import { BaseCommand } from '@/services/commands/Command';
import {
  createTextOverlay,
  deleteTextOverlay,
  type ClipTextOverlayRecord,
} from '@/services/database/clip-edits';

export class AddTextCommand extends BaseCommand {
  private clipEditId: string;
  private textData: Partial<ClipTextOverlayRecord>;
  private createdTextId: string | null = null;

  constructor(clipEditId: string, textData: Partial<ClipTextOverlayRecord>) {
    super(false, 'Add Text Overlay');
    this.clipEditId = clipEditId;
    this.textData = textData;
  }

  async execute(): Promise<void> {
    const result = await createTextOverlay(this.clipEditId, this.textData);
    this.createdTextId = result.id;
    console.log(`[AddTextCommand] Created text overlay: ${this.createdTextId}`);
  }

  async undo(): Promise<void> {
    if (this.createdTextId) {
      await deleteTextOverlay(this.createdTextId);
      console.log(`[AddTextCommand] Deleted text overlay: ${this.createdTextId}`);
    }
  }
}


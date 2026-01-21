import { BaseCommand } from '@/services/commands/Command';
import {
  createSticker,
  deleteSticker,
  type ClipStickerRecord,
} from '@/services/database/clip-edits';

export class AddStickerCommand extends BaseCommand {
  private clipEditId: string;
  private stickerData: Partial<ClipStickerRecord>;
  private createdStickerId: string | null = null;

  constructor(clipEditId: string, stickerData: Partial<ClipStickerRecord>) {
    super(false, 'Add Sticker');
    this.clipEditId = clipEditId;
    this.stickerData = stickerData;
  }

  async execute(): Promise<void> {
    const result = await createSticker(this.clipEditId, this.stickerData);
    this.createdStickerId = result.id;
    console.log(`[AddStickerCommand] Created sticker: ${this.createdStickerId}`);
  }

  async undo(): Promise<void> {
    if (this.createdStickerId) {
      await deleteSticker(this.createdStickerId);
      console.log(`[AddStickerCommand] Deleted sticker: ${this.createdStickerId}`);
    }
  }
}


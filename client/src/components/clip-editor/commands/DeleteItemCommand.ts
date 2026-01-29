import { BaseCommand } from '@/services/commands/Command';
import {
  createAudioTrack,
  deleteAudioTrack,
  createTextOverlay,
  deleteTextOverlay,
  createSticker,
  deleteSticker,
  type ClipAudioTrackRecord,
  type ClipTextOverlayRecord,
  type ClipStickerRecord,
} from '@/services/database/clip-edits';

type ItemData = ClipAudioTrackRecord | ClipTextOverlayRecord | ClipStickerRecord;

export class DeleteItemCommand extends BaseCommand {
  private clipEditId: string;
  private itemType: 'audio' | 'text' | 'sticker';
  private itemData: ItemData;

  constructor(clipEditId: string, itemType: 'audio' | 'text' | 'sticker', itemData: ItemData) {
    super(false, `Delete ${itemType}`);
    this.clipEditId = clipEditId;
    this.itemType = itemType;
    this.itemData = itemData;
  }

  async execute(): Promise<void> {
    switch (this.itemType) {
      case 'audio':
        await deleteAudioTrack(this.itemData.id);
        break;
      case 'text':
        await deleteTextOverlay(this.itemData.id);
        break;
      case 'sticker':
        await deleteSticker(this.itemData.id);
        break;
    }
    console.log(`[DeleteItemCommand] Deleted ${this.itemType}: ${this.itemData.id}`);
  }

  async undo(): Promise<void> {
    // Recreate the item with its original data
    switch (this.itemType) {
      case 'audio':
        await createAudioTrack(this.clipEditId, this.itemData as ClipAudioTrackRecord);
        break;
      case 'text':
        await createTextOverlay(this.clipEditId, this.itemData as ClipTextOverlayRecord);
        break;
      case 'sticker':
        await createSticker(this.clipEditId, this.itemData as ClipStickerRecord);
        break;
    }
    console.log(`[DeleteItemCommand] Restored ${this.itemType}: ${this.itemData.id}`);
  }
}


import { BaseCommand } from '@/services/commands/Command';
import {
  updateAudioTrack,
  updateTextOverlay,
  updateSticker,
} from '@/services/database/clip-edits';

export class UpdatePropertyCommand extends BaseCommand {
  private itemId: string;
  private itemType: 'audio' | 'text' | 'sticker';
  private property: string;
  private newValue: any;
  private oldValue: any;

  constructor(
    itemId: string,
    itemType: 'audio' | 'text' | 'sticker',
    property: string,
    oldValue: any,
    newValue: any
  ) {
    super(false, `Update ${itemType} ${property}`);
    this.itemId = itemId;
    this.itemType = itemType;
    this.property = property;
    this.oldValue = oldValue;
    this.newValue = newValue;
  }

  async execute(): Promise<void> {
    await this.updateItem(this.newValue);
  }

  async undo(): Promise<void> {
    await this.updateItem(this.oldValue);
  }

  private async updateItem(value: any): Promise<void> {
    const data = { [this.property]: value };
    
    switch (this.itemType) {
      case 'audio':
        await updateAudioTrack(this.itemId, data);
        break;
      case 'text':
        await updateTextOverlay(this.itemId, data);
        break;
      case 'sticker':
        await updateSticker(this.itemId, data);
        break;
    }
  }

  // Enable command merging for rapid property updates (e.g., dragging sliders)
  canMerge(other: UpdatePropertyCommand): boolean {
    return (
      other instanceof UpdatePropertyCommand &&
      other.itemId === this.itemId &&
      other.itemType === this.itemType &&
      other.property === this.property
    );
  }

  merge(other: UpdatePropertyCommand): void {
    // Update the new value to the latest one
    this.newValue = other.newValue;
  }
}


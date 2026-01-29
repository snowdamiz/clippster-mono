import { BaseCommand } from '@/services/commands/Command';
import {
  createAudioTrack,
  deleteAudioTrack,
  type ClipAudioTrackRecord,
} from '@/services/database/clip-edits';

export class AddAudioCommand extends BaseCommand {
  private clipEditId: string;
  private audioData: Partial<ClipAudioTrackRecord>;
  private createdAudioId: string | null = null;

  constructor(clipEditId: string, audioData: Partial<ClipAudioTrackRecord>) {
    super(false, 'Add Audio Track');
    this.clipEditId = clipEditId;
    this.audioData = audioData;
  }

  async execute(): Promise<void> {
    const result = await createAudioTrack(this.clipEditId, this.audioData);
    this.createdAudioId = result.id;
    console.log(`[AddAudioCommand] Created audio track: ${this.createdAudioId}`);
  }

  async undo(): Promise<void> {
    if (this.createdAudioId) {
      await deleteAudioTrack(this.createdAudioId);
      console.log(`[AddAudioCommand] Deleted audio track: ${this.createdAudioId}`);
    }
  }
}


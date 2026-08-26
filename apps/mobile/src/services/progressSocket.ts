import { Socket, type Channel } from 'phoenix';
import { getApiBaseUrl } from '@/lib/config';

export interface ProgressUpdate {
  stage: string;
  progress: number;
  message: string | null;
}

export class ProgressSocket {
  private socket: Socket | null = null;
  private channel: Channel | null = null;
  private projectId: string | null = null;

  connect(projectId: string, onUpdate: (update: ProgressUpdate) => void): void {
    this.disconnect();
    this.projectId = projectId;

    const apiBase = getApiBaseUrl().replace(/\/api\/?$/, '');
    const wsUrl = apiBase.replace(/^http/, 'ws') + '/socket';

    this.socket = new Socket(wsUrl, {
      heartbeatIntervalMs: 30_000,
    });
    this.socket.connect();

    this.channel = this.socket.channel(`progress:${projectId}`);
    this.channel.on('progress_update', (payload: unknown) => {
      onUpdate(payload as ProgressUpdate);
    });
    this.channel.join();
  }

  disconnect(): void {
    this.channel?.leave();
    this.channel = null;
    this.socket?.disconnect();
    this.socket = null;
    this.projectId = null;
  }

  get connectedProjectId(): string | null {
    return this.projectId;
  }
}

declare module '*.css';

declare module 'phoenix' {
  export class Socket {
    constructor(endPoint: string, opts?: Record<string, unknown>);
    connect(): void;
    disconnect(callback?: () => void, code?: number, reason?: string): void;
    channel(topic: string, params?: Record<string, unknown>): Channel;
    onOpen(callback: () => void): void;
    onError(callback: (error: unknown) => void): void;
    onClose(callback: (event: unknown) => void): void;
  }

  export class Channel {
    join(timeout?: number): Push;
    leave(timeout?: number): Push;
    on(event: string, callback: (payload: unknown) => void): void;
    push(event: string, payload: Record<string, unknown>, timeout?: number): Push;
  }

  export class Push {
    receive(status: string, callback: (response: unknown) => unknown): Push;
  }
}

declare module 'phoenix' {
  export class Socket {
    constructor(url: string, opts?: any);
    connect(): void;
    disconnect(callback?: () => void): void;
    channel(topic: string, params?: any): Channel;
    onOpen(callback: () => void): void;
    onClose(callback: () => void): void;
    onError(callback: (error: any) => void): void;
  }

  export class Channel {
    on(event: string, callback: (response: any) => void): Channel;
    off(event: string, callback?: (response: any) => void): Channel;
    join(params?: any): {
      receive(status: 'ok', callback: (response: any) => void): {
        receive(status: 'error', callback: (response: any) => void): {
          receive(status: 'timeout', callback: () => void): void;
        };
      };
      receive(status: 'error', callback: (response: any) => void): {
        receive(status: 'timeout', callback: () => void): void;
      };
      receive(status: 'timeout', callback: () => void): void;
    };
    leave(): void;
    push(event: string, payload: any, timeout?: number): any;
  }
}
declare module 'phoenix' {
  export class Socket {
    constructor(endPoint: string, opts?: any)
    connect(): void
    disconnect(): void
    onOpen(callback: () => void): void
    onClose(callback: () => void): void
    onError(callback: (error: any) => void): void
    channel(topic: string, params?: any): Channel
  }

  export class Channel {
    join(): Push
    leave(): Push
    on(event: string, callback: (payload: any) => void): void
    off(event: string): void
    push(event: string, payload?: any): Push
  }

  export class Push {
    receive(status: string, callback: (response: any) => void): Push
  }
}

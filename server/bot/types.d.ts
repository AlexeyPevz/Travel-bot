declare module 'node-telegram-bot-api' {
  interface ConstructorOptions {
    polling?: boolean | {
      interval?: number;
      autoStart?: boolean;
      params?: {
        timeout?: number;
        allowed_updates?: string[];
      };
    };
    filepath?: boolean;
    webHook?: boolean | {
      port?: number;
      host?: string;
    };
    onlyFirstMatch?: boolean;
    baseApiUrl?: string;
  }

  interface Message {
    chat: {
      id: number;
      type: string;
    };
    from?: {
      id: number;
    };
    text?: string;
  }

  export default class TelegramBot {
    constructor(token: string, options?: ConstructorOptions);
    public on(event: string, listener: (msg: any) => void): this;
    public onText(regexp: RegExp, callback: (msg: Message, match?: RegExpExecArray | null) => void): void;
    public sendMessage(chatId: number, text: string, options?: any): Promise<any>;
    public getChat(chatId: number): Promise<any>;
    public stopPolling(): Promise<void>;
    public startPolling(): Promise<void>;
  }
}
export interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  isPinned?: boolean;
  tokenCount?: number;
}

export interface Scene {
  id: string;
  name: string;
  messages: Message[];
  summary?: string;
  startTime: Date;
}

export interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    }
  }>;
}
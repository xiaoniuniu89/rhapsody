// src/apps/rhapsody/types.ts
export interface Session {
  id: string;
  number: number;
  name: string;
  startTime: Date;
  endTime?: Date;
  sceneCount: number;
}

export interface Scene {
  id: string;
  name: string;
  number?: number; // Add scene number within session
  sessionId?: string; // Link to parent session
  messages: Message[];
  summary?: string;
  startTime: Date;
}

export interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  isPinned?: boolean;
  tokenCount?: number;
}

export interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
